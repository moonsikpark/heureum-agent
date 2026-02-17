# Copyright (c) 2026 Heureum AI. All rights reserved.

"""Admin configuration for messages app."""
from django.conf import settings
from django.contrib import admin
from django.utils.html import format_html

from .models import Message, Session, ToolPermission, Question, SuggestedQuestion

FRONTEND_URL = getattr(settings, "FRONTEND_URL", "http://localhost:5173")


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    """Admin interface for Session model."""

    list_display = ["session_id", "user", "title", "created_at", "updated_at"]
    list_filter = ["created_at"]
    search_fields = ["session_id", "title"]
    readonly_fields = ["created_at", "updated_at", "messages_display"]
    ordering = ["-updated_at"]

    def messages_display(self, obj):
        url = f"{FRONTEND_URL}/chat/view/{obj.session_id}"
        return format_html(
            '<iframe src="{}" style="width:100%;height:600px;border:1px solid #ddd;border-radius:8px;" sandbox="allow-scripts allow-same-origin"></iframe>',
            url,
        )

    messages_display.short_description = "Messages"


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    """Admin interface for Message model."""

    list_display = ["id", "session_id", "role", "content_preview", "created_at"]
    list_filter = ["role", "created_at"]
    search_fields = ["session_id", "content"]
    readonly_fields = ["created_at", "updated_at"]
    ordering = ["-created_at"]

    def content_preview(self, obj: Message) -> str:
        """Show preview of message content."""
        text = str(obj.content)
        return text[:50] + "..." if len(text) > 50 else text

    content_preview.short_description = "Content"


@admin.register(ToolPermission)
class ToolPermissionAdmin(admin.ModelAdmin):
    """Admin interface for ToolPermission model."""

    list_display = ["id", "client_id_short", "tool_name", "command", "allowed", "updated_at"]
    list_filter = ["allowed", "tool_name", "command"]
    search_fields = ["client_id", "tool_name", "command"]
    readonly_fields = ["created_at", "updated_at"]
    ordering = ["-updated_at"]

    def client_id_short(self, obj):
        return obj.client_id[:12] + "..."

    client_id_short.short_description = "Client ID"


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    """Admin interface for Question model."""

    list_display = ["id", "session_id", "question_preview", "answer_type", "has_answer", "created_at"]
    list_filter = ["answer_type", "allow_user_input", "created_at"]
    search_fields = ["session_id", "question_text", "user_answer"]
    readonly_fields = ["created_at", "updated_at"]
    ordering = ["-created_at"]

    def question_preview(self, obj):
        return obj.question_text[:60] + "..." if len(obj.question_text) > 60 else obj.question_text

    question_preview.short_description = "Question"

    def has_answer(self, obj):
        return obj.user_answer is not None

    has_answer.boolean = True
    has_answer.short_description = "Answered"


@admin.register(SuggestedQuestion)
class SuggestedQuestionAdmin(admin.ModelAdmin):
    list_display = ["question_text", "order", "is_active", "created_at"]
    list_filter = ["is_active"]
    list_editable = ["order", "is_active"]
    ordering = ["order", "-created_at"]
