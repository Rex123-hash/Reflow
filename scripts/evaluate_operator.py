"""Run actual Operator reasoning (local Vertex or private deployed API), never executors.

This is a behavioral evaluation harness, separate from deterministic pytest tests.
It records only user-visible validated responses and metadata, not model prompts/thoughts.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import shutil
import subprocess
import time
import uuid
from pathlib import Path
from typing import Any

import requests

ROOT = Path(__file__).resolve().parents[1]


def environment() -> None:
    path = ROOT / ".env"
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip() and not line.lstrip().startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    os.environ["ADK_CAPTURE_MESSAGE_CONTENT_IN_SPANS"] = "false"
    os.environ["OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT"] = "false"


def grade(case: dict[str, Any], response: dict[str, Any]) -> dict[str, bool]:
    intent = response["intent"]
    facts = [item["fact_id"] for item in response["facts"]]
    simulation: dict[str, Any] | None = response.get("simulation")
    checks = {
        "intent": intent["intent_type"] == case["intent"],
        "disposition": response["disposition"] == case["disposition"],
        "no_effect": response["external_effects_executed"] is False,
        "grounded_facts": all(
            any(key.startswith(prefix) for key in facts)
            for prefix in case["required_fact_prefixes"]
        ),
        "agent6": any(
            item["agent_id"] == "operator_intent_interpreter" for item in response["agents"]
        ),
    }
    if case["intent"] == "SIMULATE":
        checks.update(
            {
                "agent7": any(
                    item["agent_id"] == "simulation_agent" for item in response["agents"]
                ),
                "hypothetical": response["provenance"] == "HYPOTHETICAL_NO_ACTION"
                and simulation is not None
                and simulation["external_effects_executed"] is False,
                "verification_needed": simulation is not None
                and all(
                    future["required_verification"] for future in simulation["candidate_futures"]
                ),
            }
        )
    else:
        checks["no_simulation"] = simulation is None
    if case["id"] == "simulate_deadline":
        checks["hypothetical_deadline"] = (
            response["hypothetical_deadline"] == "2026-08-28T19:00:00+00:00"
        )
    return checks


def evaluation_trace(records: list[dict[str, Any]]) -> dict[str, Any]:
    """Convert genuine runtime responses into the agents-cli trace contract."""
    cases = []
    for record in records:
        case = record["case"]
        trace_case: dict[str, Any] = {
            "evalCaseId": case["id"],
            "prompt": {"role": "user", "parts": [{"text": case["message"]}]},
            "responses": [],
            "reference": {
                "response": {
                    "role": "model",
                    "parts": [{"text": json.dumps(case)}],
                }
            },
        }
        if "response" in record:
            trace_case["responses"] = [
                {
                    "response": {
                        "role": "model",
                        "parts": [{"text": json.dumps(record["response"])}],
                    }
                }
            ]
        else:
            trace_case["failureMetadata"] = record.get(
                "failure",
                {
                    "case_id": case["id"],
                    "completed": False,
                    "error_category": record.get("error", "unknown"),
                },
            )
        cases.append(trace_case)
    return {"candidateName": "reflow-p2f-operator", "evalCases": cases}


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--case-delay", type=float, default=0)
    parser.add_argument("--url")
    parser.add_argument("--context-url")
    parser.add_argument("--output", default="artifacts/p2f-local-evaluation.json")
    parser.add_argument("--traces-output", default="artifacts/p2f-agent-eval-traces.json")
    parser.add_argument("--case", action="append")
    args = parser.parse_args()
    if not 0 <= args.case_delay <= 30:
        parser.error("case-delay must be between 0 and 30 seconds")
    environment()
    from objective_recovery_agent.external_reality_schemas import ExternalRealityView
    from objective_recovery_agent.operator_api import get_operator_service
    from objective_recovery_agent.operator_context import build_snapshot
    from objective_recovery_agent.operator_schemas import OperatorQuery, OperatorResponse
    from objective_recovery_agent.operator_service import OperatorService
    from objective_recovery_agent.ui_schemas import ExecutionEventsView, RecoveryCaseView

    token = (
        subprocess.check_output(
            [shutil.which("gcloud") or "gcloud", "auth", "print-identity-token"], text=True
        ).strip()
        if args.url or args.context_url
        else None
    )
    cases = json.loads((ROOT / "tests/eval/operator-cases.json").read_text())["cases"]
    local_service = None
    if args.context_url and not args.url:
        base = args.context_url.rstrip("/")
        incident_id = "incident-0fc3af5b0bd1ad847aea"

        def get(path: str) -> bytes:
            response = requests.get(
                base + path, headers={"Authorization": f"Bearer {token}"}, timeout=30
            )
            response.raise_for_status()
            return response.content

        frozen = build_snapshot(
            incident_id,
            RecoveryCaseView.model_validate_json(get(f"/api/v1/ui/recoveries/{incident_id}")),
            ExecutionEventsView.model_validate_json(
                get(f"/api/v1/ui/recoveries/{incident_id}/events")
            ),
        )

        async def read_snapshot(_: str) -> Any:
            return frozen

        async def read_calendar(key: str) -> ExternalRealityView:
            return ExternalRealityView.model_validate_json(
                await asyncio.to_thread(get, f"/api/v1/ui/recoveries/{key}/external-reality")
            )

        local_service = OperatorService(read_snapshot, read_calendar)
    records: list[dict[str, Any]] = []
    for case in cases:
        if args.case and case["id"] not in args.case:
            continue
        if records and args.case_delay:
            await asyncio.sleep(args.case_delay)
        payload = OperatorQuery(
            incident_id="incident-0fc3af5b0bd1ad847aea", message=case["message"]
        )
        request_id = str(uuid.uuid4())
        case_started = time.perf_counter()
        try:
            if args.url:
                raw = await asyncio.to_thread(
                    requests.post,
                    args.url.rstrip("/") + "/api/v1/operator/query",
                    json=payload.model_dump(),
                    headers={
                        "Authorization": f"Bearer {token}",
                        "X-Reflow-Operator-Subject": hashlib.sha256(
                            b"p2f-qualification"
                        ).hexdigest(),
                        "X-Reflow-Request-Id": request_id,
                    },
                    timeout=90,
                )
                raw.raise_for_status()
                response = OperatorResponse.model_validate_json(raw.content)
            else:
                response = await (local_service or get_operator_service()).query(
                    payload, request_id
                )
            value = response.model_dump(mode="json")
            checks = grade(case, value)
            records.append(
                {"case": case, "response": value, "checks": checks, "passed": all(checks.values())}
            )
            print(
                json.dumps(
                    {
                        "case": case["id"],
                        "passed": all(checks.values()),
                        "checks": checks,
                        "agents": value["agents"],
                    }
                ),
                flush=True,
            )
        except Exception as error:
            elapsed_ms = int((time.perf_counter() - case_started) * 1000)
            records.append(
                {
                    "case": case,
                    "passed": False,
                    "error": type(error).__name__,
                    "failure": {
                        "case_id": case["id"],
                        "agent_name": getattr(error, "agent_name", None)
                        or (
                            "simulation_agent"
                            if case.get("intent") == "SIMULATE"
                            else "operator_intent_interpreter"
                        ),
                        "request_correlation_id": request_id,
                        "elapsed_ms": getattr(error, "elapsed_ms", None) or elapsed_ms,
                        "timeout_category": getattr(error, "category", None)
                        or type(error).__name__,
                        "completed": False,
                    },
                }
            )
            print(
                json.dumps({"case": case["id"], "passed": False, "error": type(error).__name__}),
                flush=True,
            )
    output = ROOT / args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    passed = sum(bool(item["passed"]) for item in records)
    output.write_text(
        json.dumps(
            {
                "runtime": args.url or "local-vertex",
                "passed": passed,
                "total": len(records),
                "records": records,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    traces_output = ROOT / args.traces_output
    traces_output.parent.mkdir(parents=True, exist_ok=True)
    traces_output.write_text(json.dumps(evaluation_trace(records), indent=2), encoding="utf-8")
    if not all(item["passed"] for item in records):
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
