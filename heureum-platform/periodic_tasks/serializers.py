# Copyright (c) 2026 Heureum AI. All rights reserved.

from rest_framework import serializers

from .models import PeriodicTask, PeriodicTaskRun


class PeriodicTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = PeriodicTask
        fields = [
            "id",
            "session_id",
            "title",
            "description",
            "recipe",
            "schedule",
            "timezone_name",
            "status",
            "notify_on_success",
            "max_retries",
            "consecutive_failures",
            "next_run_at",
            "last_run_at",
            "total_runs",
            "total_successes",
            "total_failures",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "consecutive_failures",
            "next_run_at",
            "last_run_at",
            "total_runs",
            "total_successes",
            "total_failures",
            "created_at",
            "updated_at",
        ]


class PeriodicTaskCreateSerializer(serializers.Serializer):
    session_id = serializers.CharField()
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, default="")
    recipe = serializers.JSONField()
    schedule = serializers.JSONField()
    timezone_name = serializers.CharField(required=False, default="Asia/Seoul")
    notify_on_success = serializers.BooleanField(required=False, default=True)


class PeriodicTaskRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = PeriodicTaskRun
        fields = [
            "id",
            "task_id",
            "status",
            "attempt",
            "output_summary",
            "error_message",
            "files_created",
            "input_tokens",
            "output_tokens",
            "total_tokens",
            "total_cost",
            "iterations",
            "tool_calls_count",
            "started_at",
            "completed_at",
        ]
        read_only_fields = ["id", "started_at"]
