# Copyright (c) 2026 Heureum AI. All rights reserved.

"""
Test 3: Verify that storing original AIMessage (with thought signature)
via append_tool_interaction allows the next LLM call to succeed.
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
from app.services.agent_service import AgentService
from app.models import Message
from app.schemas.open_responses import MessageRole

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


async def main():
    llm = create_llm()
    service = AgentService()
    service.llm = llm
    session_id = "test_session"

    # Step 1: Get a real tool call response
    print("STEP 1: Get tool call from Gemini")
    resp1 = await llm.bind_tools([tool_schema]).ainvoke([
        SystemMessage(content="You are a helpful assistant."),
        HumanMessage(content="쿠팡 열어줘"),
    ])
    print(f"  tool_calls: {resp1.tool_calls}")
    if not resp1.tool_calls:
        print("  No tool call, aborting")
        return

    tc_id = resp1.tool_calls[0]["id"]
    has_sig = "__gemini_function_call_thought_signatures__" in resp1.additional_kwargs
    print(f"  has thought signature: {has_sig}")

    # Step 2: Store via append_tool_interaction WITH original AIMessage
    print("\nSTEP 2: Store via append_tool_interaction (with assistant_lc_message)")
    user_messages = [Message(role=MessageRole.USER, content="쿠팡 열어줘")]
    tool_call_dicts = [{"name": "browser_navigate", "args": {"url": "https://www.coupang.com"}, "id": tc_id}]
    tool_results = [
        Message(
            role=MessageRole.TOOL,
            content="Error: Chrome extension is not connected.",
            tool_call_id=tc_id,
            tool_name="browser_navigate",
        )
    ]

    await service.append_tool_interaction(
        session_id,
        user_messages,
        tool_call_dicts,
        tool_results,
        usage={"input_tokens": 100, "output_tokens": 50},
        assistant_lc_message=resp1,
    )

    # Step 3: Inspect what's in _lc_sessions
    print("\nSTEP 3: Inspect stored messages")
    stored = service._lc_sessions.get(session_id, [])
    for i, msg in enumerate(stored):
        tc = getattr(msg, "tool_calls", None)
        tc_id_attr = getattr(msg, "tool_call_id", None)
        ak = getattr(msg, "additional_kwargs", {})
        extra_info = ""
        if tc:
            extra_info += f" tool_calls={[c['name'] for c in tc]}"
        if tc_id_attr:
            extra_info += f" tool_call_id={tc_id_attr}"
        if "__gemini_function_call_thought_signatures__" in ak:
            extra_info += " [HAS_SIGNATURE]"
        print(f"  [{i}] {msg.__class__.__name__}: {str(msg.content)[:60]}{extra_info}")

    # Step 4: Build messages and call LLM
    print("\nSTEP 4: Call LLM with stored history (WITH tools)")
    lc_messages = [SystemMessage(content="You are a helpful assistant.")]
    lc_messages.extend(stored)

    try:
        resp2 = await llm.bind_tools([tool_schema]).ainvoke(lc_messages)
        text = str(resp2.content)[:120] if resp2.content else "(no content)"
        print(f"  SUCCESS: {text}")
    except Exception as e:
        print(f"  FAILED: {str(e)[:200]}")

    # Step 5: Also test WITHOUT original (synthetic fallback)
    print("\n" + "=" * 60)
    print("STEP 5: Test synthetic fallback (no assistant_lc_message)")
    print("=" * 60)
    service2 = AgentService()
    service2.llm = llm
    session_id2 = "test_session_synthetic"

    await service2.append_tool_interaction(
        session_id2,
        user_messages,
        tool_call_dicts,
        tool_results,
        usage={"input_tokens": 100, "output_tokens": 50},
        # No assistant_lc_message → synthetic path
    )

    stored2 = service2._lc_sessions.get(session_id2, [])
    print("  Stored messages (synthetic):")
    for i, msg in enumerate(stored2):
        print(f"    [{i}] {msg.__class__.__name__}: {str(msg.content)[:60]}")

    lc_messages2 = [SystemMessage(content="You are a helpful assistant.")]
    lc_messages2.extend(stored2)

    print("\n  Call LLM with synthetic history (WITH tools):")
    try:
        resp3 = await llm.bind_tools([tool_schema]).ainvoke(lc_messages2)
        text = str(resp3.content)[:120] if resp3.content else "(no content)"
        print(f"    SUCCESS: {text}")
    except Exception as e:
        print(f"    FAILED: {str(e)[:200]}")


if __name__ == "__main__":
    asyncio.run(main())
