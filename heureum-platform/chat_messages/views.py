# Copyright (c) 2026 Heureum AI. All rights reserved.

"""Views for message management."""
import httpx
from django.conf import settings
from django.core.cache import cache
from proxy.views import _agent_client
from django.db.models import Count
from rest_framework import viewsets, filters, status as http_status
from rest_framework.decorators import action
from rest_framework.response import Response as DRFResponse

from .models import Message, Session, ToolPermission, Question, SuggestedQuestion
from .serializers import (
    MessageSerializer,
    SessionSerializer,
    SessionCwdUpdateSerializer,
    ToolPermissionSerializer,
    QuestionSerializer,
    SuggestedQuestionSerializer,
)


class MessageViewSet(viewsets.ModelViewSet):
    """ViewSet for Message model."""

    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    filter_backends = [filters.OrderingFilter, filters.SearchFilter]
    ordering_fields = ["created_at", "updated_at"]
    search_fields = ["content"]

    def get_queryset(self):
        """Get queryset with optional session_id filtering."""
        queryset = super().get_queryset()
        session_id = self.request.query_params.get("session_id", None)
        if session_id:
            queryset = queryset.filter(session_id=session_id)

        role = self.request.query_params.get("role", None)
        if role:
            queryset = queryset.filter(role=role)

        return queryset


