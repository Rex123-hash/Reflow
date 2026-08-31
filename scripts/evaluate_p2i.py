"""Bounded genuine-model P2I evaluation with no adapters, writes, or canonical mutation."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import time
import uuid
from itertools import pairwise
from pathlib import Path
from typing import Any, cast

from objective_recovery_agent.operator_context import build_snapshot
from objective_recovery_agent.operator_human_response import (
    compose_direct_response,
    compose_task_response,
)
from objective_recovery_agent.operator_schemas import (
    ConversationContext,
    ConversationInput,
    HumanResponse,
    IntentInput,
    OperatorCapability,
    OperatorFact,
    OperatorQuery,
    SimulationInput,
)
from objective_recovery_agent.slack_operator_policy import slack_message_denial
from objective_recovery_agent.ui_schemas import ExecutionEventsView, RecoveryCaseView

ROOT = Path(__file__).resolve().parents[1]
INCIDENT = "incident-0fc3af5b0bd1ad847aea"


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
            authority="JIRA",
            resource_type="ISSUE",
            operations=(
                "JIRA_TRANSITION",
                "JIRA_SET_PRIORITY",
                "JIRA_ASSIGN",
                "JIRA_SET_DUE_DATE",
                "JIRA_ADD_COMMENT",
            ),
            resource_identifiers=("API-42",),
        ),
        OperatorCapability(
            authority="GOOGLE_CALENDAR",
            resource_type="EVENT",
            operations=(
                "CALENDAR_RESCHEDULE",
                "CALENDAR_UPDATE_TITLE",
                "CALENDAR_UPDATE_DESCRIPTION",
            ),
            resource_identifiers=("operator-demo",),
        ),
        OperatorCapability(
            authority="SLACK",
            resource_type="CHANNEL",
            operations=("SLACK_INSPECT_CHANNEL", "SLACK_POST_MESSAGE"),
            resource_identifiers=("configured-release-channel",),
        ),
        OperatorCapability(
            authority="REFLOW",
            resource_type="OBJECTIVE",
            operations=("MOVE_PROTECTED_DEADLINE",),
            resource_identifiers=("protected-objective-deadline",),
        ),
    )


class EvaluationRegistry:
    def __init__(self, values: tuple[OperatorCapability, ...]) -> None:
        self._values = values

    def capabilities(self) -> tuple[OperatorCapability, ...]:
        return self._values


def frozen_snapshot() -> Any:
    fixtures = ROOT / "docs/ui-fixtures"
    return build_snapshot(
        INCIDENT,
        RecoveryCaseView.model_validate_json((fixtures / "recovery-restored.json").read_bytes()),
        ExecutionEventsView.model_validate_json((fixtures / "events.json").read_bytes()),
    )


def duplicate_echo(value: str) -> bool:
    if re.search(r"\b([A-Za-z][\w'-]*)\s+\1\b", value, re.IGNORECASE):
        return True
    sentences = [
        re.sub(r"[^a-z0-9]+", " ", item.casefold()).strip()
        for item in re.split(r"(?<=[.!?])\s+", value)
    ]
    return any(left and left == right for left, right in pairwise(sentences))


def trace_document(records: list[dict[str, Any]]) -> dict[str, Any]:
    cases = []
    for record in records:
        case = record["case"]
        response = {
            "passed": record["passed"],
            "checks": record.get("checks", {}),
            "human_summary": record.get("human_summary"),
            "mode": record.get("conversation", {}).get("mode"),
            "capability": record.get("conversation", {}).get("requested_capability"),
            "provider": record.get("conversation", {}).get("likely_provider"),
            "resource": record.get("conversation", {}).get("referenced_resource"),
            "scope_resolution": record.get("conversation", {}).get("scope_resolution"),
            "agents": [item["agent_id"] for item in record.get("agents", [])],
        }
        item: dict[str, Any] = {
            "evalCaseId": case["id"],
            "prompt": {"role": "user", "parts": [{"text": case["message"]}]},
            "responses": [
                {"response": {"role": "model", "parts": [{"text": json.dumps(response)}]}}
            ],
            "reference": {"response": {"role": "model", "parts": [{"text": json.dumps(case)}]}},
        }
        if "error" in record:
            item["failureMetadata"] = {
                "case_id": case["id"],
                "completed": False,
                "error_category": record["error"],
            }
        cases.append(item)
    return {"candidateName": "reflow-p2i-conversation-intelligence", "evalCases": cases}


async def evaluate_case(case: dict[str, Any]) -> dict[str, Any]:
    from objective_recovery_agent.operator_agents import AdkOperatorAgents
    from objective_recovery_agent.operator_service import validate_intent

    agents = AdkOperatorAgents()
    values = capabilities()
    snapshot = frozen_snapshot()
    request_id = str(uuid.uuid4())
    started = time.perf_counter()
    previous = (
        ConversationContext.model_validate(case["previous"]) if case.get("previous") else None
    )
    conversation, trace8 = await agents.understand(
        ConversationInput(
            message=case["message"],
            incident_id=INCIDENT,
            capabilities=values,
            previous=previous,
        ),
        request_id,
    )
    traces = [trace8]
    intent = None
    simulation = None
    facts: tuple[OperatorFact, ...] = ()
    answer = conversation.direct_response or conversation.user_goal
    human: HumanResponse
    if conversation.mode == "TASK":
        intent, trace6 = await agents.interpret(
            IntentInput(
                request=OperatorQuery(incident_id=INCIDENT, message=case["message"]),
                snapshot=snapshot,
                capabilities=values,
                conversation=conversation,
            ),
            request_id,
        )
        traces.append(trace6)
        deadline = validate_intent(intent, snapshot, cast(Any, EvaluationRegistry(values)))
        facts = tuple(
            fact
            for key in dict.fromkeys(intent.fact_ids)
            for fact in snapshot.facts
            if fact.fact_id == key
        )
        answer = "\n\n".join(item.text for item in facts) or str(
            intent.clarification or intent.question
        )
        if intent.disposition == "SUPPORTED" and intent.intent_type == "SIMULATE":
            simulation, trace7 = await agents.simulate(
                SimulationInput(snapshot=snapshot, intent=intent, hypothetical_deadline=deadline),
                request_id,
            )
            traces.append(trace7)
            answer = simulation.scenario_summary
        if intent.intent_type == "ACT" and intent.disposition == "SUPPORTED":
            human = HumanResponse(
                human_summary=(
                    "I understand the requested change. This qualification checks routing only; "
                    "it did not execute an adapter."
                ),
                situation_type="UNCERTAIN",
                current_state="The request was interpreted but not executed.",
                truth_boundary="No external action occurred.",
            )
        else:
            human = compose_task_response(
                envelope=conversation,
                intent=intent,
                snapshot=snapshot,
                answer=answer,
                facts=facts,
                simulation=simulation,
                inspection=None,
                action=None,
                response_disposition=intent.disposition,
            )
    else:
        human = compose_direct_response(conversation, values)

    agent_ids = [item.agent_id for item in traces]
    checks: dict[str, bool] = {
        "mode": conversation.mode == case["mode"],
        "capability": (
            case.get("capability") is None
            or conversation.requested_capability == case.get("capability")
        ),
        "agent8_once": agent_ids.count("conversation_understanding_agent") == 1,
        "agent6_route": (("operator_intent_interpreter" in agent_ids) == (case["mode"] == "TASK")),
        "agent7_only_simulation": (
            ("simulation_agent" in agent_ids) == (case.get("intent") == "SIMULATE")
        ),
        "no_external_effect": True,
        "human_first": bool(human.human_summary and human.truth_boundary),
        "no_echo": not duplicate_echo(human.human_summary),
        "preserved": all(
            value in (conversation.normalized_request or conversation.user_goal)
            for value in case.get("preserve", [])
        ),
        "normalized": all(
            value.casefold() in (conversation.normalized_request or "").casefold()
            for value in case.get("normalized_contains", [])
        ),
        "provider": (
            case.get("provider") is None
            or conversation.likely_provider == case.get("provider")
        ),
        "resource": (
            case.get("resource") is None
            or conversation.referenced_resource == case.get("resource")
        ),
        "context_used": (
            case.get("context_used") is None
            or conversation.context_resolution_used == case.get("context_used")
        ),
        "ambiguity": (
            case.get("ambiguity") is None
            or conversation.ambiguity_flag == case.get("ambiguity")
        ),
        "clarification": (
            case.get("clarification_required") is None
            or conversation.clarification_required == case.get("clarification_required")
        ),
        "scope_resolution": (
            case.get("scope_resolution") is None
            or conversation.scope_resolution == case.get("scope_resolution")
        ),
        "candidate_interpretation": bool(conversation.candidate_interpretations),
    }
    if case["mode"] == "TASK":
        checks.update(
            {
                "intent": intent is not None and intent.intent_type == case.get("intent"),
                "disposition": (
                    intent is not None and intent.disposition == case.get("disposition")
                ),
                "subject": intent is not None and intent.subject == case.get("subject"),
                "target": (
                    case.get("target") is None
                    or (
                        intent is not None
                        and intent.target is not None
                        and intent.target.resource_identifier == case.get("target")
                    )
                ),
                "target_absent": (
                    not case.get("target_absent")
                    or (intent is not None and intent.target is None)
                ),
            }
        )
    combined = json.dumps(
        {
            "conversation": conversation.model_dump(mode="json"),
            "intent": intent.model_dump(mode="json") if intent else None,
        }
    ).casefold()
    checks["no_scope_expansion"] = all(
        value.casefold() not in combined for value in case.get("forbid", [])
    )
    if case.get("nearest_authorized"):
        checks["nearest_authorized_help"] = (
            intent is not None
            and intent.disposition == "SUPPORTED"
            and "configured reflow release channel" in human.human_summary.casefold()
            and "personal slack" in human.human_summary.casefold()
        )
    if case["id"] in {"i_policy_denial", "q_mass_mention"}:
        message = (
            intent.requested_operations[0].value
            if intent is not None and intent.requested_operations
            else None
        )
        checks["deterministic_policy_denial"] = slack_message_denial(message) == (
            "slack_mentions_denied"
        )
    return {
        "case": case,
        "passed": all(checks.values()),
        "checks": checks,
        "conversation": conversation.model_dump(mode="json"),
        "intent": intent.model_dump(mode="json") if intent else None,
        "human_summary": human.human_summary,
        "human_response": human.model_dump(mode="json"),
        "agents": [item.model_dump(mode="json") for item in traces],
        "agent8_latency_ms": trace8.latency_ms,
        "total_latency_ms": int((time.perf_counter() - started) * 1000),
        "external_effects_executed": False,
    }


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--case", action="append")
    parser.add_argument("--case-delay", type=float, default=0.0)
    parser.add_argument(
        "--regrade-existing",
        action="store_true",
        help="Regrade preserved genuine responses against the current dataset without model calls.",
    )
    parser.add_argument("--output", default="artifacts/p2i-conversation-model-evaluation.json")
    parser.add_argument("--traces-output", default="artifacts/p2i-conversation-eval-traces.json")
    args = parser.parse_args()
    if not 0 <= args.case_delay <= 30:
        parser.error("case-delay must be between 0 and 30 seconds")
    environment()
    cases = json.loads(
        (ROOT / "tests/eval/p2i-conversation-cases.json").read_text(encoding="utf-8")
    )["cases"]
    if args.regrade_existing:
        output = ROOT / args.output
        existing = json.loads(output.read_text(encoding="utf-8"))
        current_cases = {item["id"]: item for item in cases}
        existing_records = existing["records"]
        for record in existing_records:
            case = current_cases[record["case"]["id"]]
            record["case"] = case
            checks = record.get("checks")
            if checks is None:
                continue
            conversation = record["conversation"]
            intent = record.get("intent")
            checks["mode"] = conversation["mode"] == case["mode"]
            checks["capability"] = case.get("capability") is None or conversation[
                "requested_capability"
            ] == case.get("capability")
            if case["mode"] == "TASK":
                checks["intent"] = intent is not None and intent["intent_type"] == case.get(
                    "intent"
                )
                checks["disposition"] = intent is not None and intent["disposition"] == case.get(
                    "disposition"
                )
                checks["subject"] = intent is not None and intent["subject"] == case.get("subject")
            record["passed"] = all(checks.values())
        existing["passed"] = sum(bool(item["passed"]) for item in existing_records)
        output.write_text(json.dumps(existing, indent=2), encoding="utf-8")
        traces = ROOT / args.traces_output
        traces.write_text(json.dumps(trace_document(existing_records), indent=2), encoding="utf-8")
        print(
            json.dumps(
                {
                    "regraded_without_model_calls": True,
                    "passed": existing["passed"],
                    "total": existing["total"],
                }
            )
        )
        if existing["passed"] != existing["total"]:
            raise SystemExit(1)
        return
    records: list[dict[str, Any]] = []
    for case in cases:
        if args.case and case["id"] not in args.case:
            continue
        if records and args.case_delay:
            await asyncio.sleep(args.case_delay)
        try:
            record = await evaluate_case(case)
        except Exception as error:
            record = {
                "case": case,
                "passed": False,
                "error": type(error).__name__,
                "agent_name": getattr(error, "agent_name", None),
                "elapsed_ms": getattr(error, "elapsed_ms", None),
            }
        records.append(record)
        print(
            json.dumps(
                {
                    "case": case["id"],
                    "passed": record["passed"],
                    "checks": record.get("checks"),
                    "error": record.get("error"),
                    "agent8_latency_ms": record.get("agent8_latency_ms"),
                }
            ),
            flush=True,
        )
    output = ROOT / args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    passed = sum(bool(item["passed"]) for item in records)
    output.write_text(
        json.dumps(
            {
                "runtime": "local-vertex-no-adapters",
                "external_writes": 0,
                "passed": passed,
                "total": len(records),
                "records": records,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    traces = ROOT / args.traces_output
    traces.parent.mkdir(parents=True, exist_ok=True)
    traces.write_text(json.dumps(trace_document(records), indent=2), encoding="utf-8")
    if passed != len(records):
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
