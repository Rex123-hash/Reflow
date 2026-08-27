"""Persist the product-owner objective and Candidate B artifact exactly once."""

from __future__ import annotations

import argparse

from google.cloud import firestore
from objective_recovery_agent.objective_store import (
    CANDIDATE_B_ARTIFACT,
    CANONICAL_OBJECTIVE,
    FirestoreObjectiveStore,
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", required=True)
    parser.add_argument("--incident", default="incident-a1864f07664e057ef422")
    args = parser.parse_args()
    store = FirestoreObjectiveStore(args.project)
    objective = store.ensure_objective(CANONICAL_OBJECTIVE)
    artifact = store.ensure_artifact(CANDIDATE_B_ARTIFACT)
    client = firestore.Client(project=args.project)
    ref = client.collection("incidents").document(args.incident)
    transaction = client.transaction()

    @firestore.transactional
    def pin(transaction: object) -> None:
        snapshot = ref.get(transaction=transaction)
        if not snapshot.exists:
            raise KeyError(args.incident)
        incident = snapshot.to_dict() or {}
        existing = incident.get("objective_version")
        if existing not in {None, objective.objective_version}:
            raise ValueError("incident pins a conflicting objective version")
        transaction.set(
            ref,
            {
                "objective_id": objective.objective_id,
                "objective_version": objective.objective_version,
            },
            merge=True,
        )

    pin(transaction)
    print(
        f"objective={objective.objective_id}@{objective.objective_version} "
        f"artifact={artifact.artifact_id}:{artifact.candidate_sha} state={artifact.state}"
    )


if __name__ == "__main__":
    main()