class SessionViewSet(viewsets.ViewSet):
    """ViewSet for session management."""

    def list(self, request):
        """
        GET /api/v1/sessions/

        List all sessions for the authenticated user.
        """
        if not request.user.is_authenticated:
            return DRFResponse(
                {"error": "Authentication required"},
                status=http_status.HTTP_401_UNAUTHORIZED,
            )

        cache_key = f"user_sessions:{request.user.id}"
        cached = cache.get(cache_key)
        if cached is not None:
            return DRFResponse(cached)

        sessions = Session.objects.filter(user=request.user).order_by("-updated_at")
        session_ids = [s.session_id for s in sessions]

        # Get message counts per session in a single query
        msg_counts = dict(
            Message.objects.filter(
                session_id__in=session_ids,
                role__in=["user", "assistant"],
            )
            .values("session_id")
            .annotate(count=Count("id"))
            .values_list("session_id", "count")
        )

        # Get session IDs that have active periodic tasks
        from periodic_tasks.models import PeriodicTask
        periodic_session_ids = set(
            PeriodicTask.objects.filter(
                user=request.user,
                status="active",
            ).values_list("session_id", flat=True)
        )

        data = []
        for session in sessions:
            s_data = SessionSerializer(session).data
            s_data["message_count"] = msg_counts.get(session.session_id, 0)
            s_data["has_periodic_task"] = session.session_id in periodic_session_ids
            data.append(s_data)

        cache.set(cache_key, data, 120)  # 2 min TTL
        return DRFResponse(data)

    def retrieve(self, request, pk=None):
        """
        GET /api/v1/sessions/{session_id}/

        Retrieve session state including current CWD.
        """
        try:
            session = Session.objects.get(session_id=pk)
            serializer = SessionSerializer(session)
            return DRFResponse(serializer.data)
        except Session.DoesNotExist:
            return DRFResponse(
                {"error": "Session not found"},
                status=http_status.HTTP_404_NOT_FOUND,
            )

    def destroy(self, request, pk=None):
        """
        DELETE /api/v1/sessions/{session_id}/

        Delete a session and all associated messages.
        """
        try:
            session = Session.objects.get(session_id=pk)
        except Session.DoesNotExist:
            return DRFResponse(
                {"error": "Session not found"},
                status=http_status.HTTP_404_NOT_FOUND,
            )

        if request.user.is_authenticated and session.user != request.user:
            return DRFResponse(
                {"error": "Permission denied"},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        # Delete associated messages and responses
        Message.objects.filter(session_id=session.session_id).delete()
        from chat_messages.models import Response as ResponseModel
        ResponseModel.objects.filter(session_id=session.session_id).delete()
        Question.objects.filter(session_id=session.session_id).delete()

        # Delete session files (DB records + disk)
        from session_files.models import SessionFile
        from session_files.storage import SessionFileStorage
        SessionFile.objects.filter(session=session).delete()
        SessionFileStorage.delete_session(session.session_id)

        # Delete associated periodic tasks and their runs
        from periodic_tasks.models import PeriodicTask
        PeriodicTask.objects.filter(session_id=session.session_id).delete()

        user_id = session.user_id
        session.delete()

        if user_id:
            cache.delete(f"user_sessions:{user_id}")

        return DRFResponse(status=http_status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["patch"], url_path="cwd")
    def update_cwd(self, request, pk=None):
        """
        PATCH /api/v1/sessions/{session_id}/cwd/

        Update the working directory for a session.
        Creates the session if it doesn't exist.
        Logs the CWD change as a system message.
        """
        serializer = SessionCwdUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return DRFResponse(serializer.errors, status=http_status.HTTP_400_BAD_REQUEST)

        new_cwd = serializer.validated_data["cwd"]
        session, _created = Session.objects.get_or_create(
            session_id=pk,
            defaults={"cwd": new_cwd},
        )

        old_cwd = None if _created else session.cwd
        if not _created:
            session.cwd = new_cwd
            session.save()

        # Log CWD change as a system message
        old_display = old_cwd or "(none)"
        Message.objects.create(
            session_id=pk,
            role="system",
            content=[
                {
                    "type": "input_text",
                    "text": f"Working directory changed from {old_display} to {new_cwd}",
                }
            ],
            status="completed",
        )

        return DRFResponse(SessionSerializer(session).data)

    @action(detail=True, methods=["get"], url_path="check-updates")
    def check_updates(self, request, pk=None):
        """
        GET /api/v1/sessions/{session_id}/check-updates/

        Lightweight endpoint returning message count and updated_at
        for polling whether the session has new content.
        """
        try:
            session = Session.objects.get(session_id=pk)
        except Session.DoesNotExist:
            return DRFResponse(
                {"error": "Session not found"},
                status=http_status.HTTP_404_NOT_FOUND,
            )

        message_count = Message.objects.filter(
            session_id=pk,
            role__in=["user", "assistant"],
        ).count()

        return DRFResponse({
            "session_id": pk,
            "message_count": message_count,
            "updated_at": session.updated_at.isoformat(),
        })

    @action(detail=True, methods=["post"], url_path="generate-title")
    def generate_title(self, request, pk=None):
        """
        POST /api/v1/sessions/{session_id}/generate-title/

        Generate a title for the session using the LLM.
        """
        try:
            session = Session.objects.get(session_id=pk)
        except Session.DoesNotExist:
            return DRFResponse(
                {"error": "Session not found"},
                status=http_status.HTTP_404_NOT_FOUND,
            )

        # Get first few user/assistant messages for context
        messages = (
            Message.objects.filter(
                session_id=pk,
                role__in=["user", "assistant"],
            )
            .order_by("created_at")[:6]
        )

        msg_list = []
        for msg in messages:
            text = msg.get_text_content()
            if text:
                msg_list.append({"role": msg.role, "text": text[:500]})

        if not msg_list:
            return DRFResponse({"title": "New Chat"})

        # Call agent service to generate title
        try:
            agent_url = f"{settings.AGENT_SERVICE_URL}/v1/title"
            resp = _agent_client.post(
                agent_url,
                json={"messages": msg_list},
                timeout=15.0,
            )
            resp.raise_for_status()
            title = resp.json().get("title", "New Chat")
        except Exception:
            # Fallback: use first user message
            first_text = msg_list[0]["text"]
            title = first_text[:60] + ("..." if len(first_text) > 60 else "")

        session.title = title
        session.save(update_fields=["title"])

        if session.user_id:
            cache.delete(f"user_sessions:{session.user_id}")

        return DRFResponse({"title": title})


class ToolPermissionViewSet(viewsets.ViewSet):
    """ViewSet for checking and managing tool permissions."""

    def list(self, request):
        """
        GET /api/v1/permissions/?client_id=X&tool_name=bash&command=ls

        Check if a base command is permitted for a client.
        Returns { allowed: true/false } if permission exists,
        or { allowed: null } if no permission record found.
        """
        client_id = request.query_params.get("client_id")
        tool_name = request.query_params.get("tool_name")
        command = request.query_params.get("command")

        if not client_id or not tool_name or not command:
            return DRFResponse(
                {"error": "client_id, tool_name, and command are required"},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        cache_key = f"tool_perm:{client_id}:{tool_name}:{command}"
        cached = cache.get(cache_key)
        if cached is not None:
            return DRFResponse(cached)

        try:
            permission = ToolPermission.objects.get(
                client_id=client_id, tool_name=tool_name, command=command
            )
            result = {"allowed": permission.allowed}
        except ToolPermission.DoesNotExist:
            result = {"allowed": None}

        cache.set(cache_key, result, 1800)  # 30 min TTL
        return DRFResponse(result)

    def create(self, request):
        """
        POST /api/v1/permissions/
        Body: { client_id, tool_name, command, allowed }

        Set or update a tool permission for a base command.
        """
        client_id = request.data.get("client_id")
        tool_name = request.data.get("tool_name")
        command = request.data.get("command")
        allowed = request.data.get("allowed")

        if not client_id or not tool_name or not command or allowed is None:
            return DRFResponse(
                {"error": "client_id, tool_name, command, and allowed are required"},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        permission, created = ToolPermission.objects.update_or_create(
            client_id=client_id,
            tool_name=tool_name,
            command=command,
            defaults={"allowed": allowed},
        )

        cache.delete(f"tool_perm:{client_id}:{tool_name}:{command}")

        serializer = ToolPermissionSerializer(permission)
        status_code = http_status.HTTP_201_CREATED if created else http_status.HTTP_200_OK
        return DRFResponse(serializer.data, status=status_code)

    def destroy(self, request, pk=None):
        """DELETE /api/v1/permissions/<id>/ — revoke a stored permission."""
        try:
            permission = ToolPermission.objects.get(pk=pk)
            cache.delete(f"tool_perm:{permission.client_id}:{permission.tool_name}:{permission.command}")
            permission.delete()
            return DRFResponse(status=http_status.HTTP_204_NO_CONTENT)
        except ToolPermission.DoesNotExist:
            return DRFResponse(
                {"error": "Permission not found"},
                status=http_status.HTTP_404_NOT_FOUND,
            )

    @action(detail=False, methods=["post"], url_path="log")
    def log_permission(self, request):
        """
        POST /api/v1/permissions/log/

        Log a permission decision as a system Message for auditing.
        """
        session_id = request.data.get("session_id")
        client_id = request.data.get("client_id")
        tool_name = request.data.get("tool_name")
        command = request.data.get("command", "")
        base_command = request.data.get("base_command", "")
        decision = request.data.get("decision")
        call_id = request.data.get("call_id", "")

        if not all([session_id, client_id, tool_name, decision]):
            return DRFResponse(
                {"error": "session_id, client_id, tool_name, and decision are required"},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        if decision not in ("always_allow", "allow_once", "deny", "auto_approved"):
            return DRFResponse(
                {"error": "decision must be one of: always_allow, allow_once, deny, auto_approved"},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        # Look up existing ToolPermission for cross-reference
        permission_id = None
        try:
            perm = ToolPermission.objects.get(
                client_id=client_id,
                tool_name=tool_name,
                command=base_command or command,
            )
            permission_id = perm.id
        except ToolPermission.DoesNotExist:
            pass

        metadata = {}
        if permission_id is not None:
            metadata["permission_id"] = permission_id

        msg = Message.objects.create(
            session_id=session_id,
            role="system",
            type="permission_grant",
            content={
                "tool_name": tool_name,
                "command": command,
                "base_command": base_command,
                "decision": decision,
                "call_id": call_id,
                "client_id": client_id,
            },
            status="completed",
            metadata=metadata,
        )

        return DRFResponse(
            {"id": msg.id, "permission_id": permission_id},
            status=http_status.HTTP_201_CREATED,
        )


class QuestionViewSet(viewsets.ModelViewSet):
    """ViewSet for Question model."""

    queryset = Question.objects.all()
    serializer_class = QuestionSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["created_at", "updated_at"]

    def get_queryset(self):
        """Get queryset with optional session_id and call_id filtering."""
        queryset = super().get_queryset()
        session_id = self.request.query_params.get("session_id")
        if session_id:
            queryset = queryset.filter(session_id=session_id)
        call_id = self.request.query_params.get("call_id")
        if call_id:
            queryset = queryset.filter(call_id=call_id)
        return queryset


class SuggestedQuestionViewSet(viewsets.ModelViewSet):
    """ViewSet for suggested questions shown on the new chat page."""

    queryset = SuggestedQuestion.objects.filter(is_active=True)
    serializer_class = SuggestedQuestionSerializer
    pagination_class = None

    def list(self, request, *args, **kwargs):
        cached = cache.get("suggested_questions")
        if cached is not None:
            return DRFResponse(cached)
        response = super().list(request, *args, **kwargs)
        cache.set("suggested_questions", response.data, 3600)  # 1 hour TTL
        return response

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        cache.delete("suggested_questions")
        return response

    def update(self, request, *args, **kwargs):
        response = super().update(request, *args, **kwargs)
        cache.delete("suggested_questions")
        return response

    def destroy(self, request, *args, **kwargs):
        response = super().destroy(request, *args, **kwargs)
        cache.delete("suggested_questions")
        return response
