# Copyright (c) 2026 Heureum AI. All rights reserved.

"""
Test 2: Does changing the system prompt between turns break thought signatures?
Also test: what happens when tool_names change (different tools bound)?
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

tool_schema2 = {
    "type": "function",
    "function": {
        "name": "web_search",
        "description": "Search the web",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"}
            },
            "required": ["query"],
        },
    },
}

SYSTEM_V1 = "You are a helpful assistant. You can use browser tools."
SYSTEM_V2 = "You are a helpful assistant. You can use browser tools. Additional context: respond in Korean."


def create_llm():
    return ChatGoogleGenerativeAI(
        model=MODEL,
        vertexai=True,
        project=PROJECT,
        location=LOCATION,
        temperature=0.7,
        max_output_tokens=2000,
    )


async def test_case(name, messages, tools):
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
        content_preview = str(m.content)[:60]
        print(f"  [{i}] {m.__class__.__name__}: {content_preview}{extra}")
    print(f"  tools_bound: {[t['function']['name'] for t in tools] if tools else 'none'}")
    print()

    try:
        if tools:
            resp = await llm.bind_tools(tools).ainvoke(messages)
        else:
            resp = await llm.ainvoke(messages)
        text = str(resp.content)[:100] if resp.content else "(no content)"
        tc = getattr(resp, "tool_calls", [])
        print(f"  SUCCESS: {text}")
        if tc:
            print(f"  tool_calls: {[c['name'] for c in tc]}")
        return resp
    except Exception as e:
        err = str(e)[:200]
        print(f"  FAILED: {err}")
        return None


async def main():
    llm = create_llm()

    # Step 1: Get initial tool call
    print("\nSTEP 1: Get tool call with SYSTEM_V1")
    resp1 = await llm.bind_tools([tool_schema]).ainvoke([
        SystemMessage(content=SYSTEM_V1),
        HumanMessage(content="쿠팡 열어줘"),
    ])
    print(f"  tool_calls: {resp1.tool_calls}")
    if not resp1.tool_calls:
        print("  No tool call, aborting")
        return

    tc_id = resp1.tool_calls[0]["id"]
    tool_error = ToolMessage(
        content="Error: Chrome extension is not connected.",
        tool_call_id=tc_id,
    )

    # Test F: Same system prompt, same tools → should work
    await test_case(
        "F: Same system, same tools (baseline)",
        [
            SystemMessage(content=SYSTEM_V1),
            HumanMessage(content="쿠팡 열어줘"),
            resp1,
            tool_error,
        ],
        [tool_schema],
    )

    # Test G: Different system prompt, same tools
    await test_case(
        "G: DIFFERENT system prompt, same tools",
        [
            SystemMessage(content=SYSTEM_V2),
            HumanMessage(content="쿠팡 열어줘"),
            resp1,
            tool_error,
        ],
        [tool_schema],
    )

    # Test H: Same system prompt, different tools set
    await test_case(
        "H: Same system, DIFFERENT tools set",
        [
            SystemMessage(content=SYSTEM_V1),
            HumanMessage(content="쿠팡 열어줘"),
            resp1,
            tool_error,
        ],
        [tool_schema, tool_schema2],
    )

    # Test I: Different system prompt, different tools
    await test_case(
        "I: DIFFERENT system, DIFFERENT tools",
        [
            SystemMessage(content=SYSTEM_V2),
            HumanMessage(content="쿠팡 열어줘"),
            resp1,
            tool_error,
        ],
        [tool_schema, tool_schema2],
    )

    # Test J: Same system, NO tools (common fallback case)
    await test_case(
        "J: Same system, NO tools",
        [
            SystemMessage(content=SYSTEM_V1),
            HumanMessage(content="쿠팡 열어줘"),
            resp1,
            tool_error,
        ],
        [],
    )

    # Test K: Very different system prompt
    await test_case(
        "K: Completely different system prompt, same tools",
        [
            SystemMessage(content="You are a Korean shopping assistant. Always respond in Korean with detailed explanations."),
            HumanMessage(content="쿠팡 열어줘"),
            resp1,
            tool_error,
        ],
        [tool_schema],
    )


if __name__ == "__main__":
    asyncio.run(main())
