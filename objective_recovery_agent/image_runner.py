"""One-shot in-memory ADK runner that preserves inline multimodal content."""

from __future__ import annotations

import json
import time
import uuid
from typing import Any

from google.adk import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from pydantic import BaseModel

from objective_recovery_agent.planning import WorkflowResult


async def run_image_agent(
    agent: Agent,
    payload: BaseModel,
    image_part: types.Part,
) -> WorkflowResult:
    """Run one validated image and typed JSON payload without durable session state."""
    session_service = InMemorySessionService()
    user_id = "objective-recovery"
    session_id = str(uuid.uuid4())
    await session_service.create_session(
        app_name=agent.name, user_id=user_id, session_id=session_id
    )
    runner = Runner(agent=agent, app_name=agent.name, session_service=session_service)
    message = types.Content(
        role="user",
        # Official Gemini guidance recommends the image before its text for one-image prompts.
        parts=[image_part, types.Part.from_text(text=payload.model_dump_json())],
    )
    started = time.perf_counter()
    output: Any = None
    output_text: str | None = None
    total_tokens = 0
    input_tokens = 0
    output_tokens = 0
    async for event in runner.run_async(
        user_id=user_id, session_id=session_id, new_message=message
    ):
        if event.output is not None:
            output = event.output
        if event.content and event.content.parts:
            text_parts = [part.text for part in event.content.parts if part.text]
            if text_parts:
                output_text = "".join(text_parts)
        if event.usage_metadata and event.usage_metadata.total_token_count:
            total_tokens += event.usage_metadata.total_token_count
            input_tokens += event.usage_metadata.prompt_token_count or 0
            output_tokens += (event.usage_metadata.candidates_token_count or 0) + (
                event.usage_metadata.thoughts_token_count or 0
            )
    if output is None and output_text is not None:
        output = json.loads(output_text)
    if output is None:
        raise ValueError(f"ADK agent {agent.name} produced no typed output")
    output_schema = agent.output_schema
    if isinstance(output_schema, type) and issubclass(output_schema, BaseModel):
        output = output_schema.model_validate(output)
    return WorkflowResult(
        output=output,
        latency_ms=int((time.perf_counter() - started) * 1000),
        total_tokens=total_tokens,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
    )


__all__ = ["run_image_agent"]
