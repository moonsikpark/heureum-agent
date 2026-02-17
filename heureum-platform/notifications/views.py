# Copyright (c) 2026 Heureum AI. All rights reserved.

import json
import time

from django.http import StreamingHttpResponse
from django.utils import timezone
from rest_framework import status as http_status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from chat_messages.models import Session
from .models import Notification, DeviceToken, get_or_create_preference
from .serializers import NotificationSerializer, RegisterDeviceSerializer, NotificationPreferenceSerializer


@api_view(["GET"])
def vapid_public_key(request):
    """Return the VAPID public key for Web Push subscription."""
    from django.conf import settings
    key = getattr(settings, "VAPID_PUBLIC_KEY", "")
    if not key:
        return Response(
            {"error": "Web push not configured"},
            status=http_status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return Response({"public_key": key})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def register_device(request):
    """Register a device token for push notifications."""
    serializer = RegisterDeviceSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    token = serializer.validated_data["token"]
    device_type = serializer.validated_data["device_type"]

    dt, created = DeviceToken.objects.update_or_create(
        user=request.user,
        token=token,
        defaults={"device_type": device_type, "is_active": True},
    )

    status_code = http_status.HTTP_201_CREATED if created else http_status.HTTP_200_OK
    return Response({"id": dt.id, "device_type": dt.device_type}, status=status_code)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def unregister_device(request):
    """Deactivate an FCM device token."""
    token = request.data.get("token")
    if not token:
        return Response({"error": "token is required"}, status=http_status.HTTP_400_BAD_REQUEST)

    updated = DeviceToken.objects.filter(
        user=request.user, token=token
    ).update(is_active=False)

    if not updated:
        return Response({"error": "Token not found"}, status=http_status.HTTP_404_NOT_FOUND)

    return Response({"success": True})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_notifications(request):
    """List notifications for the authenticated user."""
    notifications = Notification.objects.filter(user=request.user)

    unread_only = request.query_params.get("unread")
    if unread_only:
        notifications = notifications.filter(read_at__isnull=True)

    page_size = 50
    notifications = notifications[:page_size]

    serializer = NotificationSerializer(notifications, many=True)
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_read(request, notification_id):
    """Mark a single notification as read."""
    try:
        notification = Notification.objects.get(id=notification_id, user=request.user)
    except Notification.DoesNotExist:
        return Response({"error": "Not found"}, status=http_status.HTTP_404_NOT_FOUND)

    notification.read_at = timezone.now()
    notification.save(update_fields=["read_at"])
    return Response(NotificationSerializer(notification).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_all_read(request):
    """Mark all unread notifications as read."""
    count = Notification.objects.filter(
        user=request.user, read_at__isnull=True
    ).update(read_at=timezone.now())
    return Response({"marked": count})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def test_notification(request):
    """Send a test notification to the current user (debug endpoint)."""
    from .services import notify_user
    title = request.data.get("title", "Test Notification")
    body = request.data.get("body", "This is a test notification.")
    n = notify_user(request.user, title, body)
    return Response(NotificationSerializer(n).data, status=http_status.HTTP_201_CREATED)


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def notification_preferences(request):
    """Get or update notification delivery preferences."""
    pref = get_or_create_preference(request.user)

    if request.method == "GET":
        serializer = NotificationPreferenceSerializer(pref)
        device_types = list(
            DeviceToken.objects.filter(user=request.user, is_active=True)
            .values_list("device_type", flat=True)
            .distinct()
        )
        return Response({
            "preferences": serializer.data,
            "registered_device_types": device_types,
        })

    # PATCH
    serializer = NotificationPreferenceSerializer(pref, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([AllowAny])
def internal_send(request):
    """Internal: send a notification to a user identified by session_id (no auth).

    Called by the agent service for server-side tools like notify_user.
    """
    from .services import notify_user

    session_id = request.data.get("session_id")
    title = request.data.get("title")
    body = request.data.get("body", "")

    if not session_id:
        return Response({"error": "session_id is required"}, status=http_status.HTTP_400_BAD_REQUEST)
    if not title:
        return Response({"error": "title is required"}, status=http_status.HTTP_400_BAD_REQUEST)

    try:
        session = Session.objects.get(session_id=session_id)
    except Session.DoesNotExist:
        return Response({"error": "Session not found"}, status=http_status.HTTP_404_NOT_FOUND)

    if not session.user:
        return Response({"error": "Session has no associated user"}, status=http_status.HTTP_400_BAD_REQUEST)

    data = request.data.get("data")
    n = notify_user(session.user, title, body, data=data)
    return Response(NotificationSerializer(n).data, status=http_status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def notification_stream(request):
    """SSE stream that pushes new notifications in real-time via DB polling."""
    user = request.user
    last_id = request.query_params.get("last_id")

    def event_stream():
        pref = get_or_create_preference(user)

        def is_enabled():
            return pref.enabled and pref.electron_enabled

        if not is_enabled():
            yield f"data: {json.dumps({'type': 'disabled'})}\n\n"

        # Send any notifications newer than last_id on connect
        if is_enabled():
            qs = Notification.objects.filter(user=user, read_at__isnull=True)
            if last_id:
                try:
                    after = Notification.objects.get(id=last_id, user=user)
                    qs = qs.filter(created_at__gt=after.created_at)
                except Notification.DoesNotExist:
                    pass

            last_seen = timezone.now()
            for n in qs.order_by("created_at")[:50]:
                data = NotificationSerializer(n).data
                yield f"data: {json.dumps(data)}\n\n"
                last_seen = n.created_at
        else:
            last_seen = timezone.now()

        # Poll DB for new notifications.
        # Connection lifetime is capped so Gunicorn workers are freed
        # periodically — the client's EventSource will auto-reconnect.
        poll_interval = 10  # seconds between DB checks
        max_lifetime = 120  # seconds before closing (frees the worker)
        heartbeat_interval = 30  # seconds between heartbeats
        elapsed = 0
        since_heartbeat = 0
        pref_check_counter = 0

        while elapsed < max_lifetime:
            time.sleep(poll_interval)
            elapsed += poll_interval
            since_heartbeat += poll_interval

            # Re-check preference every ~60s
            pref_check_counter += poll_interval
            if pref_check_counter >= 60:
                pref.refresh_from_db()
                pref_check_counter = 0

            if is_enabled():
                new = Notification.objects.filter(
                    user=user, created_at__gt=last_seen
                ).order_by("created_at")[:50]
                for n in new:
                    data = NotificationSerializer(n).data
                    yield f"data: {json.dumps(data)}\n\n"
                    last_seen = n.created_at
                    since_heartbeat = 0

            if since_heartbeat >= heartbeat_interval:
                yield ": heartbeat\n\n"
                since_heartbeat = 0

        # Tell the client to reconnect with a retry hint
        yield f"retry: 1000\n\n"

    resp = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
    resp["Cache-Control"] = "no-cache"
    resp["X-Accel-Buffering"] = "no"
    return resp
