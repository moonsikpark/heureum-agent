# Copyright (c) 2026 Heureum AI. All rights reserved.

"""Celery application configuration for heureum_platform."""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "heureum_platform.settings")

app = Celery("heureum_platform")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
