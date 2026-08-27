"""Stable identities and metadata-only tracing for reasoning boundaries."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

from pydantic import BaseModel

from objective_recovery_agent.observability import emit_operational_event

AGENT_VERSION = "p2c-v1"


class AgentId(StrEnum):
    DISRUPTION_INTERPRETER = "disruption_interpreter"
    IMPACT_ANALYST = "impact_analyst"
    RECOVERY_PLANNER = "recovery_planner"
    RISK_CRITIC = "risk_critic"
    RECOVERY_ANALYST = "recovery_analyst"


@dataclass(frozen=True, slots=True)
class AgentTraceContext:
    agent_id: AgentId
    phase: str
    incident_id: str | None = None
    recovery_attempt: int | None = None
    source_event_id: str | None = None


def content_fingerprint(value: BaseModel | Any) -> str:
    if isinstance(value, BaseModel):
        encoded = value.model_dump_json().encode()
    else:
        encoded = repr(value).encode()
    return hashlib.sha256(encoded).hexdigest()


def emit_agent_event(
    status: str,
    trace: AgentTraceContext,
    *,
    model: str,
    input_fingerprint: str,
    output_fingerprint: str | None = None,
    latency_ms: int | None = None,
    error_type: str | None = None,
) -> None:
    """Emit no prompts, model content, credentials, or chain-of-thought."""
    emit_operational_event(
        f"AGENT_INVOCATION_{status.upper()}",
        agent_id=trace.agent_id.value,
        agent_version=AGENT_VERSION,
        model=model,
        phase=trace.phase,
        incident_id=trace.incident_id,
        recovery_attempt=trace.recovery_attempt,
        source_event_id=trace.source_event_id,
        input_fingerprint=input_fingerprint,
        output_fingerprint=output_fingerprint,
        latency_ms=latency_ms,
        status=status,
        error_type=error_type,
    )


__all__ = [
    "AGENT_VERSION",
    "AgentId",
    "AgentTraceContext",
    "content_fingerprint",
    "emit_agent_event",
]
