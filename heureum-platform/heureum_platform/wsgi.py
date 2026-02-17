# Copyright (c) 2026 Heureum AI. All rights reserved.

"""
WSGI config for heureum_platform project.
"""
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "heureum_platform.settings")

application = get_wsgi_application()
