"""Real Gemini/ADK ACT interpretation evaluation; no external execution adapters.

Uses fixture resource identifiers as capability DATA, never claims live Jira/Calendar proof.
Writes sanitized validated intents and metadata, not prompts or hidden reasoning.
"""

from __future__ import annotations

import asyncio
import json
import uuid

from scripts.evaluate_operator import ROOT, environment, evaluation_trace


async def main() -> None:
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
    capabilities = (
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
    cases = [
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
    agents = AdkOperatorAgents()
    records = []
    for case in cases:
        try:
            intent, trace = await agents.interpret(
                IntentInput(
                    request=OperatorQuery(incident_id=incident, message=case["message"]),
                    snapshot=snapshot,
                    capabilities=capabilities,
                ),
                str(uuid.uuid4()),
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
            records.append({"case": case, "passed": False, "error": type(error).__name__})
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
    (output / "p2g-act-evaluation.json").write_text(
        json.dumps(
            {"runtime": "real-local-vertex-adk", "external_mutations": 0, "records": records},
            indent=2,
        ),
        encoding="utf-8",
    )
    traces = evaluation_trace(records)
    traces["candidateName"] = "reflow-p2g-act"
    (output / "p2g-act-traces.json").write_text(json.dumps(traces, indent=2), encoding="utf-8")
    if not all(record["passed"] for record in records):
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
