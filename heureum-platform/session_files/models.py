# Copyright (c) 2026 Heureum AI. All rights reserved.

import uuid

from django.db import models


class SessionFile(models.Model):
    id = models.CharField(max_length=255, primary_key=True, editable=False)
    session = models.ForeignKey(
        "chat_messages.Session",
        on_delete=models.CASCADE,
        related_name="files",
        to_field="session_id",
    )
    path = models.CharField(max_length=1024, db_index=True)
    filename = models.CharField(max_length=255)
    content_type = models.CharField(max_length=255, default="application/octet-stream")
    size = models.BigIntegerField(default=0)
    text_content = models.TextField(null=True, blank=True)
    is_text = models.BooleanField(default=False)
    created_by = models.CharField(
        max_length=20,
        choices=[("user", "User"), ("agent", "Agent")],
        default="user",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("session", "path")]
        ordering = ["path"]

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"sf_{uuid.uuid4().hex}"
        self.filename = self.path.rsplit("/", 1)[-1]
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.session_id}:{self.path}"
