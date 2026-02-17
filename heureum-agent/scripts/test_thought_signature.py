# Copyright (c) 2026 Heureum AI. All rights reserved.

"""
Minimal reproduction: Gemini "Thought signature is not valid" error.

Tests whether replaying AIMessage(tool_calls) + ToolMessage in history
triggers the error on the second LLM call.
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

os.environ.setdefault(
    "GOOGLE_APPLICATION_CREDENTIALS",
    os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", ""),
)

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import (
    AIMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)

MODEL = os.environ.get("AGENT_MODEL", "gemini-3-flash-preview")
PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT", "")
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "global")

tool_schema = {
    "type": "function",
    "function": {
        "name": "browser_navigate",
        "description": "Navigate to a URL",
        "parameters": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "URL to navigate to"}
            },
            "required": ["url"],
        },
    },
}


def create_llm():
    return ChatGoogleGenerativeAI(
        model=MODEL,
        vertexai=True,
        project=PROJECT,
        location=LOCATION,
        temperature=0.7,
        max_output_tokens=2000,
    )


async def test_case(name: str, messages: list, tools: list):
    """Run a single test case."""
    llm = create_llm()
    print(f"\n{'='*60}")
    print(f"TEST: {name}")
    print(f"{'='*60}")
    for i, m in enumerate(messages):
        tc = getattr(m, "tool_calls", None)
        tc_id = getattr(m, "tool_call_id", None)
        extra = ""
        if tc:
            extra = f" tool_calls={[c['name'] for c in tc]}"
        if tc_id:
            extra = f" tool_call_id={tc_id}"
        print(f"  [{i}] {m.__class__.__name__}: {str(m.content)[:80]}{extra}")
    print(f"  tools_bound: {bool(tools)}")
    print()

    try:
        if tools:
            resp = await llm.bind_tools(tools).ainvoke(messages)
        else:
            resp = await llm.ainvoke(messages)
        text = resp.content[:120] if resp.content else "(no content)"
        tc = getattr(resp, "tool_calls", [])
        print(f"  SUCCESS: {text}")
        if tc:
            print(f"  tool_calls: {[c['name'] for c in tc]}")
        return resp
    except Exception as e:
        print(f"  FAILED: {e}")
        return None


async def main():
    llm = create_llm()

    # ---------------------------------------------------------------
    # Step 1: Get a real AIMessage with tool_calls from Gemini
    # ---------------------------------------------------------------
    print("\n" + "=" * 60)
    print("STEP 1: Get initial tool call from Gemini")
    print("=" * 60)

    initial_messages = [
        SystemMessage(content="You are a helpful assistant."),
        HumanMessage(content="쿠팡 열어줘"),
    ]

    resp1 = await llm.bind_tools([tool_schema]).ainvoke(initial_messages)
    print(f"  Response: content={resp1.content[:80] if resp1.content else '(none)'}")
    print(f"  tool_calls: {resp1.tool_calls}")

    if not resp1.tool_calls:
        print("  No tool call returned; cannot continue test")
        return

    tool_call_id = resp1.tool_calls[0]["id"]

    # ---------------------------------------------------------------
    # Test A: Replay original AIMessage + ToolMessage + tools bound
    # ---------------------------------------------------------------
    await test_case(
        "A: Original AIMessage(tool_calls) + ToolMessage, WITH tools",
        [
            SystemMessage(content="You are a helpful assistant."),
            HumanMessage(content="쿠팡 열어줘"),
            resp1,  # Original AIMessage with tool_calls
            ToolMessage(
                content="Error: Chrome extension is not connected.",
                tool_call_id=tool_call_id,
            ),
        ],
        [tool_schema],
    )

    # ---------------------------------------------------------------
    # Test B: Replay original AIMessage + ToolMessage + NO tools
    # ---------------------------------------------------------------
    await test_case(
        "B: Original AIMessage(tool_calls) + ToolMessage, WITHOUT tools",
        [
            SystemMessage(content="You are a helpful assistant."),
            HumanMessage(content="쿠팡 열어줘"),
            resp1,  # Original AIMessage with tool_calls
            ToolMessage(
                content="Error: Chrome extension is not connected.",
                tool_call_id=tool_call_id,
            ),
        ],
        [],
    )

    # ---------------------------------------------------------------
    # Test C: Fresh AIMessage (reconstructed) + ToolMessage, WITH tools
    # ---------------------------------------------------------------
    fresh_ai = AIMessage(
        content="",
        tool_calls=resp1.tool_calls,
    )
    await test_case(
        "C: Fresh AIMessage(tool_calls) + ToolMessage, WITH tools",
        [
            SystemMessage(content="You are a helpful assistant."),
            HumanMessage(content="쿠팡 열어줘"),
            fresh_ai,
            ToolMessage(
                content="Error: Chrome extension is not connected.",
                tool_call_id=tool_call_id,
            ),
        ],
        [tool_schema],
    )

    # ---------------------------------------------------------------
    # Test D: Fresh AIMessage (reconstructed) + ToolMessage, NO tools
    # ---------------------------------------------------------------
    await test_case(
        "D: Fresh AIMessage(tool_calls) + ToolMessage, WITHOUT tools",
        [
            SystemMessage(content="You are a helpful assistant."),
            HumanMessage(content="쿠팡 열어줘"),
            fresh_ai,
            ToolMessage(
                content="Error: Chrome extension is not connected.",
                tool_call_id=tool_call_id,
            ),
        ],
        [],
    )

    # ---------------------------------------------------------------
    # Test E: Stripped original → keep original but remove thought metadata
    # ---------------------------------------------------------------
    stripped_ai = AIMessage(
        content=resp1.content or "",
        tool_calls=resp1.tool_calls,
        # Intentionally NOT copying response_metadata or additional_kwargs
    )
    await test_case(
        "E: Stripped AIMessage (no response_metadata) + ToolMessage, WITH tools",
        [
            SystemMessage(content="You are a helpful assistant."),
            HumanMessage(content="쿠팡 열어줘"),
            stripped_ai,
            ToolMessage(
                content="Error: Chrome extension is not connected.",
                tool_call_id=tool_call_id,
            ),
        ],
        [tool_schema],
    )

    # ---------------------------------------------------------------
    # Test F: What's in resp1 metadata?
    # ---------------------------------------------------------------
    print(f"\n{'='*60}")
    print("METADATA INSPECTION (original resp1)")
    print(f"{'='*60}")
    print(f"  type: {type(resp1)}")
    print(f"  content: {resp1.content[:120] if resp1.content else '(none)'}")
    print(f"  tool_calls: {resp1.tool_calls}")
    print(f"  additional_kwargs keys: {list(resp1.additional_kwargs.keys())}")
    print(f"  response_metadata keys: {list(resp1.response_metadata.keys())}")
    for k, v in resp1.additional_kwargs.items():
        val_str = str(v)[:200]
        print(f"    additional_kwargs[{k}]: {val_str}")
    for k, v in resp1.response_metadata.items():
        val_str = str(v)[:200]
        print(f"    response_metadata[{k}]: {val_str}")


if __name__ == "__main__":
    asyncio.run(main())
