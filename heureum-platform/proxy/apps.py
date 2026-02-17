# Copyright (c) 2026 Heureum AI. All rights reserved.

"""Proxy app configuration."""
from django.apps import AppConfig


class ProxyConfig(AppConfig):
    """Proxy app configuration."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "proxy"
    verbose_name = "Proxy"
