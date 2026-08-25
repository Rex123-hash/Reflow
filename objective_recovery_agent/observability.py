"""Small structured operational-event surface for P1A diagnostics."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any


class OperationalEvent(StrEnum):
    PUBSUB_DECODE_FAILED = "PUBSUB_DECODE_FAILED"
    DUPLICATE_EVENT_SUPPRESSED = "DUPLICATE_EVENT_SUPPRESSED"
    EVENT_ALREADY_IN_PROGRESS = "EVENT_ALREADY_IN_PROGRESS"
    INCIDENT_CLAIM_FAILED = "INCIDENT_CLAIM_FAILED"
    FIRESTORE_CHECKPOINT_FAILED = "FIRESTORE_CHECKPOINT_FAILED"
    IMPACT_MAPPING_FAILED = "IMPACT_MAPPING_FAILED"
    PLANNER_STARTED = "PLANNER_STARTED"
    PLANNER_COMPLETED = "PLANNER_COMPLETED"
    PLANNER_SCHEMA_INVALID = "PLANNER_SCHEMA_INVALID"
    PLANNER_TIMEOUT = "PLANNER_TIMEOUT"
    PLANNER_FAILED = "PLANNER_FAILED"
    CRITIC_STARTED = "CRITIC_STARTED"
    CRITIC_COMPLETED = "CRITIC_COMPLETED"
    CRITIC_SCHEMA_INVALID = "CRITIC_SCHEMA_INVALID"
    CRITIC_TIMEOUT = "CRITIC_TIMEOUT"
    CRITIC_FAILED = "CRITIC_FAILED"
    ALL_PLANS_INVALID = "ALL_PLANS_INVALID"
    BLOCKING_UNKNOWN = "BLOCKING_UNKNOWN"
    PLAN_SELECTED = "PLAN_SELECTED"
    WORKFLOW_RESUMED = "WORKFLOW_RESUMED"
    WORKFLOW_FAILED = "WORKFLOW_FAILED"


def emit_operational_event(event: OperationalEvent | str, **fields: Any) -> None:
    """Emit metadata-only JSON; callers must never pass secrets or raw model content."""
    payload = {
        "operational_event": str(event),
        "occurred_at": datetime.now(UTC).isoformat(),
        **{key: value for key, value in fields.items() if value is not None},
    }
    print(json.dumps(payload, default=str, sort_keys=True), flush=True)
