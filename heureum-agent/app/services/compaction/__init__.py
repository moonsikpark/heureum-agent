# Copyright (c) 2026 Heureum AI. All rights reserved.

"""
Context compaction module.

Provides multi-layered context overflow prevention following OpenClaw's
architecture:

  Layer 1 — Tool result truncation  (truncation.py)
      Cap individual tool results to a share of the context window.

  Layer 2 — Context pruning  (pruning.py)
      Soft-trim (head+tail) and hard-clear old tool results based on
      context utilisation ratio.

  Layer 3 — LLM compaction  (summarizer.py)
      Summarize conversation history when pruning alone is insufficient.
      Supports chunked, multi-stage, and incremental summarization.
      Includes orphaned tool_result repair (repair.py).

Usage (after agent integration):

    settings = CompactionSettings(context_window_tokens=128_000)

    # Layer 1
    messages, n = truncate_oversized_tool_results(messages, settings)

    # Layer 2
    messages = prune_context_messages(messages, settings)

    # Layer 3 (if still over budget)
    messages = await compact_history(messages, llm, settings)

Integration requirements (agent_service.py):
  The agent runner must wrap the LLM call in an overflow recovery loop:

    for attempt in range(MAX_OVERFLOW_ATTEMPTS):
        try:
            response = await llm.ainvoke(messages)
            break
        except ContextOverflowError:
            if attempt < MAX_OVERFLOW_ATTEMPTS - 1:
                messages = await compact_history(messages, llm, settings)
            else:
                messages, _ = truncate_oversized_tool_results(messages, settings)

  Reference: OpenClaw run.ts:473-598
"""

from app.services.compaction.pruning import prune_context_messages
from app.services.compaction.repair import RepairReport, repair_tool_use_result_pairing
from app.services.compaction.settings import (
    CompactionSettings,
    HardClearConfig,
    SoftTrimConfig,
)
from app.services.compaction.summarizer import (
    compact_history,
    summarize_in_stages,
    summarize_with_fallback,
)
from app.services.compaction.tokens import (
    estimate_context_chars,
    estimate_message_chars,
    estimate_message_tokens,
    estimate_messages_tokens,
    estimate_tokens,
)
from app.services.compaction.truncation import (
    calculate_max_tool_result_chars,
    has_oversized_tool_results,
    truncate_oversized_tool_results,
    truncate_tool_result_text,
)

__all__ = [
    "CompactionSettings",
    "SoftTrimConfig",
    "HardClearConfig",
    "estimate_tokens",
    "estimate_message_tokens",
    "estimate_messages_tokens",
    "estimate_message_chars",
    "estimate_context_chars",
    "truncate_tool_result_text",
    "calculate_max_tool_result_chars",
    "truncate_oversized_tool_results",
    "has_oversized_tool_results",
    "prune_context_messages",
    "repair_tool_use_result_pairing",
    "RepairReport",
    "compact_history",
    "summarize_with_fallback",
    "summarize_in_stages",
]
