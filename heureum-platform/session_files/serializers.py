# Copyright (c) 2026 Heureum AI. All rights reserved.

from rest_framework import serializers

from .models import SessionFile


class SessionFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = SessionFile
        fields = [
            "id", "path", "filename", "content_type", "size",
            "is_text", "text_content", "created_by", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "filename", "size", "is_text", "created_at", "updated_at",
        ]


class SessionFileListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for file listings (no text_content)."""

    class Meta:
        model = SessionFile
        fields = [
            "id", "path", "filename", "content_type", "size",
            "is_text", "created_by", "created_at", "updated_at",
        ]
