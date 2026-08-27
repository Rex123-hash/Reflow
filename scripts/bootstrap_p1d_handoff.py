"""One-time idempotent handoff bootstrap for the historical revision-44 incident."""

from __future__ import annotations

import argparse

from objective_recovery_agent.ledger import FirestoreWorkflowLedger
from objective_recovery_agent.recovery_outbox import (
    PubSubRecoveryPublisher,
    failed_verification_fingerprint,
    publish_handoff,
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", required=True)
    parser.add_argument("--incident", default="incident-a1864f07664e057ef422")
    parser.add_argument("--topic", default="objective-recovery-p1d")
    args = parser.parse_args()
    ledger = FirestoreWorkflowLedger(args.project)
    incident = ledger.load_incident(args.incident)
    if (
        incident.get("stage") != "VERIFICATION_FAILED"
        or incident.get("status") != "recovery_incomplete"
    ):
        raise ValueError("historical incident is not at VERIFICATION_FAILED/recovery_incomplete")
    verification = incident.get("github_verification")
    evidence = incident.get("github_evidence")
    if not isinstance(verification, dict) or not isinstance(evidence, dict):
        raise ValueError("historical incident lacks exact P1C evidence")
    fingerprint = failed_verification_fingerprint(
        {"verification": verification, "evidence": evidence}
    )
    handoff = ledger.persist_recovery_needed(args.incident, {}, fingerprint)
    if handoff is None:
        raise ValueError("resolved incidents cannot be bootstrapped")
    published = publish_handoff(
        ledger,
        PubSubRecoveryPublisher(args.project, args.topic),
        handoff,
    )
    print(
        f"handoff_id={published.handoff_id} incident_id={published.incident_id} "
        f"source_revision={published.source_revision} state={published.state}"
    )


if __name__ == "__main__":
    main()
