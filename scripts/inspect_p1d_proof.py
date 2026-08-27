"""Emit a secret-free P1D Firestore proof snapshot."""

from __future__ import annotations

import argparse
import json
from typing import Any

from google.cloud import firestore


def safe(value: Any) -> Any:
    return json.loads(json.dumps(value, default=str))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", required=True)
    parser.add_argument("--incident", required=True)
    args = parser.parse_args()
    client = firestore.Client(project=args.project)
    incident_ref = client.collection("incidents").document(args.incident)
    incident = incident_ref.get()
    if not incident.exists:
        raise KeyError(args.incident)
    revision = incident_ref.collection("plan_revisions").document("0002").get()
    outbox = [
        snapshot.to_dict() or {}
        for snapshot in client.collection("recovery_outbox")
        .where("incident_id", "==", args.incident)
        .stream()
    ]
    payload = {
        "incident": incident.to_dict() or {},
        "plan_revision_0002": revision.to_dict() if revision.exists else None,
        "recovery_outbox": outbox,
        "objective": (client.collection("objectives").document("release-v2").get().to_dict()),
        "candidate_b_artifact": (
            client.collection("recovery_artifacts")
            .document("release-v2-candidate-b")
            .get()
            .to_dict()
        ),
    }
    print(json.dumps(safe(payload), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
