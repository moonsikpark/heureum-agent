# Copyright (c) 2026 Heureum AI. All rights reserved.

"""Tests for periodic_tasks REST API endpoints."""
import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from chat_messages.models import Session
from periodic_tasks.models import PeriodicTask, PeriodicTaskRun

User = get_user_model()

TEST_SESSION_ID = "test-session-periodic-123"
TEST_SCHEDULE = {"type": "cron", "cron": {"minute": 0, "hour": 9}}
TEST_RECIPE = {
    "version": 1,
    "objective": "Fetch NASDAQ report",
    "instructions": ["Fetch data", "Save report"],
    "tools_required": ["web_fetch"],
}


# ── Fixtures ──


@pytest.fixture
def user(db):
    return User.objects.create_user(email="testuser@example.com", password="testpass123")


@pytest.fixture
def other_user(db):
    return User.objects.create_user(email="other@example.com", password="otherpass123")


@pytest.fixture
def session(db, user):
    return Session.objects.create(session_id=TEST_SESSION_ID, user=user, title="Test Session")


@pytest.fixture
def api_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def other_client(other_user):
    client = APIClient()
    client.force_authenticate(user=other_user)
    return client


@pytest.fixture
def unauth_client():
    return APIClient()


@pytest.fixture
def task(db, user, session):
    t = PeriodicTask.objects.create(
        user=user,
        session_id=TEST_SESSION_ID,
        title="Daily NASDAQ Report",
        description="Fetch and save NASDAQ data",
        recipe=TEST_RECIPE,
        schedule=TEST_SCHEDULE,
        timezone_name="Asia/Seoul",
    )
    return t


@pytest.fixture
def task_with_runs(task):
    PeriodicTaskRun.objects.create(task=task, status="completed", output_summary="Done")
    PeriodicTaskRun.objects.create(task=task, status="failed", error_message="Timeout")
    return task


# ═══════════════════════════════════════════════════════════════════════════════
# List (GET /api/v1/periodic-tasks/)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestTaskList:
    def test_list_empty(self, api_client):
        resp = api_client.get("/api/v1/periodic-tasks/")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_returns_own_tasks(self, api_client, task):
        resp = api_client.get("/api/v1/periodic-tasks/")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["id"] == task.id
        assert data[0]["title"] == "Daily NASDAQ Report"
        assert data[0]["status"] == "active"

    def test_list_excludes_other_user_tasks(self, other_client, task):
        resp = other_client.get("/api/v1/periodic-tasks/")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_unauthenticated(self, unauth_client):
        resp = unauth_client.get("/api/v1/periodic-tasks/")
        assert resp.status_code in (401, 403)


