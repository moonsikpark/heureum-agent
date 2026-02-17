# Copyright (c) 2026 Heureum AI. All rights reserved.

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class PeriodicTask(models.Model):
    STATUS_CHOICES = [
        ("active", "Active"),
        ("paused", "Paused"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    ]

    id = models.CharField(max_length=255, primary_key=True, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="periodic_tasks",
    )
    session_id = models.CharField(max_length=255, db_index=True)

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")

    recipe = models.JSONField(default=dict)
    schedule = models.JSONField(default=dict)
    timezone_name = models.CharField(max_length=64, default="Asia/Seoul")

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    notify_on_success = models.BooleanField(default=True)
    max_retries = models.IntegerField(default=3)
    consecutive_failures = models.IntegerField(default=0)

    next_run_at = models.DateTimeField(null=True, blank=True, db_index=True)
    last_run_at = models.DateTimeField(null=True, blank=True)
    total_runs = models.IntegerField(default=0)
    total_successes = models.IntegerField(default=0)
    total_failures = models.IntegerField(default=0)

    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["status", "next_run_at"]),
        ]

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"pt_{uuid.uuid4().hex}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.title} ({self.status})"


class PeriodicTaskRun(models.Model):
    STATUS_CHOICES = [
        ("running", "Running"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    ]

    id = models.CharField(max_length=255, primary_key=True, editable=False)
    task = models.ForeignKey(
        PeriodicTask,
        on_delete=models.CASCADE,
        related_name="runs",
    )

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="running")
    attempt = models.IntegerField(default=1)

    output_summary = models.TextField(blank=True, default="")
    error_message = models.TextField(blank=True, default="")
    files_created = models.JSONField(default=list)

    input_tokens = models.IntegerField(default=0)
    output_tokens = models.IntegerField(default=0)
    total_tokens = models.IntegerField(default=0)
    total_cost = models.DecimalField(max_digits=12, decimal_places=6, default=0)

    iterations = models.IntegerField(default=0)
    tool_calls_count = models.IntegerField(default=0)

    started_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["task", "-started_at"]),
        ]

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"ptr_{uuid.uuid4().hex}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Run {self.id} ({self.status})"
