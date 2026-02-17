# Copyright (c) 2026 Heureum AI. All rights reserved.

"""Tool chain registry — generic multi-step tool chaining abstraction.

Chain rules define how the output of one tool triggers a sequence of
follow-up tool calls.  Rules are registered from any source (MCP metadata,
static config, programmatic registration) and the registry builds the
follow-up ``ToolCallInfo`` list step-by-step after each tool execution.

Example — web_search → web_fetch → summarize:

    ChainRule(
        source="web_search",
        steps=[
            ChainStep(target="web_fetch",  extract="results[*].url", arg_mapping={"url": "$value"}),
            ChainStep(target="summarize",  extract="content",        arg_mapping={"text": "$value"}),
        ],
    )
"""

import json
import logging
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from app.models import Message, ToolCallInfo

logger = logging.getLogger(__name__)


def _gen_call_id() -> str:
    return f"call_{uuid.uuid4().hex[:16]}"


@dataclass(frozen=True)
class ChainStep:
    """A single step in a tool chain sequence.

    Attributes:
        target: Name of the target tool to invoke.
        extract: JSONPath expression to extract values from the previous
            step's result.
        arg_mapping: Mapping of target parameter names to extracted values.
            Use ``"$value"`` as a placeholder for the extracted value.
    """

    target: str
    extract: str
    arg_mapping: Dict[str, str]


@dataclass(frozen=True)
class ChainRule:
    """A multi-step tool chain starting from a source tool.

    Attributes:
        source: Name of the source tool whose output triggers chaining.
        steps: Ordered sequence of follow-up steps. After the source tool
            executes, step[0] runs using the source's result. After step[0]
            executes, step[1] runs using step[0]'s result, and so on.
    """

    source: str
    steps: List[ChainStep] = field(default_factory=list)


class ToolChainRegistry:
    """Registry of tool chain rules.

    Collects rules from any source and generates follow-up tool calls
    after tool execution.  For multi-step chains, tracks which step
    each active chain is on via ``_active_chains``.
    """

    def __init__(self) -> None:
        self._rules: Dict[str, List[ChainRule]] = {}  # source_tool -> rules
        # session_id -> list of (rule, current_step_index)
        self._active_chains: Dict[str, List[Tuple[ChainRule, int]]] = {}

    def register(self, rule: ChainRule) -> None:
        """Register a single chain rule."""
        self._rules.setdefault(rule.source, []).append(rule)

    def register_many(self, rules: List[ChainRule]) -> None:
        """Register multiple chain rules at once."""
        for rule in rules:
            self.register(rule)

    def clear(self) -> None:
        """Remove all registered rules."""
        self._rules.clear()

    def clear_session(self, session_id: str) -> None:
        """Remove active chain state for a session."""
        self._active_chains.pop(session_id, None)

    @property
    def rules(self) -> Dict[str, List[ChainRule]]:
        """Read-only access to registered rules."""
        return self._rules

    def build(
        self,
        executed_calls: List[ToolCallInfo],
        tool_results: List[Message],
        session_id: Optional[str] = None,
    ) -> List[ToolCallInfo]:
        """Generate the next follow-up tool calls from executed results.

        Handles two sources of chained calls:
          1. New chains: executed tool matches a registered rule's source.
          2. Active chains: executed tool matches an in-progress chain's
             current step (continuing the sequence).

        Args:
            executed_calls: Tool calls that were just executed.
            tool_results: Corresponding tool result messages (same order).
            session_id: Session ID for tracking multi-step chain progress.

        Returns:
            List of follow-up ToolCallInfo to execute next.
        """
        chained: List[ToolCallInfo] = []
        new_active: List[Tuple[ChainRule, int]] = []

        for tc, result_msg in zip(executed_calls, tool_results):
            # 1) Check for new chains triggered by this tool
            rules = self._rules.get(tc.name, [])
            for rule in rules:
                if not rule.steps:
                    continue
                step = rule.steps[0]
                for args in self._extract_chain_args(result_msg.content, step):
                    chained.append(
                        ToolCallInfo(name=step.target, args=args, id=_gen_call_id())
                    )
                # Track remaining steps
                if len(rule.steps) > 1:
                    new_active.append((rule, 1))

            # 2) Check for active chains continuing from this tool
            if session_id:
                remaining = []
                for rule, step_idx in self._active_chains.get(session_id, []):
                    if step_idx >= len(rule.steps):
                        continue
                    expected_target = rule.steps[step_idx - 1].target if step_idx > 0 else rule.source
                    if tc.name != expected_target:
                        remaining.append((rule, step_idx))
                        continue
                    step = rule.steps[step_idx]
                    for args in self._extract_chain_args(result_msg.content, step):
                        chained.append(
                            ToolCallInfo(name=step.target, args=args, id=_gen_call_id())
                        )
                    if step_idx + 1 < len(rule.steps):
                        new_active.append((rule, step_idx + 1))
                # Replace with remaining (unmatched) + newly queued
                remaining.extend(new_active)
                if remaining:
                    self._active_chains[session_id] = remaining
                else:
                    self._active_chains.pop(session_id, None)
                new_active = []

        # If no session_id, just store new_active chains won't be tracked
        return chained

    @staticmethod
    def _extract_chain_args(
        result_json: str, step: ChainStep
    ) -> List[Dict[str, Any]]:
        """Extract chained tool arguments from a result using a chain step.

        Args:
            result_json: JSON string from the previous tool's output.
            step: Chain step with extract path and arg mapping.

        Returns:
            List of argument dicts for the target tool.
        """
        try:
            data = json.loads(result_json)
        except (json.JSONDecodeError, TypeError):
            return []

        values = ToolChainRegistry._resolve_jsonpath(data, step.extract)
        return [
            {k: (val if v == "$value" else v) for k, v in step.arg_mapping.items()}
            for val in values
        ]

    @staticmethod
    def _resolve_jsonpath(data: Any, path: str) -> List[Any]:
        """Resolve a minimal JSONPath expression.

        Supports dot notation with ``[*]`` wildcard for arrays.
        Example: ``"results[*].url"`` extracts the ``url`` field from each
        element of the ``results`` array.
        """
        parts = path.replace("[*]", ".[*]").split(".")
        current: List[Any] = [data]
        for part in parts:
            if not part:
                continue
            next_vals: List[Any] = []
            for item in current:
                if part == "[*]" and isinstance(item, list):
                    next_vals.extend(item)
                elif isinstance(item, dict) and part in item:
                    next_vals.append(item[part])
            current = next_vals
        return current
