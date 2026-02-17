# Copyright (c) 2026 Heureum AI. All rights reserved.

"""Tests for proxy view: user-message deduplication and todo persistence."""
import json
from unittest.mock import patch, MagicMock

import pytest
from rest_framework.test import APIClient

from chat_messages.models import Message, Response as ResponseModel, Session


TEST_SESSION_ID = "test-session-proxy-dedup"

# Minimal agent response returned by the mocked httpx stream
AGENT_RESPONSE = {
    "id": "resp_mock",
    "status": "completed",
    "model": "test-model",
    "output": [
        {
            "type": "message",
            "role": "assistant",
            "content": [{"type": "output_text", "text": "Hello!"}],
            "status": "completed",
        }
    ],
    "usage": {"input_tokens": 10, "output_tokens": 5, "total_tokens": 15},
    "metadata": {"session_id": TEST_SESSION_ID},
}

SAMPLE_TODO = {
    "task": "Set up notifications",
    "steps": [
        {"description": "Install dependencies", "status": "completed", "result": "Done"},
        {"description": "Configure provider", "status": "in_progress", "result": None},
        {"description": "Test delivery", "status": "pending", "result": None},
    ],
}


def _build_sse_body(response_data: dict, extra_events: list[dict] | None = None) -> str:
    """Build an SSE response body that the proxy can parse."""
    lines = []
    lines.append(f"data: {json.dumps({'type': 'response.created', 'response': response_data})}")
    for evt in (extra_events or []):
        lines.append(f"data: {json.dumps(evt)}")
    lines.append(f"data: {json.dumps({'type': 'response.completed', 'response': response_data})}")
    lines.append("data: [DONE]")
    return "\n".join(lines)


class _FakeStreamResponse:
    """Mock for httpx streaming response context manager."""

    def __init__(self, response_data, extra_events=None):
        self._body = _build_sse_body(response_data, extra_events)

    def raise_for_status(self):
        pass

    def iter_lines(self):
        return iter(self._body.split("\n"))

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass


class _FakeHTTPClient:
    """Mock httpx.Client that returns a fake streaming response."""

    def __init__(self, response_data, extra_events=None):
        self._response_data = response_data
        self._extra_events = extra_events

    def stream(self, *args, **kwargs):
        return _FakeStreamResponse(self._response_data, self._extra_events)

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass


def _make_initial_request_payload(user_text: str = "Hello") -> dict:
    """Build request payload for an initial user message (no tool results)."""
    return {
        "input": [
            {
                "type": "message",
                "role": "user",
                "content": [{"type": "input_text", "text": user_text}],
            }
        ],
        "stream": True,
        "metadata": {"session_id": TEST_SESSION_ID},
    }


def _make_followup_request_payload(user_text: str = "Hello") -> dict:
    """Build request payload for a follow-up with tool results (user msg re-sent as context)."""
    return {
        "input": [
            # Original user message re-sent as context
            {
                "type": "message",
                "role": "user",
                "content": [{"type": "input_text", "text": user_text}],
            },
            # Tool call from previous round
            {
                "type": "function_call",
                "call_id": "call_abc123",
                "name": "bash",
                "arguments": '{"command": "ls"}',
            },
            # Tool result from previous round
            {
                "type": "function_call_output",
                "call_id": "call_abc123",
                "output": "file1.txt\nfile2.txt",
            },
        ],
        "stream": True,
        "metadata": {"session_id": TEST_SESSION_ID},
    }


# ── Fixtures ──


@pytest.fixture
def api_client(db):
    return APIClient()


@pytest.fixture
def session(db):
    return Session.objects.create(session_id=TEST_SESSION_ID, title="Test Dedup")


