"""Print compact Firestore evidence for one P1A disruption event."""

from __future__ import annotations

import argparse
import json
from typing import Any

from google.cloud import firestore
from objective_recovery_agent.ledger import incident_id_for


def _safe(value: Any) -> Any:
    return json.loads(json.dumps(value, default=str))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", required=True)
    parser.add_argument("--event-id", required=True)
    args = parser.parse_args()

    client = firestore.Client(project=args.project)
    incident_id = incident_id_for(args.event_id)
    snapshot = client.collection("incidents").document(incident_id).get()
    claim = client.collection("event_claims").document(args.event_id).get()
    if not snapshot.exists:
        print(json.dumps({"incident_id": incident_id, "exists": False}))
        return

    incident = snapshot.to_dict() or {}
    planning_run = incident.get("planning_run", {})
    candidates = planning_run.get("candidates", {}).get("plans", [])
    critiques = planning_run.get("critiques", {}).get("critiques", [])
    events = list(
        client.collection("incidents").document(incident_id).collection("workflow_events").stream()
    )
    event_types = sorted(
        str((event.to_dict() or {}).get("event_type", "UNKNOWN")) for event in events
    )
    payload = {
        "incident_id": incident_id,
        "exists": True,
        "source_event_id": incident.get("source_event_id"),
        "stage": incident.get("stage"),
        "status": incident.get("status"),
        "revision": incident.get("revision"),
        "selected_plan_id": incident.get("selected_plan_id"),
        "selected_strategy": incident.get("selected_plan", {}).get("strategy_type"),
        "selected_actions": incident.get("selected_plan", {}).get("actions", []),
        "candidate_plan_ids": [item.get("plan_id") for item in candidates],
        "candidate_strategies": [item.get("strategy_type") for item in candidates],
        "candidate_action_signatures": {
            str(item.get("plan_id")): [
                f"{action.get('action_type')}:{action.get('target')}"
                for action in item.get("actions", [])
            ]
            for item in candidates
        },
        "critic_plan_ids": [item.get("plan_id") for item in critiques],
        "policy_decisions": incident.get("policy_decisions", []),
        "diversity": incident.get("diversity"),
        "planner_latency_ms": planning_run.get("planner_latency_ms"),
        "critic_latency_ms": planning_run.get("critic_latency_ms"),
        "end_to_end_latency_ms": incident.get("end_to_end_latency_ms"),
        "tokens": {
            "input": planning_run.get("input_tokens"),
            "output": planning_run.get("output_tokens"),
            "total": planning_run.get("total_tokens"),
        },
        "workflow_event_count": len(events),
        "workflow_event_types": event_types,
        "claim": _safe(claim.to_dict() if claim.exists else None),
    }
    print(json.dumps(_safe(payload), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
