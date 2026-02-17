# Copyright (c) 2026 Heureum AI. All rights reserved.

import logging

from django.utils import timezone
from rest_framework import status as http_status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from chat_messages.models import Session
from .models import PeriodicTask, PeriodicTaskRun
from .serializers import (
    PeriodicTaskSerializer,
    PeriodicTaskCreateSerializer,
    PeriodicTaskRunSerializer,
)
from .utils import compute_next_run

logger = logging.getLogger(__name__)


# ── User-facing endpoints ────────────────────────────────────────────


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def task_list_create(request):
    """GET: list user's periodic tasks. POST: create a new periodic task."""
    if request.method == "GET":
        tasks = PeriodicTask.objects.filter(user=request.user)
        return Response(PeriodicTaskSerializer(tasks, many=True).data)

    # POST — create
    serializer = PeriodicTaskCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    d = serializer.validated_data

    # Resolve user from session
    try:
        session = Session.objects.get(session_id=d["session_id"])
    except Session.DoesNotExist:
        return Response({"error": "Session not found"}, status=http_status.HTTP_404_NOT_FOUND)

    schedule = d["schedule"]
    tz_name = d.get("timezone_name", "Asia/Seoul")

    try:
        next_run = compute_next_run(schedule, tz_name)
    except Exception as e:
        return Response(
            {"error": f"Invalid schedule or timezone: {e}"},
            status=http_status.HTTP_400_BAD_REQUEST,
        )

    task = PeriodicTask.objects.create(
        user=session.user,
        session_id=d["session_id"],
        title=d["title"],
        description=d.get("description", ""),
        recipe=d["recipe"],
        schedule=schedule,
        timezone_name=tz_name,
        notify_on_success=d.get("notify_on_success", True),
    )
    task.next_run_at = next_run
    task.save(update_fields=["next_run_at"])

    return Response(PeriodicTaskSerializer(task).data, status=http_status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def task_detail(request, task_id):
    """GET/PATCH/DELETE a specific periodic task."""
    try:
        task = PeriodicTask.objects.get(id=task_id, user=request.user)
    except PeriodicTask.DoesNotExist:
        return Response({"error": "Not found"}, status=http_status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(PeriodicTaskSerializer(task).data)

    if request.method == "DELETE":
        task.delete()
        return Response(status=http_status.HTTP_204_NO_CONTENT)

    # PATCH
    allowed = {"status", "schedule", "timezone_name", "title", "description", "max_retries", "notify_on_success"}
    for key, value in request.data.items():
        if key in allowed:
            setattr(task, key, value)
    if "schedule" in request.data or "timezone_name" in request.data:
        task.next_run_at = compute_next_run(task.schedule, task.timezone_name)
    task.save()
    return Response(PeriodicTaskSerializer(task).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def task_pause(request, task_id):
    try:
        task = PeriodicTask.objects.get(id=task_id, user=request.user)
    except PeriodicTask.DoesNotExist:
        return Response({"error": "Not found"}, status=http_status.HTTP_404_NOT_FOUND)
    task.status = "paused"
    task.save(update_fields=["status", "updated_at"])
    return Response(PeriodicTaskSerializer(task).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def task_resume(request, task_id):
    try:
        task = PeriodicTask.objects.get(id=task_id, user=request.user)
    except PeriodicTask.DoesNotExist:
        return Response({"error": "Not found"}, status=http_status.HTTP_404_NOT_FOUND)
    task.status = "active"
    task.consecutive_failures = 0
    task.next_run_at = compute_next_run(task.schedule, task.timezone_name)
    task.save(update_fields=["status", "consecutive_failures", "next_run_at", "updated_at"])
    return Response(PeriodicTaskSerializer(task).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def task_runs(request, task_id):
    """List execution history for a periodic task."""
    try:
        task = PeriodicTask.objects.get(id=task_id, user=request.user)
    except PeriodicTask.DoesNotExist:
        return Response({"error": "Not found"}, status=http_status.HTTP_404_NOT_FOUND)
    runs = PeriodicTaskRun.objects.filter(task=task)[:50]
    return Response(PeriodicTaskRunSerializer(runs, many=True).data)


# ── Internal endpoints (called by management command / agent) ────────


@api_view(["GET"])
@permission_classes([AllowAny])
def due_tasks(request):
    """Return active tasks whose next_run_at has passed."""
    now = timezone.now()
    tasks = PeriodicTask.objects.filter(
        status="active",
        next_run_at__lte=now,
    ).select_related("user")[:10]

    data = []
    for task in tasks:
        d = PeriodicTaskSerializer(task).data
        d["user_id"] = task.user_id
        data.append(d)
    return Response(data)


@api_view(["POST"])
@permission_classes([AllowAny])
def create_run(request, task_id):
    """Create a new run record for a task."""
    try:
        task = PeriodicTask.objects.get(id=task_id)
    except PeriodicTask.DoesNotExist:
        return Response({"error": "Task not found"}, status=http_status.HTTP_404_NOT_FOUND)

    run = PeriodicTaskRun.objects.create(
        task=task,
        attempt=request.data.get("attempt", 1),
    )
    return Response(PeriodicTaskRunSerializer(run).data, status=http_status.HTTP_201_CREATED)


@api_view(["PATCH"])
@permission_classes([AllowAny])
def update_run(request, run_id):
    """Update a run record (complete or fail)."""
    try:
        run = PeriodicTaskRun.objects.get(id=run_id)
    except PeriodicTaskRun.DoesNotExist:
        return Response({"error": "Run not found"}, status=http_status.HTTP_404_NOT_FOUND)

    for field in [
        "status", "output_summary", "error_message", "files_created",
        "input_tokens", "output_tokens", "total_tokens", "total_cost",
        "iterations", "tool_calls_count", "attempt",
    ]:
        if field in request.data:
            setattr(run, field, request.data[field])

    if request.data.get("status") in ("completed", "failed"):
        run.completed_at = timezone.now()
    run.save()
    return Response(PeriodicTaskRunSerializer(run).data)


@api_view(["POST"])
@permission_classes([AllowAny])
def internal_create_task(request):
    """Internal: create a periodic task (called by agent service, no auth)."""
    serializer = PeriodicTaskCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    d = serializer.validated_data

    try:
        session = Session.objects.get(session_id=d["session_id"])
    except Session.DoesNotExist:
        return Response({"error": "Session not found"}, status=http_status.HTTP_404_NOT_FOUND)

    schedule = d["schedule"]
    tz_name = d.get("timezone_name", "Asia/Seoul")

    try:
        next_run = compute_next_run(schedule, tz_name)
    except Exception as e:
        return Response(
            {"error": f"Invalid schedule or timezone: {e}"},
            status=http_status.HTTP_400_BAD_REQUEST,
        )

    task = PeriodicTask.objects.create(
        user=session.user,
        session_id=d["session_id"],
        title=d["title"],
        description=d.get("description", ""),
        recipe=d["recipe"],
        schedule=schedule,
        timezone_name=tz_name,
        notify_on_success=d.get("notify_on_success", True),
    )
    task.next_run_at = next_run
    task.save(update_fields=["next_run_at"])

    return Response(PeriodicTaskSerializer(task).data, status=http_status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([AllowAny])
def internal_list_tasks(request):
    """Internal: list tasks for a session's user (called by agent service, no auth)."""
    session_id = request.query_params.get("session_id")
    if not session_id:
        return Response({"error": "session_id required"}, status=http_status.HTTP_400_BAD_REQUEST)

    try:
        session = Session.objects.get(session_id=session_id)
    except Session.DoesNotExist:
        return Response({"error": "Session not found"}, status=http_status.HTTP_404_NOT_FOUND)

    tasks = PeriodicTask.objects.filter(user=session.user)
    return Response(PeriodicTaskSerializer(tasks, many=True).data)


@api_view(["PATCH"])
@permission_classes([AllowAny])
def internal_update_task(request, task_id):
    """Internal: update a task (called by agent service, no auth)."""
    try:
        task = PeriodicTask.objects.get(id=task_id)
    except PeriodicTask.DoesNotExist:
        return Response({"error": "Not found"}, status=http_status.HTTP_404_NOT_FOUND)

    allowed = {"status", "schedule", "timezone_name", "title", "description", "max_retries", "notify_on_success"}
    for key, value in request.data.items():
        if key in allowed:
            setattr(task, key, value)
    if "schedule" in request.data or "timezone_name" in request.data:
        task.next_run_at = compute_next_run(task.schedule, task.timezone_name)
    task.save()
    return Response(PeriodicTaskSerializer(task).data)


@api_view(["POST"])
@permission_classes([AllowAny])
def internal_resume_task(request, task_id):
    """Internal: resume a task (called by agent service, no auth)."""
    try:
        task = PeriodicTask.objects.get(id=task_id)
    except PeriodicTask.DoesNotExist:
        return Response({"error": "Not found"}, status=http_status.HTTP_404_NOT_FOUND)

    task.status = "active"
    task.consecutive_failures = 0
    task.next_run_at = compute_next_run(task.schedule, task.timezone_name)
    task.save(update_fields=["status", "consecutive_failures", "next_run_at", "updated_at"])
    return Response(PeriodicTaskSerializer(task).data)


@api_view(["POST"])
@permission_classes([AllowAny])
def mark_run_done(request, task_id):
    """Update task stats after a run and compute next next_run_at."""
    try:
        task = PeriodicTask.objects.get(id=task_id)
    except PeriodicTask.DoesNotExist:
        return Response({"error": "Task not found"}, status=http_status.HTTP_404_NOT_FOUND)

    success = request.data.get("success", False)
    task.total_runs += 1
    task.last_run_at = timezone.now()

    if success:
        task.total_successes += 1
        task.consecutive_failures = 0
    else:
        task.total_failures += 1
        task.consecutive_failures += 1
        if task.consecutive_failures >= task.max_retries:
            task.status = "failed"

    if task.status == "active":
        task.next_run_at = compute_next_run(task.schedule, task.timezone_name)
    else:
        task.next_run_at = None

    task.save()
    return Response(PeriodicTaskSerializer(task).data)