# ═══════════════════════════════════════════════════════════════════════════════
# User message deduplication tests
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestUserMessageDeduplication:

    def _post_proxy(self, api_client, payload):
        """POST to the proxy endpoint with mocked agent backend."""
        with patch("proxy.views.httpx.Client", return_value=_FakeHTTPClient(AGENT_RESPONSE)):
            resp = api_client.post(
                "/api/v1/proxy/",
                payload,
                format="json",
            )
        return resp

    def test_initial_request_stores_user_message(self, api_client, session):
        """An initial request (no tool results) should store exactly 1 user message."""
        payload = _make_initial_request_payload("Hi there")
        resp = self._post_proxy(api_client, payload)

        assert resp.status_code == 200

        user_msgs = Message.objects.filter(
            session_id=TEST_SESSION_ID,
            role="user",
            type="message",
        )
        assert user_msgs.count() == 1
        assert user_msgs.first().get_text_content() == "Hi there"

    def test_followup_request_does_not_duplicate_user_message(self, api_client, session):
        """A follow-up request (with tool results) should NOT create another user message."""
        # First: initial request creates the user message
        self._post_proxy(api_client, _make_initial_request_payload("Hi there"))
        assert Message.objects.filter(
            session_id=TEST_SESSION_ID, role="user", type="message"
        ).count() == 1

        # Second: follow-up with tool results — user message is just context
        self._post_proxy(api_client, _make_followup_request_payload("Hi there"))

        # Should still be exactly 1 user message
        user_msgs = Message.objects.filter(
            session_id=TEST_SESSION_ID, role="user", type="message"
        )
        assert user_msgs.count() == 1

    def test_multiple_followup_rounds_no_duplication(self, api_client, session):
        """Simulating 3 rounds of tool execution — user message count stays at 1."""
        # Round 1: initial
        self._post_proxy(api_client, _make_initial_request_payload("Do something"))

        # Rounds 2-4: follow-ups
        for _ in range(3):
            self._post_proxy(api_client, _make_followup_request_payload("Do something"))

        user_msgs = Message.objects.filter(
            session_id=TEST_SESSION_ID, role="user", type="message"
        )
        assert user_msgs.count() == 1

    def test_function_call_items_still_stored_on_followup(self, api_client, session):
        """function_call and function_call_output items should still be persisted on follow-up."""
        # Initial request
        self._post_proxy(api_client, _make_initial_request_payload("Hi"))

        # Follow-up with tool results
        self._post_proxy(api_client, _make_followup_request_payload("Hi"))

        # function_call and function_call_output from INPUT should be stored
        fc_msgs = Message.objects.filter(
            session_id=TEST_SESSION_ID, type="function_call"
        )
        fco_msgs = Message.objects.filter(
            session_id=TEST_SESSION_ID, type="function_call_output"
        )
        assert fc_msgs.count() >= 1
        assert fco_msgs.count() >= 1

    def test_new_user_message_in_separate_turn_is_stored(self, api_client, session):
        """A genuinely new user message (no tool results) should still be stored."""
        # First message
        self._post_proxy(api_client, _make_initial_request_payload("First message"))
        assert Message.objects.filter(
            session_id=TEST_SESSION_ID, role="user", type="message"
        ).count() == 1

        # Second message (new turn, no tool results)
        self._post_proxy(api_client, _make_initial_request_payload("Second message"))
        assert Message.objects.filter(
            session_id=TEST_SESSION_ID, role="user", type="message"
        ).count() == 2


# ═══════════════════════════════════════════════════════════════════════════════
# Todo state persistence tests
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestTodoStatePersistence:

    def _post_proxy_with_todo(self, api_client, todo_events):
        """POST to proxy with mocked agent that emits todo SSE events."""
        payload = _make_initial_request_payload("Create a plan")
        extra = [{"type": "response.todo.updated", "todo": t} for t in todo_events]
        with patch(
            "proxy.views.httpx.Client",
            return_value=_FakeHTTPClient(AGENT_RESPONSE, extra_events=extra),
        ):
            resp = api_client.post("/api/v1/proxy/", payload, format="json")
            # Consume streaming content INSIDE the mock context so the
            # generator uses the mocked httpx.Client and runs to completion
            # (including the _persist_output call at the end).
            if hasattr(resp, "streaming_content"):
                b"".join(resp.streaming_content)
        return resp

    def test_todo_state_persisted_from_streaming(self, api_client, session):
        """A response.todo.updated SSE event should be persisted as a todo_state Message."""
        resp = self._post_proxy_with_todo(api_client, [SAMPLE_TODO])
        assert resp.status_code == 200

        todo_msgs = Message.objects.filter(
            session_id=TEST_SESSION_ID, type="todo_state"
        )
        assert todo_msgs.count() == 1

    def test_todo_state_contains_correct_data(self, api_client, session):
        """The persisted todo_state should have the correct task and steps."""
        self._post_proxy_with_todo(api_client, [SAMPLE_TODO])

        todo_msg = Message.objects.get(
            session_id=TEST_SESSION_ID, type="todo_state"
        )
        content = todo_msg.content
        assert content["task"] == "Set up notifications"
        assert len(content["steps"]) == 3
        assert content["steps"][0]["status"] == "completed"
        assert content["steps"][1]["status"] == "in_progress"

    def test_only_last_todo_state_persisted(self, api_client, session):
        """Multiple todo events in one stream should result in only the last being persisted."""
        early_todo = {
            "task": "Set up notifications",
            "steps": [
                {"description": "Step 1", "status": "in_progress", "result": None},
            ],
        }
        final_todo = {
            "task": "Set up notifications",
            "steps": [
                {"description": "Step 1", "status": "completed", "result": "Done"},
                {"description": "Step 2", "status": "in_progress", "result": None},
            ],
        }
        self._post_proxy_with_todo(api_client, [early_todo, final_todo])

        todo_msgs = Message.objects.filter(
            session_id=TEST_SESSION_ID, type="todo_state"
        )
        assert todo_msgs.count() == 1
        content = todo_msgs.first().content
        # Should be the FINAL state, not the early one
        assert len(content["steps"]) == 2
        assert content["steps"][0]["status"] == "completed"

    def test_no_todo_state_when_no_todo_events(self, api_client, session):
        """When no todo events are emitted, no todo_state Message should be created."""
        payload = _make_initial_request_payload("Hello")
        with patch(
            "proxy.views.httpx.Client",
            return_value=_FakeHTTPClient(AGENT_RESPONSE),
        ):
            api_client.post("/api/v1/proxy/", payload, format="json")

        todo_msgs = Message.objects.filter(
            session_id=TEST_SESSION_ID, type="todo_state"
        )
        assert todo_msgs.count() == 0
