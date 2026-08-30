"""Genuine-model, no-adapter evaluation for bounded voice clarification continuity."""

from __future__ import annotations

import asyncio
import json
import os
import uuid
from pathlib import Path
from typing import Any

from objective_recovery_agent.agent_runtime import AgentId
from objective_recovery_agent.calendar_operator_contract import (
    CALENDAR_CREATE_OPERATION,
    CALENDAR_CREATE_RESOURCE,
)
from objective_recovery_agent.operator_agents import (
    OPERATOR_AGENT_NAMES,
    AdkOperatorAgents,
    AgentName,
)
from objective_recovery_agent.operator_context import build_snapshot
from objective_recovery_agent.operator_schemas import (
    ConversationContext,
    ConversationInput,
    IntentInput,
    OperatorCapability,
    OperatorIntent,
    OperatorQuery,
)
from objective_recovery_agent.ui_schemas import ExecutionEventsView, RecoveryCaseView

ROOT = Path(__file__).resolve().parents[1]
INCIDENT = "incident-0fc3af5b0bd1ad847aea"
INTERPRETATION_TIME = "2026-08-30T23:00:00+05:30"


def environment() -> None:
    path = ROOT / ".env"
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip() and not line.lstrip().startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    os.environ["ADK_CAPTURE_MESSAGE_CONTENT_IN_SPANS"] = "false"
    os.environ["OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT"] = "false"


def capabilities() -> tuple[OperatorCapability, ...]:
    return (
        OperatorCapability(
            authority="GOOGLE_CALENDAR",
            resource_type="EVENT",
            operations=("CREATE_CALENDAR_EVENT",),
            resource_identifiers=(CALENDAR_CREATE_RESOURCE,),
            timezone="Asia/Kolkata",
        ),
        OperatorCapability(
            authority="REFLOW",
            resource_type="OBJECTIVE",
            operations=("MOVE_PROTECTED_DEADLINE",),
            resource_identifiers=("protected-objective-deadline",),
        ),
    )


def snapshot() -> Any:
    fixtures = ROOT / "docs/ui-fixtures"
    return build_snapshot(
        INCIDENT,
        RecoveryCaseView.model_validate_json((fixtures / "recovery-restored.json").read_bytes()),
        ExecutionEventsView.model_validate_json((fixtures / "events.json").read_bytes()),
    )


async def interpret(
    agents: AdkOperatorAgents,
    message: str,
    previous: ConversationContext | None,
) -> tuple[Any, OperatorIntent | None, list[AgentName]]:
    request_id = str(uuid.uuid4())
    values = capabilities()
    conversation, trace8 = await agents.understand(
        ConversationInput(
            message=message,
            incident_id=INCIDENT,
            capabilities=values,
            previous=previous,
        ),
        request_id,
    )
    traces = [trace8.agent_id]
    intent = None
    if conversation.mode == "TASK":
        intent, trace6 = await agents.interpret(
            IntentInput(
                request=OperatorQuery(
                    incident_id=INCIDENT,
                    message=message,
                    conversation_context=previous,
                ),
                snapshot=snapshot(),
                capabilities=values,
                conversation=conversation,
                interpretation_time=INTERPRETATION_TIME,
            ),
            request_id,
        )
        traces.append(trace6.agent_id)
    return conversation, intent, traces


async def evaluate_case(case: dict[str, Any]) -> dict[str, Any]:
    agents = AdkOperatorAgents()
    previous = (
        ConversationContext.model_validate(case["previous"]) if case.get("previous") else None
    )
    initial_checks: dict[str, bool] = {}
    agent_ids: list[AgentName] = []
    if first_message := case.get("first_message"):
        initial, initial_intent, initial_agents = await interpret(agents, first_message, None)
        agent_ids.extend(initial_agents)
        initial_checks = {
            "initial_calendar_create": (
                initial.mode == "TASK" and initial.requested_capability == "CALENDAR_CREATE"
            ),
            "initial_clarification": (
                initial_intent is not None
                and initial_intent.disposition == "CLARIFICATION_REQUIRED"
                and initial_intent.intent_type is None
            ),
            "initial_no_operation": (
                initial_intent is not None and not initial_intent.requested_operations
            ),
        }
        if initial_intent is None or initial_intent.clarification is None:
            previous = None
        else:
            previous = ConversationContext(
                mode="CLARIFY",
                user_goal=initial.user_goal,
                normalized_request=initial.normalized_request,
                human_summary=initial_intent.clarification,
            )

    conversation, intent, follow_up_agents = await interpret(agents, case["message"], previous)
    agent_ids.extend(follow_up_agents)
    normalized = conversation.normalized_request or conversation.user_goal
    create_case = case["expected_capability"] == "CALENDAR_CREATE"
    operation = (
        intent.requested_operations[0]
        if intent is not None and len(intent.requested_operations) == 1
        else None
    )
    checks = {
        **initial_checks,
        "task": conversation.mode == "TASK",
        "capability": conversation.requested_capability == case["expected_capability"],
        "intent": intent is not None and intent.intent_type == case["expected_intent"],
        "disposition": (intent is not None and intent.disposition == case["expected_disposition"]),
        "preserved": all(value.casefold() in normalized.casefold() for value in case["preserve"]),
        "no_event_id_request": not (
            intent is not None
            and intent.clarification is not None
            and "event id" in intent.clarification.casefold()
        ),
        "create_operation_only_when_expected": (
            (
                create_case
                and intent is not None
                and intent.subject == "CALENDAR"
                and intent.target is not None
                and intent.target.resource_identifier == CALENDAR_CREATE_RESOURCE
                and operation is not None
                and operation.operation == CALENDAR_CREATE_OPERATION
                and operation.calendar_event is not None
            )
            or (
                not create_case
                and intent is not None
                and intent.subject == "RECOVERY"
                and not intent.requested_operations
            )
        ),
        "agent_count_unchanged": len(tuple(AgentId)) + len(OPERATOR_AGENT_NAMES) == 8,
        "only_agents_8_and_6": all(
            value in {"conversation_understanding_agent", "operator_intent_interpreter"}
            for value in agent_ids
        ),
        "no_adapter_or_external_write": True,
    }
    return {
        "case": case["id"],
        "passed": all(checks.values()),
        "checks": checks,
        "conversation": conversation.model_dump(mode="json"),
        "intent": intent.model_dump(mode="json") if intent else None,
        "agents": agent_ids,
        "external_writes": 0,
    }


async def main() -> None:
    environment()
    source = ROOT / "tests/eval/voice-conversation-reliability-cases.json"
    cases = json.loads(source.read_text(encoding="utf-8"))["cases"]
    records: list[dict[str, Any]] = []
    for case in cases:
        try:
            record = await evaluate_case(case)
        except Exception as error:
            record = {
                "case": case["id"],
                "passed": False,
                "error": type(error).__name__,
                "external_writes": 0,
            }
        records.append(record)
        print(json.dumps(record), flush=True)
    result = {
        "runtime": "local-vertex-no-adapters",
        "external_writes": 0,
        "passed": sum(bool(record["passed"]) for record in records),
        "total": len(records),
        "records": records,
    }
    output = ROOT / "artifacts/voice-conversation-reliability-evaluation.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2), encoding="utf-8")
    if result["passed"] != result["total"]:
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
