# Copyright (c) 2026 Heureum AI. All rights reserved.

import logging

from django.apps import AppConfig
from django.conf import settings

logger = logging.getLogger(__name__)


class NotificationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "notifications"

    def ready(self):
        credentials_path = getattr(settings, "FIREBASE_CREDENTIALS_PATH", "")
        if not credentials_path:
            logger.warning("FIREBASE_CREDENTIALS_PATH not set — push notifications disabled")
            return

        import firebase_admin
        from firebase_admin import credentials

        if not firebase_admin._apps:
            cred = credentials.Certificate(credentials_path)
            firebase_admin.initialize_app(cred)
            logger.info("Firebase Admin SDK initialized")
