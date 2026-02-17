# Copyright (c) 2026 Heureum AI. All rights reserved.

"""Minimal LangChain<->Gemini two-turn roundtrip test.

Flow:
  1) Human question
  2) AI response appended to message list
  3) Follow-up human question using same list
"""

import argparse
import asyncio
import os
from typing import Any

from app.config import settings
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI


def _make_llm(model: str) -> ChatGoogleGenerativeAI:
    """Create Gemini LLM with current local settings."""
    if settings.GOOGLE_API_KEY:
        return ChatGoogleGenerativeAI(
            model=model,
            google_api_key=settings.GOOGLE_API_KEY,
            temperature=0.1,
            max_output_tokens=512,
        )

    if settings.GOOGLE_APPLICATION_CREDENTIALS:
        os.environ.setdefault(
            "GOOGLE_APPLICATION_CREDENTIALS",
            settings.GOOGLE_APPLICATION_CREDENTIALS,
        )

    return ChatGoogleGenerativeAI(
        model=model,
        vertexai=True,
        project=settings.GOOGLE_CLOUD_PROJECT,
        location=settings.GOOGLE_CLOUD_LOCATION,
        temperature=0.1,
        max_output_tokens=512,
    )


def _text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        out: list[str] = []
        for item in content:
            if isinstance(item, str):
                out.append(item)
            elif isinstance(item, dict):
                out.append(str(item.get("text", "")))
        return " ".join(part for part in out if part)
    return str(content)


def _print_state(messages: list[BaseMessage], title: str) -> None:
    print(f"\n=== {title} ===")
    print(f"message_count={len(messages)}")
    for i, msg in enumerate(messages, start=1):
        msg_type = getattr(msg, "type", msg.__class__.__name__)
        preview = _text(getattr(msg, "content", ""))
        preview = preview.replace("\n", " ")[:120]
        print(f"{i}. type={msg_type} preview={preview!r}")


async def run(model: str) -> None:
    llm = _make_llm(model)
    messages: list[BaseMessage] = []

    q1 = "안녕하세요. 한 줄로 자기소개해 주세요."
    q2 = "좋아요. 방금 답변을 8글자 이내로 요약해 주세요."

    messages.append(HumanMessage(content=q1))
    _print_state(messages, "Before Turn 1")
    r1 = await llm.ainvoke(messages)
    print("\n[Turn1 AI]")
    print(_text(r1.content))
    print(f"tool_calls={getattr(r1, 'tool_calls', None)}")
    messages.append(r1)

    messages.append(HumanMessage(content=q2))
    _print_state(messages, "Before Turn 2")
    r2 = await llm.ainvoke(messages)
    print("\n[Turn2 AI]")
    print(_text(r2.content))
    print(f"tool_calls={getattr(r2, 'tool_calls', None)}")

    if isinstance(r1, AIMessage):
        usage1 = getattr(r1, "usage_metadata", None)
        if usage1:
            print(f"\nturn1_usage={usage1}")
    if isinstance(r2, AIMessage):
        usage2 = getattr(r2, "usage_metadata", None)
        if usage2:
            print(f"turn2_usage={usage2}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="gemini-3-flash-preview")
    args = parser.parse_args()
    asyncio.run(run(args.model))


if __name__ == "__main__":
    main()

