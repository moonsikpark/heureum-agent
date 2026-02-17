# Copyright (c) 2026 Heureum AI. All rights reserved.

"""Messages app configuration."""
from django.apps import AppConfig


class ChatMessagesConfig(AppConfig):
    """Chat Messages app configuration."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "chat_messages"
    verbose_name = "Chat Messages"
