# Copyright (c) 2026 Heureum AI. All rights reserved.

from rest_framework.authentication import SessionAuthentication


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """Session authentication without CSRF enforcement.

    DRF's default SessionAuthentication enforces CSRF for all authenticated
    requests. This causes 403 errors for:
    - Agent server-to-server calls (httpx, no browser context)
    - Electron file watcher (has session cookies but no CSRF token)

    Django's CsrfViewMiddleware remains in MIDDLEWARE for allauth views.
    SameSite=Lax cookies provide CSRF protection at the cookie level.
    """

    def enforce_csrf(self, request):
        return
