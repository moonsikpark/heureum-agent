# Copyright (c) 2026 Heureum AI. All rights reserved.

from django.contrib import admin

from .models import Notification, DeviceToken, NotificationPreference


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "title", "body_preview", "read_at", "created_at"]
    list_filter = ["created_at"]
    search_fields = ["title", "body", "user__email"]
    readonly_fields = ["id", "created_at"]
    ordering = ["-created_at"]

    def body_preview(self, obj):
        return obj.body[:60] + "..." if len(obj.body) > 60 else obj.body

    body_preview.short_description = "Body"


@admin.register(DeviceToken)
class DeviceTokenAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "device_type", "token_preview", "is_active", "updated_at"]
    list_filter = ["device_type", "is_active"]
    search_fields = ["user__email", "token"]
    readonly_fields = ["created_at", "updated_at"]
    ordering = ["-updated_at"]

    def token_preview(self, obj):
        return obj.token[:30] + "..."

    token_preview.short_description = "Token"


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = ["user", "enabled", "web_enabled", "electron_enabled", "mobile_enabled", "updated_at"]
    list_filter = ["enabled", "web_enabled", "electron_enabled", "mobile_enabled"]
    search_fields = ["user__email"]
    readonly_fields = ["updated_at"]
