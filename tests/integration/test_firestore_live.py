"""Opt-in integration test against the real P1A Firestore database."""

from __future__ import annotations

import os
import uuid
from datetime import UTC, datetime

import pytest
from objective_recovery_agent.ledger import FirestoreWorkflowLedger
from objective_recovery_agent.schemas import DisruptionEvent, IncidentStage

pytestmark = pytest.mark.skipif(
    os.getenv("RUN_GCP_INTEGRATION") != "1",
    reason="set RUN_GCP_INTEGRATION=1 after provisioning P1A Firestore",
)


def test_real_firestore_persists_and_deduplicates_event() -> None:
    project_id = os.environ["GOOGLE_CLOUD_PROJECT"]
    ledger = FirestoreWorkflowLedger(project_id)
    event_id = f"integration-{uuid.uuid4()}"
    event = DisruptionEvent(
        event_id=event_id,
        event_type="integration_test",
        occurred_at=datetime.now(UTC).isoformat(),
        source="pytest",
        summary="Verify real Firestore persistence and event deduplication.",
        disrupted_node_ids=["person-backend-lead"],
        evidence_references=[f"integration:{event_id}"],
    )
    first = ledger.claim_event(event, "integration-message-1")
    ledger.save_checkpoint(first.incident_id, IncidentStage.IMPACT_MAPPED, {"proof": "real"})
    ledger.complete_claim(event.event_id)
    duplicate = ledger.claim_event(event, "integration-message-2")

    persisted = ledger.load_incident(first.incident_id)
    assert persisted["proof"] == "real"
    assert persisted["stage"] == IncidentStage.IMPACT_MAPPED.value
    assert duplicate.deduplicated
    assert duplicate.incident_id == first.incident_id
