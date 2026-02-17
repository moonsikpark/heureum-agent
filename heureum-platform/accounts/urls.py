# Copyright (c) 2026 Heureum AI. All rights reserved.

from django.urls import path

from accounts import views

urlpatterns = [
    path("login/confirm/", views.MagicLinkLoginView.as_view(), name="magic_link_login"),
    path("token/exchange/", views.TokenExchangeView.as_view(), name="token_exchange"),
    path("me/", views.UserInfoView.as_view(), name="user_info"),
    path("code/request/", views.RequestCodeView.as_view(), name="request_code"),
    path("code/confirm/", views.ConfirmCodeView.as_view(), name="confirm_code"),
    path("signup/complete/", views.CompleteSignupView.as_view(), name="complete_signup"),
    path("test/latest-code/", views.LatestCodeView.as_view(), name="latest_code"),
]
