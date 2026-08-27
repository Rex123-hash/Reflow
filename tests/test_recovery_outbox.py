from __future__ import annotations

from dataclasses import replace

import pytest
from objective_recovery_agent.ledger import InMemoryWorkflowLedger
from objective_recovery_agent.recovery_outbox import (
    RecoveryHandoff,
    failed_verification_fingerprint,
    handoff_id_for,
    publish_handoff,
)


class Publisher:
    def __init__(self) -> None:
        self.calls: list[RecoveryHandoff] = []
        self.fail = False

    def publish(self, handoff: RecoveryHandoff) -> str:
        self.calls.append(handoff)
        if self.fail:
            raise RuntimeError("publish crashed")
        return f"message-{len(self.calls)}"


def ledger_at_failure_boundary() -> InMemoryWorkflowLedger:
    ledger = InMemoryWorkflowLedger()
    ledger.incidents["incident-p1d"] = {
        "incident_id": "incident-p1d",
        "stage": "VERIFYING",
        "status": "action_receipt_verified",
        "revision": 43,
    }
    return ledger


def test_terminal_failure_and_outbox_commit_are_atomic_and_deterministic() -> None:
    ledger = ledger_at_failure_boundary()
    fingerprint = failed_verification_fingerprint({"invariant": False, "run": 99})
    first = ledger.persist_recovery_needed("incident-p1d", {"proof": "external"}, fingerprint)
    assert first is not None
    assert first.handoff_id == handoff_id_for("incident-p1d", fingerprint)
    assert first.source_revision == 44
    assert ledger.incidents["incident-p1d"]["stage"] == "VERIFICATION_FAILED"
    assert ledger.incidents["incident-p1d"]["revision"] == 44
    second = ledger.persist_recovery_needed("incident-p1d", {"ignored": True}, fingerprint)
    assert second == first
    assert len(ledger.recovery_outbox) == 1
    assert ledger.incidents["incident-p1d"]["revision"] == 44


def test_crash_after_commit_before_publish_republishes_same_handoff() -> None:
    ledger = ledger_at_failure_boundary()
    fingerprint = failed_verification_fingerprint({"run": 99, "passed": False})
    handoff = ledger.persist_recovery_needed("incident-p1d", {}, fingerprint)
    assert handoff is not None
    publisher = Publisher()
    publisher.fail = True
    with pytest.raises(RuntimeError, match="publish crashed"):
        publish_handoff(ledger, publisher, handoff)
    adopted = ledger.persist_recovery_needed("incident-p1d", {}, fingerprint)
    assert adopted == handoff
    publisher.fail = False
    published = publish_handoff(ledger, publisher, adopted)
    assert published.state == "PUBLISHED"
    assert [item.handoff_id for item in publisher.calls] == [handoff.handoff_id] * 2


def test_published_replay_and_resolved_incident_are_noops() -> None:
    ledger = ledger_at_failure_boundary()
    fingerprint = failed_verification_fingerprint({"run": 99})
    handoff = ledger.persist_recovery_needed("incident-p1d", {}, fingerprint)
    assert handoff is not None
    publisher = Publisher()
    publish_handoff(ledger, publisher, handoff)
    adopted = ledger.persist_recovery_needed("incident-p1d", {}, fingerprint)
    assert adopted is not None and adopted.state == "PUBLISHED"
    publish_handoff(ledger, publisher, adopted)
    assert len(publisher.calls) == 1
    ledger.incidents["incident-p1d"].update({"stage": "RESOLVED", "status": "objective_restored"})
    assert ledger.persist_recovery_needed("incident-p1d", {}, "f" * 64) is None
    assert len(ledger.recovery_outbox) == 1


def test_duplicate_publish_before_state_update_is_safe_for_consumer_identity() -> None:
    handoff = RecoveryHandoff("a" * 64, "incident-p1d", "b" * 64, 44)
    duplicate = replace(handoff)
    assert duplicate.handoff_id == handoff.handoff_id
    assert duplicate.payload() == handoff.payload()
    assert "candidate_sha" not in duplicate.payload()
    assert "plan_id" not in duplicate.payload()
    assert "stage" not in duplicate.payload()
