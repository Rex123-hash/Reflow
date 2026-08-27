from __future__ import annotations

import pytest
from objective_recovery_agent.ledger import InMemoryWorkflowLedger, incident_id_for
from objective_recovery_agent.orchestrator import (
    P1CContinuationPublishFailure,
    ProcessResult,
    RecoveryOrchestrator,
)
from objective_recovery_agent.recovery_outbox import (
    P1CContinuationHandoff,
    p1c_handoff_id_for,
    publish_p1c_handoff,
)
from objective_recovery_agent.schemas import DisruptionEvent, IncidentStage


class Publisher:
    def __init__(self) -> None:
        self.calls: list[P1CContinuationHandoff] = []
        self.fail = False

    def publish(self, handoff: P1CContinuationHandoff) -> str:
        self.calls.append(handoff)
        if self.fail:
            raise RuntimeError("publish crashed")
        return f"p1c-message-{len(self.calls)}"


def ledger_at_p1b_boundary() -> InMemoryWorkflowLedger:
    ledger = InMemoryWorkflowLedger()
    ledger.incidents["incident-p1b"] = {
        "incident_id": "incident-p1b",
        "selected_plan_id": "plan-selected-by-p1b",
        "stage": "EXECUTING",
        "status": "executing",
        "revision": 12,
    }
    return ledger


def terminal_fields() -> dict[str, str]:
    return {
        "status": "action_receipt_verified",
        "action_receipt_id": "receipt-calendar-effect",
        "action_receipt_status": "verified",
    }


def test_p1b_terminal_state_and_p1c_outbox_are_atomic_and_deterministic() -> None:
    ledger = ledger_at_p1b_boundary()
    fingerprint = "a" * 64
    handoff = ledger.persist_p1c_continuation("incident-p1b", terminal_fields(), fingerprint)
    assert handoff.handoff_id == p1c_handoff_id_for("incident-p1b", fingerprint)
    assert handoff.payload() == {"incident_id": "incident-p1b"}
    assert ledger.incidents["incident-p1b"]["stage"] == "VERIFYING"
    assert ledger.incidents["incident-p1b"]["action_receipt_status"] == "verified"
    assert ledger.incidents["incident-p1b"]["revision"] == 13
    assert len(ledger.recovery_outbox) == 1

    replay = ledger.persist_p1c_continuation("incident-p1b", terminal_fields(), fingerprint)
    assert replay == handoff
    assert ledger.incidents["incident-p1b"]["revision"] == 13
    assert len(ledger.recovery_outbox) == 1


def test_p1c_publish_crash_and_completion_marker_crash_are_replay_safe() -> None:
    ledger = ledger_at_p1b_boundary()
    handoff = ledger.persist_p1c_continuation("incident-p1b", terminal_fields(), "b" * 64)
    publisher = Publisher()
    publisher.fail = True
    try:
        publish_p1c_handoff(ledger, publisher, handoff)
    except RuntimeError as error:
        assert str(error) == "publish crashed"
    else:
        raise AssertionError("the simulated publisher must fail")

    assert ledger.recovery_outbox[handoff.handoff_id]["state"] == "PENDING"
    publisher.fail = False
    published = publish_p1c_handoff(ledger, publisher, handoff)
    assert published.state == "PUBLISHED"

    adopted = ledger.persist_p1c_continuation("incident-p1b", terminal_fields(), "b" * 64)
    publish_p1c_handoff(ledger, publisher, adopted)
    assert len(publisher.calls) == 2


def test_bridge_requires_authoritative_plan_and_verified_receipt() -> None:
    ledger = ledger_at_p1b_boundary()
    ledger.incidents["incident-p1b"].pop("selected_plan_id")
    try:
        ledger.persist_p1c_continuation("incident-p1b", terminal_fields(), "c" * 64)
    except ValueError as error:
        assert "selected plan" in str(error)
    else:
        raise AssertionError("missing selected plan must fail closed")

    ledger = ledger_at_p1b_boundary()
    fields = terminal_fields()
    fields["action_receipt_status"] = "verification_failed"
    try:
        ledger.persist_p1c_continuation("incident-p1b", fields, "c" * 64)
    except ValueError as error:
        assert "VERIFIED" in str(error)
    else:
        raise AssertionError("unverified Calendar evidence must fail closed")


@pytest.mark.asyncio
async def test_pending_p1c_publish_does_not_reclassify_verified_p1b_as_planning_failure() -> None:
    ledger = InMemoryWorkflowLedger()
    disruption = DisruptionEvent(
        event_id="bridge-publish-retry",
        event_type="resource-unavailable",
        occurred_at="2026-08-27T12:00:00+00:00",
        source="test",
        summary="Backend lead unavailable for the protected release.",
        disrupted_node_ids=["person-backend-lead"],
        evidence_references=["test:evidence"],
    )

    class NeverPlanner:
        async def generate_candidates(self, planning_input: object) -> object:
            raise AssertionError("planner should be replaced by the simulated continuation")

        async def critique(self, candidates: object, **kwargs: object) -> object:
            raise AssertionError("critic should be replaced by the simulated continuation")

    class SimulatedOrchestrator(RecoveryOrchestrator):
        async def _continue(
            self,
            incident_id: str,
            disruption: DisruptionEvent,
            *,
            attempt: int,
            resumed: bool,
        ) -> ProcessResult:
            del disruption, attempt, resumed
            ledger.save_checkpoint(
                incident_id,
                IncidentStage.VERIFYING,
                {"status": "action_receipt_verified", "action_receipt_status": "verified"},
            )
            raise P1CContinuationPublishFailure from RuntimeError("publisher unavailable")

    runner = SimulatedOrchestrator(ledger, NeverPlanner())  # type: ignore[arg-type]
    with pytest.raises(P1CContinuationPublishFailure):
        await runner.process(disruption, "transport-message")
    incident = ledger.load_incident(incident_id_for(disruption.event_id))
    assert incident["stage"] == "VERIFYING"
    assert incident["status"] == "action_receipt_verified"
    assert ledger.claims[disruption.event_id]["state"] == "retryable"
