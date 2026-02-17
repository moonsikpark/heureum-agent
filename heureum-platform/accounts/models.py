# Copyright (c) 2026 Heureum AI. All rights reserved.

import datetime
import secrets

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields["is_staff"] = True
        extra_fields["is_superuser"] = True
        if not password:
            raise ValueError("Superusers must have a password")
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.email

    def get_full_name(self):
        full_name = f"{self.first_name} {self.last_name}".strip()
        return full_name or self.email

    def get_short_name(self):
        return self.first_name or self.email


class LoginCode(models.Model):
    """Database-backed login verification code, replacing session storage."""

    CLIENT_WEB = "web"
    CLIENT_ELECTRON = "electron"
    CLIENT_MOBILE = "mobile"
    CLIENT_CHOICES = [
        (CLIENT_WEB, "Web"),
        (CLIENT_ELECTRON, "Electron"),
        (CLIENT_MOBILE, "Mobile"),
    ]

    key = models.CharField(max_length=64, unique=True, db_index=True, default=secrets.token_urlsafe)
    email = models.EmailField(db_index=True)
    code = models.CharField(max_length=20)
    client = models.CharField(max_length=16, choices=CLIENT_CHOICES, default=CLIENT_WEB)
    created_at = models.DateTimeField(auto_now_add=True)
    attempts = models.IntegerField(default=0)
    verified = models.BooleanField(default=False)
    used = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["email", "used", "created_at"]),
        ]

    def is_expired(self):
        return timezone.now() - self.created_at > datetime.timedelta(seconds=300)

    def __str__(self):
        return f"LoginCode({self.email}, used={self.used})"


