# Copyright (c) 2026 Heureum AI. All rights reserved.

from django.urls import path

from . import views

urlpatterns = [
    # User-facing
    path("", views.task_list_create, name="periodic-task-list-create"),

    # Internal — must come before <str:task_id>/ to avoid being captured as task_id
    path("due/", views.due_tasks, name="periodic-task-due"),
    path("runs/<str:run_id>/", views.update_run, name="periodic-task-update-run"),
    path("internal/create/", views.internal_create_task, name="periodic-task-internal-create"),
    path("internal/list/", views.internal_list_tasks, name="periodic-task-internal-list"),
    path("internal/<str:task_id>/update/", views.internal_update_task, name="periodic-task-internal-update"),
    path("internal/<str:task_id>/resume/", views.internal_resume_task, name="periodic-task-internal-resume"),

    # Per-task routes
    path("<str:task_id>/", views.task_detail, name="periodic-task-detail"),
    path("<str:task_id>/pause/", views.task_pause, name="periodic-task-pause"),
    path("<str:task_id>/resume/", views.task_resume, name="periodic-task-resume"),
    path("<str:task_id>/runs/", views.task_runs, name="periodic-task-runs"),
    path("<str:task_id>/runs/create/", views.create_run, name="periodic-task-create-run"),
    path("<str:task_id>/mark-run-done/", views.mark_run_done, name="periodic-task-mark-run-done"),
]
