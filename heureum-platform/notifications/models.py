# Copyright (c) 2026 Heureum AI. All rights reserved.

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class Notification(models.Model):
    id = models.CharField(max_length=255, primary_key=True, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    title = models.CharField(max_length=255)
    body = models.TextField(blank=True, default="")
    data = models.JSONField(default=dict, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["user", "read_at"]),
        ]

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"notif_{uuid.uuid4().hex}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.title} → {self.user}"


class DeviceToken(models.Model):
    DEVICE_TYPES = [
        ("web", "Web"),
        ("electron", "Electron"),
        ("ios", "iOS"),
        ("android", "Android"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="device_tokens",
    )
    device_type = models.CharField(max_length=20, choices=DEVICE_TYPES)
    token = models.TextField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("user", "token")]
        indexes = [
            models.Index(fields=["user", "is_active"]),
        ]

    def __str__(self):
        return f"{self.device_type}:{self.token[:20]}... ({self.user})"


class NotificationPreference(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_preference",
    )
    enabled = models.BooleanField(default=True)
    web_enabled = models.BooleanField(default=False)
    electron_enabled = models.BooleanField(default=True)
    mobile_enabled = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"NotificationPreference({self.user})"


def get_or_create_preference(user):
    pref, _ = NotificationPreference.objects.get_or_create(user=user)
    return pref
