# Copyright (c) 2026 Heureum AI. All rights reserved.

"""Tests for app.services.tool_chain — ToolChainRegistry."""

import json

from app.models import Message, ToolCallInfo
from app.schemas.open_responses import MessageRole
from app.services.tool_chain import ChainRule, ChainStep, ToolChainRegistry


# ---------------------------------------------------------------------------
# 1. Single-step chains (migrated from test_mcp_client.py)
# ---------------------------------------------------------------------------


class TestBuildSingleStep:
    def test_web_search_chains_web_fetch(self):
        """web_search results produce web_fetch calls for each URL."""
        registry = ToolChainRegistry()
        registry.register(
            ChainRule(
                source="web_search",
                steps=[
                    ChainStep(target="web_fetch", extract="results[*].url", arg_mapping={"url": "$value"}),
                ],
            )
        )
        search_result = json.dumps({
            "results": [
                {"url": "https://example.com/1", "title": "One"},
                {"url": "https://example.com/2", "title": "Two"},
            ]
        })
        executed = [ToolCallInfo(name="web_search", args={"query": "q"}, id="c1")]
        results = [Message(role=MessageRole.TOOL, content=search_result, tool_call_id="c1")]

        chained = registry.build(executed, results)

        assert len(chained) == 2
        assert all(tc.name == "web_fetch" for tc in chained)
        assert chained[0].args == {"url": "https://example.com/1"}
        assert chained[1].args == {"url": "https://example.com/2"}

    def test_non_search_tool_no_chain(self):
        registry = ToolChainRegistry()
        executed = [ToolCallInfo(name="calculator", args={}, id="c1")]
        results = [Message(role=MessageRole.TOOL, content="42", tool_call_id="c1")]

        assert registry.build(executed, results) == []

    def test_invalid_json_no_chain(self):
        registry = ToolChainRegistry()
        registry.register(
            ChainRule(
                source="web_search",
                steps=[ChainStep(target="web_fetch", extract="results[*].url", arg_mapping={"url": "$value"})],
            )
        )
        executed = [ToolCallInfo(name="web_search", args={"query": "q"}, id="c1")]
        results = [Message(role=MessageRole.TOOL, content="not json", tool_call_id="c1")]

        assert registry.build(executed, results) == []


# ---------------------------------------------------------------------------
# 2. Multi-step chain sequences
# ---------------------------------------------------------------------------


class TestBuildMultiStep:
    def _make_registry(self) -> ToolChainRegistry:
        registry = ToolChainRegistry()
        registry.register(
            ChainRule(
                source="web_search",
                steps=[
                    ChainStep(target="web_fetch", extract="results[*].url", arg_mapping={"url": "$value"}),
                    ChainStep(target="summarize", extract="content", arg_mapping={"text": "$value"}),
                ],
            )
        )
        return registry

    def test_first_step_returns_immediate_target(self):
        registry = self._make_registry()
        search_result = json.dumps({"results": [{"url": "https://example.com/1"}]})
        executed = [ToolCallInfo(name="web_search", args={"query": "q"}, id="c1")]
        results = [Message(role=MessageRole.TOOL, content=search_result, tool_call_id="c1")]

        chained = registry.build(executed, results, session_id="s1")

        assert len(chained) == 1
        assert chained[0].name == "web_fetch"

    def test_second_step_continues_chain(self):
        registry = self._make_registry()

        # Step 0: web_search → web_fetch
        search_result = json.dumps({"results": [{"url": "https://example.com/1"}]})
        step0 = registry.build(
            [ToolCallInfo(name="web_search", args={"query": "q"}, id="c1")],
            [Message(role=MessageRole.TOOL, content=search_result, tool_call_id="c1")],
            session_id="s1",
        )

        # Step 1: web_fetch → summarize
        fetch_result = json.dumps({"content": "Hello world"})
        step1 = registry.build(
            step0,
            [Message(role=MessageRole.TOOL, content=fetch_result, tool_call_id=step0[0].id)],
            session_id="s1",
        )

        assert len(step1) == 1
        assert step1[0].name == "summarize"
        assert step1[0].args == {"text": "Hello world"}

    def test_chain_completes_after_all_steps(self):
        registry = self._make_registry()

        # Step 0
        step0 = registry.build(
            [ToolCallInfo(name="web_search", args={"query": "q"}, id="c1")],
            [Message(role=MessageRole.TOOL, content=json.dumps({"results": [{"url": "https://x.com"}]}), tool_call_id="c1")],
            session_id="s1",
        )
        # Step 1
        step1 = registry.build(
            step0,
            [Message(role=MessageRole.TOOL, content=json.dumps({"content": "Hi"}), tool_call_id=step0[0].id)],
            session_id="s1",
        )
        # Step 2: after summarize, no more steps
        step2 = registry.build(
            step1,
            [Message(role=MessageRole.TOOL, content=json.dumps({"summary": "Brief"}), tool_call_id=step1[0].id)],
            session_id="s1",
        )

        assert step2 == []

    def test_clear_session_stops_chain(self):
        registry = self._make_registry()

        step0 = registry.build(
            [ToolCallInfo(name="web_search", args={"query": "q"}, id="c1")],
            [Message(role=MessageRole.TOOL, content=json.dumps({"results": [{"url": "https://x.com"}]}), tool_call_id="c1")],
            session_id="s1",
        )
        assert len(step0) == 1

        registry.clear_session("s1")

        # After clear, step[1] should NOT fire
        chained = registry.build(
            step0,
            [Message(role=MessageRole.TOOL, content=json.dumps({"content": "Hi"}), tool_call_id=step0[0].id)],
            session_id="s1",
        )
        assert chained == []


# ---------------------------------------------------------------------------
# 3. Registration
# ---------------------------------------------------------------------------


class TestRegistration:
    def test_register_and_clear(self):
        registry = ToolChainRegistry()
        registry.register(ChainRule(source="a", steps=[ChainStep(target="b", extract="x", arg_mapping={})]))
        assert "a" in registry.rules
        registry.clear()
        assert registry.rules == {}

    def test_register_many(self):
        registry = ToolChainRegistry()
        registry.register_many([
            ChainRule(source="a", steps=[ChainStep(target="b", extract="x", arg_mapping={})]),
            ChainRule(source="c", steps=[ChainStep(target="d", extract="y", arg_mapping={})]),
        ])
        assert "a" in registry.rules
        assert "c" in registry.rules


# ---------------------------------------------------------------------------
# 4. JSONPath resolver
# ---------------------------------------------------------------------------


class TestResolveJsonpath:
    def test_simple_key(self):
        assert ToolChainRegistry._resolve_jsonpath({"a": 1}, "a") == [1]

    def test_nested_key(self):
        assert ToolChainRegistry._resolve_jsonpath({"a": {"b": 2}}, "a.b") == [2]

    def test_wildcard_array(self):
        data = {"items": [{"v": 1}, {"v": 2}]}
        assert ToolChainRegistry._resolve_jsonpath(data, "items[*].v") == [1, 2]

    def test_missing_key(self):
        assert ToolChainRegistry._resolve_jsonpath({"a": 1}, "b") == []
