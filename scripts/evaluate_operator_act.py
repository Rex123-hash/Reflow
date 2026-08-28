"""Real Gemini/ADK ACT interpretation evaluation; no external execution adapters.

Uses fixture resource identifiers as capability DATA, never claims live Jira/Calendar proof.
Writes sanitized validated intents and metadata, not prompts or hidden reasoning.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import time
import uuid
from typing import Any

from scripts.evaluate_operator import ROOT, environment, evaluation_trace


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--case-delay", type=float, default=0)
    parser.add_argument(
        "--slack", action="store_true", help="Add P2H cases; preserve all P2G cases"
    )
    parser.add_argument("--output-prefix", default="p2g-act")
    parser.add_argument(
        "--case", action="append", help="Bounded diagnostic subset; final runs use all cases"
    )
    args = parser.parse_args()
    if not args.output_prefix.replace("-", "").isalnum():
        parser.error("output-prefix must be alphanumeric with optional hyphens")
    if not 0 <= args.case_delay <= 30:
        parser.error("case-delay must be between 0 and 30 seconds")
    environment()
    from objective_recovery_agent.operator_agents import AdkOperatorAgents
    from objective_recovery_agent.operator_context import build_snapshot
    from objective_recovery_agent.operator_schemas import (
        IntentInput,
        OperatorCapability,
        OperatorQuery,
    )
    from objective_recovery_agent.ui_schemas import ExecutionEventsView, RecoveryCaseView

    incident = "incident-0fc3af5b0bd1ad847aea"
    fixtures = ROOT / "docs/ui-fixtures"
    snapshot = build_snapshot(
        incident,
        RecoveryCaseView.model_validate_json((fixtures / "recovery-restored.json").read_bytes()),
        ExecutionEventsView.model_validate_json((fixtures / "events.json").read_bytes()),
    )
    capabilities: tuple[OperatorCapability, ...] = (
        OperatorCapability(
            authority="JIRA",
            resource_type="ISSUE",
            resource_identifiers=("API-42",),
            operations=(
                "JIRA_TRANSITION",
                "JIRA_SET_PRIORITY",
                "JIRA_ASSIGN",
                "JIRA_SET_DUE_DATE",
                "JIRA_ADD_COMMENT",
            ),
        ),
        OperatorCapability(
            authority="GOOGLE_CALENDAR",
            resource_type="EVENT",
            resource_identifiers=("p2goperator20260828",),
            operations=(
                "CALENDAR_RESCHEDULE",
                "CALENDAR_UPDATE_TITLE",
                "CALENDAR_UPDATE_DESCRIPTION",
            ),
        ),
        OperatorCapability(
            authority="REFLOW",
            resource_type="OBJECTIVE",
            resource_identifiers=("protected-objective-deadline",),
            operations=("MOVE_PROTECTED_DEADLINE",),
        ),
    )
    cases: list[dict[str, Any]] = [
        {
            "id": "jira_inspect",
            "message": "What is the status of API-42?",
            "intent": "INSPECT",
            "disposition": "SUPPORTED",
            "target": "API-42",
            "operations": [],
        },
        {
            "id": "jira_transition_comment",
            "message": "Mark API-42 blocked and add a comment: Backend engineer unavailable.",
            "intent": "ACT",
            "disposition": "SUPPORTED",
            "target": "API-42",
            "operations": ["JIRA_TRANSITION", "JIRA_ADD_COMMENT"],
        },
        {
            "id": "jira_assign",
            "message": "Assign API-42 to Srishti.",
            "intent": "ACT",
            "disposition": "SUPPORTED",
            "target": "API-42",
            "operations": ["JIRA_ASSIGN"],
        },
        {
            "id": "calendar_inspect",
            "message": "What time is the Operator demo coordination event?",
            "intent": "INSPECT",
            "disposition": "SUPPORTED",
            "target": "p2goperator20260828",
            "operations": [],
        },
        {
            "id": "calendar_inspect_unconfigured",
            "message": "What time is the Operator demo coordination event?",
            "intent": None,
            "disposition": "CLARIFICATION_REQUIRED",
            "operations": [],
            "without_calendar": True,
        },
        {
            "id": "calendar_act",
            "message": "Move the Operator demo coordination event by one hour.",
            "intent": "ACT",
            "disposition": "SUPPORTED",
            "target": "p2goperator20260828",
            "operations": ["CALENDAR_RESCHEDULE"],
            "value": "60",
        },
        {
            "id": "protected_deadline",
            "message": "Move the protected Release V2 deadline two hours later.",
            "intent": "ACT",
            "disposition": "SUPPORTED",
            "target": "protected-objective-deadline",
            "operations": ["MOVE_PROTECTED_DEADLINE"],
        },
        {
            "id": "ambiguous_task",
            "message": "Update that task.",
            "intent": None,
            "disposition": "CLARIFICATION_REQUIRED",
            "operations": [],
        },
        {
            "id": "unsupported_admin",
            "message": "Delete the Jira project and change the API token.",
            "intent": None,
            "disposition": "UNSUPPORTED",
            "operations": [],
        },
        {
            "id": "unconfigured_issue",
            "message": "Mark OTHER-999 blocked.",
            "intent": None,
            "disposition": "UNSUPPORTED",
            "operations": [],
        },
    ]
    if args.slack:
        capabilities += (
            OperatorCapability(
                authority="SLACK",
                resource_type="CHANNEL",
                resource_identifiers=("configured-release-channel",),
                operations=("SLACK_INSPECT_CHANNEL", "SLACK_POST_MESSAGE"),
            ),
        )
        cases.extend(json.loads((ROOT / "tests/eval/slack-cases.json").read_text(encoding="utf-8")))
    agents = AdkOperatorAgents()
    records: list[dict[str, Any]] = []
    for case in cases:
        if args.case and case["id"] not in args.case:
            continue
        if records and args.case_delay:
            await asyncio.sleep(args.case_delay)
        request_id = str(uuid.uuid4())
        case_started = time.perf_counter()
        try:
            intent, trace = await agents.interpret(
                IntentInput(
                    request=OperatorQuery(incident_id=incident, message=case["message"]),
                    snapshot=snapshot,
                    capabilities=tuple(
                        item
                        for item in capabilities
                        if (not case.get("without_calendar") or item.authority != "GOOGLE_CALENDAR")
                        and (not case.get("without_slack") or item.authority != "SLACK")
                    ),
                ),
                request_id,
            )
            checks = {
                "intent": intent.intent_type == case["intent"],
                "disposition": intent.disposition == case["disposition"],
                "target": not case.get("target")
                or (
                    intent.target is not None
                    and intent.target.resource_identifier == case["target"]
                ),
                "operations": sorted(item.operation for item in intent.requested_operations)
                == sorted(case["operations"]),
                "value": not case.get("value")
                or intent.requested_operations[0].value == case["value"],
            }
            response = {
                "intent": intent.model_dump(mode="json"),
                "agents": [trace.model_dump(mode="json")],
                "external_effects_executed": False,
            }
            records.append(
                {
                    "case": case,
                    "response": response,
                    "checks": checks,
                    "passed": all(checks.values()),
                }
            )
        except Exception as error:
            records.append(
                {
                    "case": case,
                    "passed": False,
                    "error": type(error).__name__,
                    "failure": {
                        "case_id": case["id"],
                        "agent_name": getattr(error, "agent_name", None)
                        or "operator_intent_interpreter",
                        "request_correlation_id": request_id,
                        "elapsed_ms": getattr(error, "elapsed_ms", None)
                        or int((time.perf_counter() - case_started) * 1000),
                        "timeout_category": getattr(error, "category", None)
                        or type(error).__name__,
                        "completed": False,
                    },
                }
            )
        print(
            json.dumps(
                {
                    "case": case["id"],
                    "passed": records[-1]["passed"],
                    "checks": records[-1].get("checks"),
                }
            ),
            flush=True,
        )
    output = ROOT / "artifacts"
    output.mkdir(exist_ok=True)
    (output / f"{args.output_prefix}-evaluation.json").write_text(
        json.dumps(
            {"runtime": "real-local-vertex-adk", "external_mutations": 0, "records": records},
            indent=2,
        ),
        encoding="utf-8",
    )
    traces = evaluation_trace(records)
    traces["candidateName"] = f"reflow-{args.output_prefix}"
    (output / f"{args.output_prefix}-traces.json").write_text(
        json.dumps(traces, indent=2), encoding="utf-8"
    )
    if not all(record["passed"] for record in records):
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
