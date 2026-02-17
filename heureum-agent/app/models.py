# Copyright (c) 2026 Heureum AI. All rights reserved.

"""Shared models for the application."""

from enum import Enum
from typing import Any, Dict, List, Optional

from app.schemas.open_responses import MessageRole, Usage
from pydantic import BaseModel


class Message(BaseModel):
    """Message model.

    Attributes:
        role (MessageRole): The role of the message sender.
        content (str): The text content of the message.
        tool_call_id (Optional[str]): Identifier linking this message to a
            specific tool call, if applicable.
        tool_calls (Optional[List[Dict[str, Any]]]): List of tool call
            descriptors emitted by the model, if any.
        tool_name (Optional[str]): Name of the tool that produced this result
            (tool-role messages only). Used for selective pruning.
    """

    role: MessageRole
    content: str
    tool_call_id: Optional[str] = None
    tool_calls: Optional[List[Dict[str, Any]]] = None
    tool_name: Optional[str] = None
    usage: Optional[Dict[str, Any]] = None


class AgentRequest(BaseModel):
    """Agent request model.

    Attributes:
        messages (List[Message]): Conversation history to send to the agent.
        session_id (Optional[str]): Optional session identifier for
            maintaining conversation state across requests.
    """

    messages: List[Message]
    session_id: Optional[str] = None


class AgentResponse(BaseModel):
    """Agent response model for text-only LLM calls.

    Attributes:
        message (str): The text content of the agent's reply.
        session_id (str): Session identifier for the conversation.
        usage (Optional[Usage]): Token usage statistics from the LLM.
    """

    message: str
    session_id: str
    usage: Optional[Usage] = None


class ToolCallInfo(BaseModel):
    """Single tool call descriptor returned by the LLM.

    Attributes:
        name (str): Name of the tool function to invoke.
        args (Dict[str, Any]): Parsed arguments for the tool call.
        id (str): Unique identifier correlating call and result.
    """

    name: str
    args: Dict[str, Any]
    id: str


class LLMResultType(str, Enum):
    """Discriminator for LLM response kind.

    Attributes:
        TEXT (str): Plain text response.
        TOOL_CALL (str): Tool calling response.
    """

    TEXT = "text"
    TOOL_CALL = "tool_call"


class LLMResult(BaseModel):
    """Result of a single LLM invocation with tool support.

    Returned by ``AgentService.process_messages_with_tools()``.

    Attributes:
        type (LLMResultType): Discriminator for response kind.
        text (Optional[str]): Assistant text when type is TEXT.
        tool_calls (Optional[List[ToolCallInfo]]): Tool calls when type
            is TOOL_CALL.
        session_id (str): Session identifier for the conversation.
        usage (Usage): Token usage statistics from the LLM.
    """

    type: LLMResultType
    text: Optional[str] = None
    tool_calls: Optional[List[ToolCallInfo]] = None
    assistant_lc_message: Optional[Any] = None
    session_id: str
    usage: Usage
