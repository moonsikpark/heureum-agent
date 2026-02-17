# Copyright (c) 2026 Heureum AI. All rights reserved.

from django.conf import settings
from django.contrib.auth import get_user_model, login
from django.http import HttpResponse, HttpResponseRedirect
from django.template.loader import render_to_string
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from allauth.account.adapter import get_adapter
from allauth.account.models import EmailAddress
from allauth.account.utils import user_field
from allauth.core.internal.cryptokit import compare_user_code, generate_user_code

from accounts.models import LoginCode
from accounts.serializers import (
    CompleteSignupSerializer,
    ConfirmCodeSerializer,
    RequestCodeSerializer,
    UserSerializer,
)

User = get_user_model()

MAX_ATTEMPTS = 5


class RequestCodeView(APIView):
    """Send a verification code to any email address.
    Works for both existing users (login) and new users (signup)."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RequestCodeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data["email"].strip().lower()
        client = serializer.validated_data["client"]

        # Invalidate any prior unused codes for this email
        LoginCode.objects.filter(email=email, used=False).update(used=True)

        code = generate_user_code()
        login_code = LoginCode.objects.create(email=email, code=code, client=client)

        platform_url = request.build_absolute_uri("/").rstrip("/")
        magic_link_url = (
            f"{platform_url}/api/v1/auth/login/confirm/?key={login_code.key}"
        )

        # Store code pk in session for in-app manual code entry
        request.session["pending_login_code_id"] = login_code.pk

        # Send the code email
        adapter = get_adapter()
        context = {"code": code, "magic_link_url": magic_link_url}
        adapter.send_mail("account/email/login_code", email, context)

        return Response({"status": "ok"})


class ConfirmCodeView(APIView):
    """Verify the code (in-app manual entry). If user exists, log them in.
    If not, mark email as verified and return signup_required."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ConfirmCodeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        code = serializer.validated_data["code"].strip()

        login_code_id = request.session.get("pending_login_code_id")
        if not login_code_id:
            return Response({"error": "no_pending_auth"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            login_code = LoginCode.objects.get(pk=login_code_id, used=False)
        except LoginCode.DoesNotExist:
            return Response({"error": "no_pending_auth"}, status=status.HTTP_400_BAD_REQUEST)

        if login_code.is_expired():
            login_code.used = True
            login_code.save(update_fields=["used"])
            request.session.pop("pending_login_code_id", None)
            return Response({"error": "code_expired"}, status=status.HTTP_400_BAD_REQUEST)

        if login_code.attempts >= MAX_ATTEMPTS:
            login_code.used = True
            login_code.save(update_fields=["used"])
            request.session.pop("pending_login_code_id", None)
            return Response({"error": "too_many_attempts"}, status=status.HTTP_400_BAD_REQUEST)

        if not compare_user_code(actual=code, expected=login_code.code):
            login_code.attempts += 1
            login_code.save(update_fields=["attempts"])
            return Response({"error": "invalid_code"}, status=status.HTTP_400_BAD_REQUEST)

        # Code is valid
        email = login_code.email
        user = User.objects.filter(email=email).first()

        if user:
            login(
                request,
                user,
                backend="allauth.account.auth_backends.AuthenticationBackend",
            )
            login_code.used = True
            login_code.save(update_fields=["used"])
            request.session.pop("pending_login_code_id", None)
            return Response(
                {
                    "status": "authenticated",
                    "user": UserSerializer(user).data,
                }
            )
        else:
            login_code.verified = True
            login_code.save(update_fields=["verified"])
            return Response({"status": "signup_required"})


class MagicLinkLoginView(APIView):
    """Handle magic link click from email. Validates via opaque key,
    marks as verified, serves deep-link redirect page using the same key."""

    permission_classes = [AllowAny]

    def get(self, request):
        key = request.GET.get("key", "")
        frontend_url = settings.FRONTEND_URL

        if not key:
            return HttpResponseRedirect(
                f"{frontend_url}/login/callback?status=error&reason=missing_code"
            )

        try:
            login_code = LoginCode.objects.get(key=key, used=False, verified=False)
        except LoginCode.DoesNotExist:
            return HttpResponseRedirect(
                f"{frontend_url}/login/callback?status=error&reason=no_pending_login"
            )

        if login_code.is_expired():
            login_code.used = True
            login_code.save(update_fields=["used"])
            return HttpResponseRedirect(
                f"{frontend_url}/login/callback?status=error&reason=expired"
            )

        # Mark as verified (awaiting token exchange), but NOT used yet
        login_code.verified = True
        login_code.save(update_fields=["verified"])

        # Web clients: go straight to token exchange (no deep link)
        if login_code.client == LoginCode.CLIENT_WEB:
            platform_url = request.build_absolute_uri("/").rstrip("/")
            return HttpResponseRedirect(
                f"{platform_url}/api/v1/auth/token/exchange/?token={key}"
            )

        # Electron/mobile clients: serve the deep-link redirect page
        deep_link_url = f"heureum://auth/callback?token={key}"
        web_fallback_url = f"{frontend_url}/login/callback?token={key}"

        context = {
            "deep_link_url": deep_link_url,
            "web_fallback_url": web_fallback_url,
            "app_name": "Heureum",
        }

        html = render_to_string("accounts/magic_link_redirect.html", context)
        return HttpResponse(html, content_type="text/html")


class TokenExchangeView(APIView):
    """Exchange a LoginCode key for a session. Called by the app's
    WebView after receiving a deep link, or by the web fallback."""

    permission_classes = [AllowAny]

    def get(self, request):
        token = request.GET.get("token", "")
        frontend_url = settings.FRONTEND_URL

        if not token:
            return HttpResponseRedirect(
                f"{frontend_url}/login/callback?status=error&reason=missing_token"
            )

        try:
            login_code = LoginCode.objects.get(key=token, verified=True, used=False)
        except LoginCode.DoesNotExist:
            if request.user.is_authenticated:
                return HttpResponseRedirect(f"{frontend_url}/login/callback?status=ok")
            return HttpResponseRedirect(
                f"{frontend_url}/login/callback?status=error&reason=invalid_token"
            )

        if login_code.is_expired():
            login_code.used = True
            login_code.save(update_fields=["used"])
            if request.user.is_authenticated:
                return HttpResponseRedirect(f"{frontend_url}/login/callback?status=ok")
            return HttpResponseRedirect(
                f"{frontend_url}/login/callback?status=error&reason=token_expired"
            )

        # Mark as used (one-time, prevents replay)
        login_code.used = True
        login_code.save(update_fields=["used"])

        email = login_code.email
        user = User.objects.filter(email=email).first()

        if user:
            login(
                request,
                user,
                backend="allauth.account.auth_backends.AuthenticationBackend",
            )
            return HttpResponseRedirect(f"{frontend_url}/login/callback?status=ok")
        else:
            # New user: create a verified LoginCode so the signup flow can proceed
            verified_code = LoginCode.objects.create(
                email=email,
                code=generate_user_code(),
                verified=True,
            )
            request.session["pending_login_code_id"] = verified_code.pk
            return HttpResponseRedirect(
                f"{frontend_url}/login/callback?status=signup_required"
            )


class UserInfoView(APIView):
    """Return the current authenticated user's info."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class CompleteSignupView(APIView):
    """Create the account after email has been verified.
    Only works if confirm_code or token_exchange already verified the email."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = CompleteSignupSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        first_name = serializer.validated_data["first_name"].strip()
        last_name = serializer.validated_data["last_name"].strip()

        if not first_name or not last_name:
            return Response({"error": "missing_fields"}, status=status.HTTP_400_BAD_REQUEST)

        login_code_id = request.session.get("pending_login_code_id")
        if not login_code_id:
            return Response({"error": "email_not_verified"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            login_code = LoginCode.objects.get(pk=login_code_id, verified=True)
        except LoginCode.DoesNotExist:
            return Response({"error": "email_not_verified"}, status=status.HTTP_400_BAD_REQUEST)

        email = login_code.email

        # Race condition guard
        if User.objects.filter(email=email).exists():
            login_code.used = True
            login_code.save(update_fields=["used"])
            request.session.pop("pending_login_code_id", None)
            return Response({"error": "email_taken"}, status=status.HTTP_409_CONFLICT)

        adapter = get_adapter()
        user = adapter.new_user(request)
        user_field(user, "email", email)
        user_field(user, "first_name", first_name)
        user_field(user, "last_name", last_name)
        user.set_unusable_password()
        user.save()

        EmailAddress.objects.create(user=user, email=email, verified=True, primary=True)

        login(
            request,
            user,
            backend="allauth.account.auth_backends.AuthenticationBackend",
        )

        login_code.used = True
        login_code.save(update_fields=["used"])
        request.session.pop("pending_login_code_id", None)

        return Response(UserSerializer(user).data)


class LatestCodeView(APIView):
    """DEBUG ONLY: Return the latest login code for an email. For e2e testing."""

    permission_classes = [AllowAny]

    def get(self, request):
        if not settings.DEBUG:
            return Response(status=status.HTTP_404_NOT_FOUND)
        email = request.query_params.get("email", "")
        login_code = LoginCode.objects.filter(email=email, used=False).first()
        if not login_code:
            return Response({"error": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        return Response({"code": login_code.code, "key": login_code.key})
