# Copyright (c) 2026 Heureum AI. All rights reserved.

from django.contrib import admin

from .models import SessionFile


@admin.register(SessionFile)
class SessionFileAdmin(admin.ModelAdmin):
    list_display = ["id", "session", "path", "content_type", "size", "is_text", "created_by", "updated_at"]
    list_filter = ["is_text", "created_by"]
    search_fields = ["path", "session__session_id"]
    readonly_fields = ["id", "created_at", "updated_at"]
