# Copyright (c) 2026 Heureum AI. All rights reserved.

from django.contrib import admin

from .models import PeriodicTask, PeriodicTaskRun


@admin.register(PeriodicTask)
class PeriodicTaskAdmin(admin.ModelAdmin):
    list_display = ["id", "title", "status", "next_run_at", "total_runs", "created_at"]
    list_filter = ["status"]
    search_fields = ["title", "session_id"]


@admin.register(PeriodicTaskRun)
class PeriodicTaskRunAdmin(admin.ModelAdmin):
    list_display = ["id", "task", "status", "attempt", "started_at", "completed_at"]
    list_filter = ["status"]