# ═══════════════════════════════════════════════════════════════════════════════
# Create (POST /api/v1/periodic-tasks/)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestTaskCreate:
    def test_create_task(self, api_client, session):
        resp = api_client.post(
            "/api/v1/periodic-tasks/",
            {
                "session_id": TEST_SESSION_ID,
                "title": "New Task",
                "description": "A test task",
                "recipe": TEST_RECIPE,
                "schedule": TEST_SCHEDULE,
                "timezone_name": "Asia/Seoul",
            },
            format="json",
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "New Task"
        assert data["status"] == "active"
        assert data["id"].startswith("pt_")
        assert data["next_run_at"] is not None

    def test_create_task_missing_fields(self, api_client, session):
        resp = api_client.post(
            "/api/v1/periodic-tasks/",
            {"session_id": TEST_SESSION_ID},
            format="json",
        )
        assert resp.status_code == 400

    def test_create_task_invalid_session(self, api_client):
        resp = api_client.post(
            "/api/v1/periodic-tasks/",
            {
                "session_id": "nonexistent-session",
                "title": "Bad Task",
                "recipe": TEST_RECIPE,
                "schedule": TEST_SCHEDULE,
            },
            format="json",
        )
        assert resp.status_code == 404

    def test_create_task_default_timezone(self, api_client, session):
        resp = api_client.post(
            "/api/v1/periodic-tasks/",
            {
                "session_id": TEST_SESSION_ID,
                "title": "Default TZ Task",
                "recipe": TEST_RECIPE,
                "schedule": TEST_SCHEDULE,
            },
            format="json",
        )
        assert resp.status_code == 201
        assert resp.json()["timezone_name"] == "Asia/Seoul"


# ═══════════════════════════════════════════════════════════════════════════════
# Detail (GET/PATCH/DELETE /api/v1/periodic-tasks/<id>/)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestTaskDetail:
    def test_get_task(self, api_client, task):
        resp = api_client.get(f"/api/v1/periodic-tasks/{task.id}/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == task.id
        assert data["title"] == "Daily NASDAQ Report"

    def test_get_task_not_found(self, api_client):
        resp = api_client.get("/api/v1/periodic-tasks/pt_nonexistent/")
        assert resp.status_code == 404

    def test_get_task_other_user(self, other_client, task):
        resp = other_client.get(f"/api/v1/periodic-tasks/{task.id}/")
        assert resp.status_code == 404

    def test_patch_task_title(self, api_client, task):
        resp = api_client.patch(
            f"/api/v1/periodic-tasks/{task.id}/",
            {"title": "Updated Title"},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "Updated Title"

    def test_patch_task_schedule_recomputes_next_run(self, api_client, task):
        new_schedule = {"type": "cron", "cron": {"minute": 30, "hour": 10}}
        resp = api_client.patch(
            f"/api/v1/periodic-tasks/{task.id}/",
            {"schedule": new_schedule},
            format="json",
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["schedule"] == new_schedule
        assert data["next_run_at"] is not None

    def test_patch_task_ignores_disallowed_fields(self, api_client, task):
        resp = api_client.patch(
            f"/api/v1/periodic-tasks/{task.id}/",
            {"id": "pt_hacked", "user": 999},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.json()["id"] == task.id

    def test_delete_task(self, api_client, task):
        resp = api_client.delete(f"/api/v1/periodic-tasks/{task.id}/")
        assert resp.status_code == 204
        assert not PeriodicTask.objects.filter(id=task.id).exists()

    def test_delete_task_other_user(self, other_client, task):
        resp = other_client.delete(f"/api/v1/periodic-tasks/{task.id}/")
        assert resp.status_code == 404
        assert PeriodicTask.objects.filter(id=task.id).exists()


# ═══════════════════════════════════════════════════════════════════════════════
# Pause / Resume (POST /api/v1/periodic-tasks/<id>/pause/ and resume/)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestTaskPauseResume:
    def test_pause_task(self, api_client, task):
        resp = api_client.post(f"/api/v1/periodic-tasks/{task.id}/pause/")
        assert resp.status_code == 200
        assert resp.json()["status"] == "paused"

    def test_resume_task(self, api_client, task):
        task.status = "paused"
        task.consecutive_failures = 2
        task.save()

        resp = api_client.post(f"/api/v1/periodic-tasks/{task.id}/resume/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "active"
        assert data["consecutive_failures"] == 0
        assert data["next_run_at"] is not None

    def test_resume_failed_task(self, api_client, task):
        task.status = "failed"
        task.consecutive_failures = 3
        task.save()

        resp = api_client.post(f"/api/v1/periodic-tasks/{task.id}/resume/")
        assert resp.status_code == 200
        assert resp.json()["status"] == "active"

    def test_pause_not_found(self, api_client):
        resp = api_client.post("/api/v1/periodic-tasks/pt_nonexistent/pause/")
        assert resp.status_code == 404

    def test_pause_other_user(self, other_client, task):
        resp = other_client.post(f"/api/v1/periodic-tasks/{task.id}/pause/")
        assert resp.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════════
# Runs (GET /api/v1/periodic-tasks/<id>/runs/)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestTaskRuns:
    def test_list_runs(self, api_client, task_with_runs):
        resp = api_client.get(f"/api/v1/periodic-tasks/{task_with_runs.id}/runs/")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2

    def test_list_runs_empty(self, api_client, task):
        resp = api_client.get(f"/api/v1/periodic-tasks/{task.id}/runs/")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_runs_other_user(self, other_client, task_with_runs):
        resp = other_client.get(f"/api/v1/periodic-tasks/{task_with_runs.id}/runs/")
        assert resp.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════════
# Internal: due_tasks (GET /api/v1/periodic-tasks/due/)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestDueTasks:
    def test_due_tasks_returns_due(self, api_client, task):
        task.next_run_at = timezone.now() - timezone.timedelta(minutes=5)
        task.save(update_fields=["next_run_at"])

        resp = api_client.get("/api/v1/periodic-tasks/due/")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["id"] == task.id
        assert "user_id" in data[0]

    def test_due_tasks_excludes_future(self, api_client, task):
        task.next_run_at = timezone.now() + timezone.timedelta(hours=1)
        task.save(update_fields=["next_run_at"])

        resp = api_client.get("/api/v1/periodic-tasks/due/")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_due_tasks_excludes_paused(self, api_client, task):
        task.status = "paused"
        task.next_run_at = timezone.now() - timezone.timedelta(minutes=5)
        task.save(update_fields=["status", "next_run_at"])

        resp = api_client.get("/api/v1/periodic-tasks/due/")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_due_tasks_no_auth_required(self, unauth_client, task):
        task.next_run_at = timezone.now() - timezone.timedelta(minutes=5)
        task.save(update_fields=["next_run_at"])

        resp = unauth_client.get("/api/v1/periodic-tasks/due/")
        assert resp.status_code == 200


# ═══════════════════════════════════════════════════════════════════════════════
# Internal: create_run (POST /api/v1/periodic-tasks/<id>/runs/create/)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestCreateRun:
    def test_create_run(self, api_client, task):
        resp = api_client.post(
            f"/api/v1/periodic-tasks/{task.id}/runs/create/",
            {"attempt": 1},
            format="json",
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["id"].startswith("ptr_")
        assert data["status"] == "running"
        assert data["attempt"] == 1

    def test_create_run_retry(self, api_client, task):
        resp = api_client.post(
            f"/api/v1/periodic-tasks/{task.id}/runs/create/",
            {"attempt": 2},
            format="json",
        )
        assert resp.status_code == 201
        assert resp.json()["attempt"] == 2

    def test_create_run_not_found(self, api_client):
        resp = api_client.post(
            "/api/v1/periodic-tasks/pt_nonexistent/runs/create/",
            {},
            format="json",
        )
        assert resp.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════════
# Internal: update_run (PATCH /api/v1/periodic-tasks/runs/<id>/)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestUpdateRun:
    def test_update_run_complete(self, api_client, task):
        run = PeriodicTaskRun.objects.create(task=task, status="running")
        resp = api_client.patch(
            f"/api/v1/periodic-tasks/runs/{run.id}/",
            {"status": "completed", "output_summary": "Report saved", "total_tokens": 500},
            format="json",
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "completed"
        assert data["output_summary"] == "Report saved"
        assert data["total_tokens"] == 500
        assert data["completed_at"] is not None

    def test_update_run_fail(self, api_client, task):
        run = PeriodicTaskRun.objects.create(task=task, status="running")
        resp = api_client.patch(
            f"/api/v1/periodic-tasks/runs/{run.id}/",
            {"status": "failed", "error_message": "Timeout"},
            format="json",
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "failed"
        assert data["error_message"] == "Timeout"
        assert data["completed_at"] is not None

    def test_update_run_not_found(self, api_client):
        resp = api_client.patch(
            "/api/v1/periodic-tasks/runs/ptr_nonexistent/",
            {"status": "completed"},
            format="json",
        )
        assert resp.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════════
# Internal: mark_run_done (POST /api/v1/periodic-tasks/<id>/mark-run-done/)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestMarkRunDone:
    def test_mark_run_done_success(self, api_client, task):
        resp = api_client.post(
            f"/api/v1/periodic-tasks/{task.id}/mark-run-done/",
            {"success": True},
            format="json",
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_runs"] == 1
        assert data["total_successes"] == 1
        assert data["total_failures"] == 0
        assert data["consecutive_failures"] == 0
        assert data["status"] == "active"
        assert data["next_run_at"] is not None

    def test_mark_run_done_failure(self, api_client, task):
        resp = api_client.post(
            f"/api/v1/periodic-tasks/{task.id}/mark-run-done/",
            {"success": False},
            format="json",
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_runs"] == 1
        assert data["total_failures"] == 1
        assert data["consecutive_failures"] == 1
        assert data["status"] == "active"

    def test_mark_run_done_max_retries_reached(self, api_client, task):
        task.consecutive_failures = 2
        task.max_retries = 3
        task.save()

        resp = api_client.post(
            f"/api/v1/periodic-tasks/{task.id}/mark-run-done/",
            {"success": False},
            format="json",
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "failed"
        assert data["consecutive_failures"] == 3
        assert data["next_run_at"] is None

    def test_mark_run_done_resets_failures_on_success(self, api_client, task):
        task.consecutive_failures = 2
        task.save()

        resp = api_client.post(
            f"/api/v1/periodic-tasks/{task.id}/mark-run-done/",
            {"success": True},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.json()["consecutive_failures"] == 0

    def test_mark_run_done_not_found(self, api_client):
        resp = api_client.post(
            "/api/v1/periodic-tasks/pt_nonexistent/mark-run-done/",
            {"success": True},
            format="json",
        )
        assert resp.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════════
# Utils: compute_next_run
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestComputeNextRun:
    def test_cron_schedule(self):
        from periodic_tasks.utils import compute_next_run

        schedule = {"type": "cron", "cron": {"minute": 0, "hour": 9}}
        result = compute_next_run(schedule, "Asia/Seoul")
        assert result is not None
        assert result.tzinfo is not None

    def test_interval_schedule(self):
        from periodic_tasks.utils import compute_next_run

        schedule = {"type": "interval", "interval": {"every": 2, "unit": "hours"}}
        result = compute_next_run(schedule, "UTC")
        assert result is not None

    def test_unknown_schedule_type(self):
        from periodic_tasks.utils import compute_next_run

        with pytest.raises(ValueError, match="Unknown schedule type"):
            compute_next_run({"type": "unknown"}, "UTC")


# ═══════════════════════════════════════════════════════════════════════════════
# Internal: create task (POST /api/v1/periodic-tasks/internal/create/)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestInternalCreateTask:
    def test_create_no_auth(self, unauth_client, session):
        """Agent service can create tasks without authentication."""
        resp = unauth_client.post(
            "/api/v1/periodic-tasks/internal/create/",
            {
                "session_id": TEST_SESSION_ID,
                "title": "Agent Task",
                "description": "Created by agent",
                "recipe": TEST_RECIPE,
                "schedule": TEST_SCHEDULE,
                "timezone_name": "Asia/Seoul",
            },
            format="json",
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Agent Task"
        assert data["status"] == "active"
        assert data["id"].startswith("pt_")
        assert data["next_run_at"] is not None

    def test_create_assigns_session_user(self, unauth_client, session, user):
        """Task is assigned to the session's user."""
        resp = unauth_client.post(
            "/api/v1/periodic-tasks/internal/create/",
            {
                "session_id": TEST_SESSION_ID,
                "title": "User Check",
                "recipe": TEST_RECIPE,
                "schedule": TEST_SCHEDULE,
            },
            format="json",
        )
        assert resp.status_code == 201
        task = PeriodicTask.objects.get(id=resp.json()["id"])
        assert task.user_id == user.id

    def test_create_missing_fields(self, unauth_client, session):
        resp = unauth_client.post(
            "/api/v1/periodic-tasks/internal/create/",
            {"session_id": TEST_SESSION_ID},
            format="json",
        )
        assert resp.status_code == 400

    def test_create_invalid_session(self, unauth_client):
        resp = unauth_client.post(
            "/api/v1/periodic-tasks/internal/create/",
            {
                "session_id": "nonexistent-session",
                "title": "Bad Task",
                "recipe": TEST_RECIPE,
                "schedule": TEST_SCHEDULE,
            },
            format="json",
        )
        assert resp.status_code == 404

    def test_create_default_timezone(self, unauth_client, session):
        resp = unauth_client.post(
            "/api/v1/periodic-tasks/internal/create/",
            {
                "session_id": TEST_SESSION_ID,
                "title": "Default TZ",
                "recipe": TEST_RECIPE,
                "schedule": TEST_SCHEDULE,
            },
            format="json",
        )
        assert resp.status_code == 201
        assert resp.json()["timezone_name"] == "Asia/Seoul"


# ═══════════════════════════════════════════════════════════════════════════════
# Internal: list tasks (GET /api/v1/periodic-tasks/internal/list/)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestInternalListTasks:
    def test_list_no_auth(self, unauth_client, task, session):
        """Agent service can list tasks without authentication."""
        resp = unauth_client.get(
            "/api/v1/periodic-tasks/internal/list/",
            {"session_id": TEST_SESSION_ID},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["id"] == task.id

    def test_list_returns_all_user_tasks(self, unauth_client, user, session):
        """Returns all tasks for the session's user, not just that session."""
        other_session = Session.objects.create(
            session_id="other-session-456", user=user, title="Other"
        )
        PeriodicTask.objects.create(
            user=user, session_id="other-session-456",
            title="Task A", recipe=TEST_RECIPE, schedule=TEST_SCHEDULE,
        )
        PeriodicTask.objects.create(
            user=user, session_id=TEST_SESSION_ID,
            title="Task B", recipe=TEST_RECIPE, schedule=TEST_SCHEDULE,
        )
        resp = unauth_client.get(
            "/api/v1/periodic-tasks/internal/list/",
            {"session_id": TEST_SESSION_ID},
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_list_missing_session_id(self, unauth_client):
        resp = unauth_client.get("/api/v1/periodic-tasks/internal/list/")
        assert resp.status_code == 400

    def test_list_invalid_session(self, unauth_client):
        resp = unauth_client.get(
            "/api/v1/periodic-tasks/internal/list/",
            {"session_id": "nonexistent"},
        )
        assert resp.status_code == 404

    def test_list_empty(self, unauth_client, session):
        resp = unauth_client.get(
            "/api/v1/periodic-tasks/internal/list/",
            {"session_id": TEST_SESSION_ID},
        )
        assert resp.status_code == 200
        assert resp.json() == []


# ═══════════════════════════════════════════════════════════════════════════════
# Internal: update task (PATCH /api/v1/periodic-tasks/internal/<id>/update/)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestInternalUpdateTask:
    def test_update_status_no_auth(self, unauth_client, task):
        resp = unauth_client.patch(
            f"/api/v1/periodic-tasks/internal/{task.id}/update/",
            {"status": "completed"},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "completed"

    def test_update_schedule_recomputes(self, unauth_client, task):
        new_schedule = {"type": "cron", "cron": {"minute": 30, "hour": 15}}
        resp = unauth_client.patch(
            f"/api/v1/periodic-tasks/internal/{task.id}/update/",
            {"schedule": new_schedule},
            format="json",
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["schedule"] == new_schedule
        assert data["next_run_at"] is not None

    def test_update_not_found(self, unauth_client):
        resp = unauth_client.patch(
            "/api/v1/periodic-tasks/internal/pt_nonexistent/update/",
            {"status": "paused"},
            format="json",
        )
        assert resp.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════════
# Internal: resume task (POST /api/v1/periodic-tasks/internal/<id>/resume/)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestInternalResumeTask:
    def test_resume_no_auth(self, unauth_client, task):
        task.status = "paused"
        task.consecutive_failures = 2
        task.save()

        resp = unauth_client.post(
            f"/api/v1/periodic-tasks/internal/{task.id}/resume/"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "active"
        assert data["consecutive_failures"] == 0
        assert data["next_run_at"] is not None

    def test_resume_not_found(self, unauth_client):
        resp = unauth_client.post(
            "/api/v1/periodic-tasks/internal/pt_nonexistent/resume/"
        )
        assert resp.status_code == 404
