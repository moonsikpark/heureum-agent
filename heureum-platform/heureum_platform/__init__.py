# Copyright (c) 2026 Heureum AI. All rights reserved.

"""Heureum Platform - Django proxy and message storage system."""
__version__ = "0.1.0"

from .celery import app as celery_app

__all__ = ("celery_app",)
