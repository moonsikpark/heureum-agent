# Copyright (c) 2026 Heureum AI. All rights reserved.

from django.urls import path

from . import views

urlpatterns = [
    # Internal (agent service, no auth)
    path("internal/send/", views.internal_send, name="notification-internal-send"),
    path("vapid-key/", views.vapid_public_key, name="vapid-public-key"),
    path("register-device/", views.register_device, name="register-device"),
    path("unregister-device/", views.unregister_device, name="unregister-device"),
    path("preferences/", views.notification_preferences, name="notification-preferences"),
    path("stream/", views.notification_stream, name="notification-stream"),
    path("", views.list_notifications, name="list-notifications"),
    path("<str:notification_id>/read/", views.mark_read, name="mark-read"),
    path("read-all/", views.mark_all_read, name="mark-all-read"),
    path("test/", views.test_notification, name="test-notification"),
]
