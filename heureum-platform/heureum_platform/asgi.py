# Copyright (c) 2026 Heureum AI. All rights reserved.

"""
ASGI config for heureum_platform project.
"""
import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "heureum_platform.settings")

application = get_asgi_application()
