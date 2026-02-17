# Copyright (c) 2026 Heureum AI. All rights reserved.

"""Unit tests for app.services.prompts.base module."""

import pytest

from app.services.prompts.base import COMPACTION_PREFIX, HARD_CLEAR_PLACEHOLDER
from app.services.prompts.base import (
    AGENT_IDENTITY_PROMPT,
    _build_mcp_tools_prompt,
    build_system_prompt,
)


# ---------------------------------------------------------------------------
# TestBuildSystemPrompt
# ---------------------------------------------------------------------------

class TestBuildSystemPrompt:
    """Tests for build_system_prompt()."""

    def test_default_includes_identity(self):
        result = build_system_prompt(tool_names=[])
        assert "<identity>" in result
        assert "Heureum Agent" in result

    def test_no_tools_no_tool_guides(self):
        result = build_system_prompt(tool_names=[])
        assert "<tool_guide" not in result

    def test_ask_question_tool_included(self):
        result = build_system_prompt(tool_names=["ask_question"])
        assert '<tool_guide name="ask_question">' in result

    def test_bash_tool_included(self):
        result = build_system_prompt(tool_names=["bash"])
        assert '<tool_guide name="bash">' in result

    def test_browser_tools_included(self):
        result = build_system_prompt(tool_names=["browser_navigate"])
        assert '<tool_guide name="browser">' in result

    def test_browser_partial_match(self):
        result = build_system_prompt(tool_names=["browser_click"])
        assert '<tool_guide name="browser">' in result

    def test_mcp_tools_appended(self):
        mcp_tools = [
            {
                "function": {
                    "name": "web_search",
                    "description": "Search the web",
                    "parameters": {"properties": {}, "required": []},
                }
            }
        ]
        result = build_system_prompt(tool_names=[], mcp_tools=mcp_tools)
        assert "<tooling>" in result
        assert "web_search" in result

    def test_multiple_tools(self):
        mcp_tools = [
            {
                "function": {
                    "name": "web_search",
                    "description": "Search the web",
                    "parameters": {"properties": {}, "required": []},
                }
            }
        ]
        result = build_system_prompt(
            tool_names=["ask_question", "bash", "browser_navigate"],
            mcp_tools=mcp_tools,
        )
        assert '<tool_guide name="ask_question">' in result
        assert '<tool_guide name="bash">' in result
        assert '<tool_guide name="browser">' in result
        assert "<tooling>" in result


# ---------------------------------------------------------------------------
# TestBuildMcpToolsPrompt
# ---------------------------------------------------------------------------

class TestBuildMcpToolsPrompt:
    """Tests for _build_mcp_tools_prompt()."""

    def test_empty_returns_empty_string(self):
        assert _build_mcp_tools_prompt([]) == ""

    def test_single_tool_formatted(self):
        tools = [
            {
                "function": {
                    "name": "web_search",
                    "description": "Search the web",
                    "parameters": {"properties": {}, "required": []},
                }
            }
        ]
        result = _build_mcp_tools_prompt(tools)
        assert "<tooling>" in result
        assert "**web_search**" in result
        assert "Search the web" in result
        assert "</tooling>" in result

    def test_tool_with_parameters_and_required(self):
        tools = [
            {
                "function": {
                    "name": "fetch",
                    "description": "Fetch a URL",
                    "parameters": {
                        "properties": {
                            "url": {
                                "type": "string",
                                "description": "The URL to fetch",
                            },
                            "timeout": {
                                "type": "integer",
                                "description": "Timeout in seconds",
                            },
                        },
                        "required": ["url"],
                    },
                }
            }
        ]
        result = _build_mcp_tools_prompt(tools)
        assert "url: string (required)" in result
        assert "The URL to fetch" in result
        assert "timeout: integer" in result
        assert "(required)" not in result.split("timeout")[1].split("\n")[0] or "timeout: integer —" in result

    def test_tool_without_description(self):
        tools = [
            {
                "function": {
                    "name": "noop",
                    "parameters": {"properties": {}, "required": []},
                }
            }
        ]
        result = _build_mcp_tools_prompt(tools)
        assert "**noop**" in result


# ---------------------------------------------------------------------------
# TestPromptConstants
# ---------------------------------------------------------------------------

class TestPromptConstants:
    """Tests for module-level prompt constants."""

    def test_identity_contains_app_name(self):
        assert "Heureum Agent" in AGENT_IDENTITY_PROMPT

    def test_identity_contains_model(self):
        assert "gpt-4o-mini" in AGENT_IDENTITY_PROMPT

    def test_compaction_prefix_value(self):
        assert COMPACTION_PREFIX == "[compaction] Previous conversation summary:"

    def test_hard_clear_placeholder_value(self):
        assert HARD_CLEAR_PLACEHOLDER == "[Previous tool results have been cleared]"
