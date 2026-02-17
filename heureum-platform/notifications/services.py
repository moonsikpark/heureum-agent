# Copyright (c) 2026 Heureum AI. All rights reserved.

import json
import logging

from django.conf import settings as django_settings

from .models import Notification, DeviceToken, get_or_create_preference

logger = logging.getLogger(__name__)


def notify_user(user, title, body, data=None):
    """Send a push notification to all of a user's registered devices.

    Creates a Notification record and sends via the appropriate push service
    for each device type. Returns the created Notification.
    """
    notification = Notification.objects.create(
        user=user,
        title=title,
        body=body,
        data=data or {},
    )

    pref = get_or_create_preference(user)
    if not pref.enabled:
        logger.info("Notifications disabled for user %s", user)
        return notification

    tokens = list(DeviceToken.objects.filter(user=user, is_active=True))
    if not tokens:
        logger.info("No active device tokens for user %s", user)
        return notification

    if pref.web_enabled:
        web_tokens = [t for t in tokens if t.device_type == "web"]
        if web_tokens:
            _send_web_push(notification, web_tokens)

    if pref.mobile_enabled:
        fcm_tokens = [t for t in tokens if t.device_type in ("ios", "android")]
        if fcm_tokens:
            _send_fcm(notification, fcm_tokens)

    return notification


def _send_web_push(notification, device_tokens):
    """Send notification via Web Push (pywebpush + VAPID)."""
    private_key = getattr(django_settings, "VAPID_PRIVATE_KEY", "")
    claims_email = getattr(django_settings, "VAPID_CLAIMS_EMAIL", "")
    if not private_key:
        logger.warning("VAPID_PRIVATE_KEY not set — skipping web push")
        return

    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        logger.warning("pywebpush not installed — skipping web push")
        return

    payload = json.dumps({
        "title": notification.title,
        "body": notification.body,
        "data": notification.data,
    })

    for dt in device_tokens:
        try:
            subscription_info = json.loads(dt.token)
            webpush(
                subscription_info=subscription_info,
                data=payload,
                vapid_private_key=private_key,
                vapid_claims={"sub": claims_email},
            )
        except WebPushException as e:
            response = getattr(e, "response", None)
            status_code = response.status_code if response else None
            if status_code in (404, 410):
                logger.info("Web push subscription gone (HTTP %s), deactivating: %s", status_code, dt)
                dt.is_active = False
                dt.save(update_fields=["is_active", "updated_at"])
            else:
                logger.exception("Web push failed for token %s", str(dt.token)[:40])
        except (json.JSONDecodeError, KeyError):
            logger.warning("Invalid web push subscription JSON, deactivating: %s", dt)
            dt.is_active = False
            dt.save(update_fields=["is_active", "updated_at"])
        except Exception:
            logger.exception("Web push send failed for token %s", str(dt.token)[:40])


def _send_fcm(notification, device_tokens):
    """Send notification via Firebase Cloud Messaging (for iOS/Android)."""
    try:
        import firebase_admin
        if not firebase_admin._apps:
            logger.warning("Firebase not initialized — skipping push")
            return
    except ImportError:
        logger.warning("firebase-admin not installed — skipping push")
        return

    from firebase_admin import messaging

    for dt in device_tokens:
        msg = messaging.Message(
            notification=messaging.Notification(
                title=notification.title,
                body=notification.body,
            ),
            data={k: str(v) for k, v in notification.data.items()} if notification.data else None,
            token=dt.token,
        )
        try:
            messaging.send(msg)
        except messaging.UnregisteredError:
            logger.info("Token unregistered, deactivating: %s", dt)
            dt.is_active = False
            dt.save(update_fields=["is_active", "updated_at"])
        except messaging.InvalidArgumentError:
            logger.warning("Invalid FCM token, deactivating: %s", dt)
            dt.is_active = False
            dt.save(update_fields=["is_active", "updated_at"])
        except Exception:
            logger.exception("FCM send failed for token %s", dt.token[:20])
