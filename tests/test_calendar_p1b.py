from __future__ import annotations

from copy import deepcopy
from dataclasses import replace
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import pytest
from objective_recovery_agent.action_ledger import (
    InMemoryActionReceiptLedger,
    _intent_dict,
    _receipt_dict,
    _receipt_from_dict,
)
from objective_recovery_agent.calendar_contract import (
    CALENDAR_ACTION_TYPE,
    CalendarActionIntent,
    CalendarPolicyError,
    CalendarWriteAcknowledgement,
    authorize_calendar_action,
    project_calendar_action,
)
from objective_recovery_agent.calendar_execution import (
    CalendarExecutionFailure,
    CalendarExecutionService,
)
from objective_recovery_agent.calendar_gateway import (
    CalendarAdapterError,
    CalendarErrorCategory,
)
from objective_recovery_agent.ledger import InMemoryWorkflowLedger
from objective_recovery_agent.orchestrator import RecoveryOrchestrator
from objective_recovery_agent.schemas import DisruptionEvent, ObjectiveRecord
from objective_recovery_agent.world import planning_input

from objective_recovery.domain.errors import DuplicateIdempotencyKeyError
from objective_recovery.domain.models import (
    Assignment,
    EvidenceKind,
    IncidentStatus,
    ReceiptStatus,
    RecoveryPlan,
)
from objective_recovery.domain.state_machine import Incident

CALENDAR_ID = "p1b-demo@group.calendar.google.com"


def disruption(event_id: str = "p1b-calendar-event") -> DisruptionEvent:
    return DisruptionEvent(
        event_id=event_id,
        event_type="person_unavailable",
        occurred_at=datetime(2026, 8, 25, 12, tzinfo=UTC).isoformat(),
        source="p1b-test",
        summary="Backend lead unavailable before the protected release.",
        disrupted_node_ids=["person-backend-lead"],
        evidence_references=["event:test:p1b"],
    )


def selected_plan() -> RecoveryPlan:
    return RecoveryPlan(
        plan_id="risk-min-plan",
        strategy="risk-minimization-first",
        risk_score=Decimal(20),
        assignments=(
            Assignment(
                "work-api-migration",
                "person-backup",
                frozenset({"api", "python"}),
                Decimal(80),
            ),
            Assignment(
                "work-api-tests",
                "person-qa",
                frozenset({"qa", "python"}),
                Decimal(75),
            ),
            Assignment(
                "work-release-notes",
                "person-generalist",
                frozenset({"release", "documentation"}),
                Decimal(80),
            ),
        ),
        expected_objective_effect="Coordinates implementation and QA before release.",
        risks=("Coordination overhead between implementation and test authoring.",),
        required_evidence=("Calendar coordination block exists.",),
    )


def intent() -> CalendarActionIntent:
    event = disruption()
    return project_calendar_action(
        incident_id="incident-p1b",
        plan=selected_plan(),
        context=planning_input("incident-p1b", event),
        calendar_id=CALENDAR_ID,
    )


def test_fresh_objective_deadline_drives_calendar_projection() -> None:
    objective = ObjectiveRecord(
        objective_id="release-qualification-fresh",
        label="SHIP RELEASE V2",
        deadline_local="2026-09-01 18:00:00",
        deadline_timezone="Etc/UTC",
        deadline_at_utc="2026-09-01T18:00:00Z",
        objective_version=1,
        protected_commitment=True,
    )
    context = planning_input(
        "incident-fresh",
        disruption().model_copy(update={"objective_id": objective.objective_id}),
        objective,
    )
    projected = project_calendar_action(
        incident_id="incident-fresh",
        plan=selected_plan(),
        context=context,
        calendar_id=CALENDAR_ID,
    )

    assert projected.protected_deadline == "2026-09-01T18:00:00+00:00"
    assert projected.desired.start == "2026-09-01T14:00:00+00:00"
    assert projected.desired.end == "2026-09-01T15:00:00+00:00"


def event_payload(action: CalendarActionIntent, *, summary: str | None = None) -> dict[str, object]:
    desired = action.desired
    return {
        "id": action.event_id,
        "etag": '"etag-1"',
        "summary": desired.summary if summary is None else summary,
        "description": desired.description,
        "start": {"dateTime": desired.start.replace("+00:00", "Z")},
        "end": {"dateTime": desired.end.replace("+00:00", "Z")},
        "status": desired.status,
        "visibility": desired.visibility,
        "transparency": desired.transparency,
        "extendedProperties": {"private": desired.private_extended_properties},
    }


class FakeCalendarGateway:
    def __init__(self) -> None:
        self.events: dict[str, dict[str, object]] = {}
        self.insert_calls = 0
        self.get_calls = 0
        self.insert_errors: list[CalendarAdapterError] = []
        self.readback_summary: str | None = None

    def insert_event(self, action: CalendarActionIntent) -> CalendarWriteAcknowledgement:
        self.insert_calls += 1
        if self.insert_errors:
            raise self.insert_errors.pop(0)
        if action.event_id in self.events:
            raise CalendarAdapterError(CalendarErrorCategory.CONFLICT, retryable=False)
        self.events[action.event_id] = event_payload(action)
        return CalendarWriteAcknowledgement(event_id=action.event_id, etag='"etag-1"')

    def get_event(self, calendar_id: str, event_id: str) -> dict[str, object] | None:
        assert calendar_id == CALENDAR_ID
        self.get_calls += 1
        payload = self.events.get(event_id)
        if payload is None:
            return None
        result = deepcopy(payload)
        if self.readback_summary is not None:
            result["summary"] = self.readback_summary
        return result


class RecordingLedger(InMemoryActionReceiptLedger):
    def __init__(self) -> None:
        super().__init__()
        self.status_history: list[ReceiptStatus] = []

    def record_receipt(self, receipt: Any) -> None:
        self.status_history.append(receipt.status)
        super().record_receipt(receipt)


def service(
    ledger: InMemoryActionReceiptLedger | None = None,
    gateway: FakeCalendarGateway | None = None,
) -> tuple[CalendarExecutionService, InMemoryActionReceiptLedger, FakeCalendarGateway]:
    chosen_ledger = ledger or InMemoryActionReceiptLedger()
    chosen_gateway = gateway or FakeCalendarGateway()
    return (
        CalendarExecutionService(
            calendar_id=CALENDAR_ID,
            ledger=chosen_ledger,
            gateway=chosen_gateway,
            sleep=lambda _: None,
        ),
        chosen_ledger,
        chosen_gateway,
    )


def test_supported_selected_plan_maps_to_narrow_reversible_action() -> None:
    action = intent()
    assert action.action.action_type == CALENDAR_ACTION_TYPE
    assert action.risk.value == "low"
    assert action.compensation_operation == "events.delete"
    assert action.calendar_id == CALENDAR_ID
    assert len(action.event_id) == 67
    assert not hasattr(action.desired, "attendees")


def test_unsupported_or_wrong_calendar_action_is_rejected() -> None:
    action = intent()
    unsupported = action.model_copy(
        update={"action": replace(action.action, action_type="calendar.delete_arbitrary_event")}
    )
    with pytest.raises(CalendarPolicyError, match="unsupported"):
        authorize_calendar_action(unsupported, CALENDAR_ID)
    with pytest.raises(CalendarPolicyError, match="target"):
        authorize_calendar_action(action, "primary")


def test_plan_without_real_cross_functional_coordination_is_rejected() -> None:
    plan = replace(selected_plan(), assignments=selected_plan().assignments[:1])
    with pytest.raises(CalendarPolicyError, match="two workstreams"):
        project_calendar_action(
            incident_id="incident-p1b",
            plan=plan,
            context=planning_input("incident-p1b", disruption()),
            calendar_id=CALENDAR_ID,
        )


def test_same_intent_has_stable_internal_and_external_idempotency() -> None:
    assert intent() == intent()
    assert intent().action.idempotency_key == intent().event_id.removeprefix("p1b")


def test_same_key_with_different_intent_is_a_collision() -> None:
    ledger = InMemoryActionReceiptLedger()
    action = intent()
    ledger.claim(action)
    conflicting = action.model_copy(
        update={"desired": action.desired.model_copy(update={"summary": "Different intent"})}
    )
    with pytest.raises(DuplicateIdempotencyKeyError):
        ledger.claim(conflicting)


def test_firestore_intent_payload_uses_parameter_map_not_nested_arrays() -> None:
    payload = _intent_dict(intent())
    action = payload["action"]
    assert isinstance(action, dict)
    assert action["parameters"] == {
        "desired_state_fingerprint": intent().desired_state_fingerprint,
        "event_id": intent().event_id,
        "operation": "events.insert",
    }


def test_write_ack_is_persisted_before_separate_readback_verification() -> None:
    ledger = RecordingLedger()
    executor, _, gateway = service(ledger=ledger)
    receipt = executor.execute(intent())
    assert ledger.status_history == [ReceiptStatus.WRITE_ACKNOWLEDGED, ReceiptStatus.VERIFIED]
    assert receipt.write_acknowledged_at is not None
    assert receipt.read_back_at is not None
    assert receipt.write_acknowledged_at <= receipt.read_back_at
    assert gateway.insert_calls == 1
    assert gateway.get_calls == 2  # preflight GET and a new post-ack GET


def test_independent_matching_readback_creates_verified_external_receipt() -> None:
    executor, ledger, _ = service()
    action = intent()
    receipt = executor.execute(action)
    assert receipt.status is ReceiptStatus.VERIFIED
    assert receipt.evidence_kind is EvidenceKind.EXTERNAL
    assert receipt.external_event_id == action.event_id
    assert ledger.receipt_for(action.action.idempotency_key) == receipt


def test_firestore_verified_receipt_uses_observed_state_map_and_round_trips() -> None:
    executor, _, _ = service()
    receipt = executor.execute(intent())
    payload = _receipt_dict(receipt)
    assert isinstance(payload["observed_state"], dict)
    assert payload["observed_state"]["event_id"] == intent().event_id
    assert _receipt_from_dict(payload) == receipt


def test_readback_mismatch_is_durable_verification_failure() -> None:
    gateway = FakeCalendarGateway()
    gateway.readback_summary = "Unexpected server state"
    executor, ledger, _ = service(gateway=gateway)
    action = intent()
    receipt = executor.execute(action)
    assert receipt.status is ReceiptStatus.VERIFICATION_FAILED
    assert receipt.verification_differences == ("summary",)
    assert ledger.receipt_for(action.action.idempotency_key) == receipt

    gateway.readback_summary = None
    retried = executor.execute(action)
    assert retried.status is ReceiptStatus.VERIFIED
    assert retried.verification_differences == ()


def test_semantically_equal_calendar_timezone_offset_verifies() -> None:
    gateway = FakeCalendarGateway()
    action = intent()
    gateway.events[action.event_id] = event_payload(action)
    gateway.events[action.event_id]["start"] = {"dateTime": "2026-08-28T18:30:00+05:30"}
    gateway.events[action.event_id]["end"] = {"dateTime": "2026-08-28T19:30:00+05:30"}
    executor, _, _ = service(gateway=gateway)
    receipt = executor.execute(action)
    assert receipt.status is ReceiptStatus.VERIFIED
    assert gateway.insert_calls == 0


def test_transient_write_error_is_bounded_and_retried() -> None:
    gateway = FakeCalendarGateway()
    gateway.insert_errors.append(
        CalendarAdapterError(CalendarErrorCategory.SERVER, retryable=True, status_code=503)
    )
    executor, _, _ = service(gateway=gateway)
    receipt = executor.execute(intent())
    assert receipt.status is ReceiptStatus.VERIFIED
    assert gateway.insert_calls == 2


def test_permission_failure_is_not_retried_or_scope_broadened() -> None:
    gateway = FakeCalendarGateway()
    gateway.insert_errors.append(
        CalendarAdapterError(CalendarErrorCategory.PERMISSION, retryable=False, status_code=403)
    )
    executor, ledger, _ = service(gateway=gateway)
    action = intent()
    with pytest.raises(CalendarExecutionFailure) as captured:
        executor.execute(action)
    assert not captured.value.retryable
    assert gateway.insert_calls == 1
    assert ledger.receipt_for(action.action.idempotency_key).status is ReceiptStatus.FAILED  # type: ignore[union-attr]


class CrashAfterWriteLedger(InMemoryActionReceiptLedger):
    def __init__(self) -> None:
        super().__init__()
        self.crash_once = True

    def record_receipt(self, receipt: Any) -> None:
        if receipt.status is ReceiptStatus.WRITE_ACKNOWLEDGED and self.crash_once:
            self.crash_once = False
            raise RuntimeError("simulated crash after Calendar write")
        super().record_receipt(receipt)


def test_crash_after_write_recovers_existing_external_identity_without_duplicate() -> None:
    ledger = CrashAfterWriteLedger()
    gateway = FakeCalendarGateway()
    executor, _, _ = service(ledger=ledger, gateway=gateway)
    action = intent()
    with pytest.raises(RuntimeError, match="simulated crash"):
        executor.execute(action)
    assert gateway.insert_calls == 1
    assert list(gateway.events) == [action.event_id]

    receipt = executor.execute(action)
    assert receipt.status is ReceiptStatus.VERIFIED
    assert gateway.insert_calls == 1
    assert list(gateway.events) == [action.event_id]


def test_retry_of_verified_action_is_noop_and_creates_no_second_object() -> None:
    executor, _, gateway = service()
    action = intent()
    first = executor.execute(action)
    calls = (gateway.insert_calls, gateway.get_calls)
    second = executor.execute(action)
    assert second == first
    assert (gateway.insert_calls, gateway.get_calls) == calls
    assert len(gateway.events) == 1


def test_restart_after_acknowledgement_resumes_only_with_readback() -> None:
    ledger = InMemoryActionReceiptLedger()
    gateway = FakeCalendarGateway()
    action = intent()
    pending = ledger.claim(action).receipt
    gateway.events[action.event_id] = event_payload(action)
    acknowledged = replace(
        pending,
        status=ReceiptStatus.WRITE_ACKNOWLEDGED,
        evidence_kind=EvidenceKind.EXTERNAL,
        write_acknowledged_at=datetime.now(UTC),
    )
    ledger.record_receipt(acknowledged)

    executor, _, _ = service(ledger=ledger, gateway=gateway)
    receipt = executor.execute(action)
    assert receipt.status is ReceiptStatus.VERIFIED
    assert gateway.insert_calls == 0
    assert gateway.get_calls == 1


@pytest.mark.asyncio
async def test_duplicate_pubsub_during_execution_never_reaches_calendar_executor() -> None:
    ledger = InMemoryWorkflowLedger()
    event = disruption("p1b-overlap")
    ledger.claim_event(event, "active-worker")

    class NeverPlanner:
        async def generate_candidates(self, planning_input: Any) -> Any:
            pytest.fail("duplicate delivery must not replan")

        async def critique(self, candidates: Any, **kwargs: Any) -> Any:
            pytest.fail("duplicate delivery must not critique")

    class NeverCalendar:
        def execute(self, action: Any) -> Any:
            pytest.fail("duplicate delivery must not mutate Calendar")

        def execute_selected_plan(self, **kwargs: Any) -> Any:
            pytest.fail("duplicate delivery must not mutate Calendar")

    result = await RecoveryOrchestrator(ledger, NeverPlanner(), NeverCalendar()).process(
        event, "redelivery"
    )
    assert result.in_progress


def test_verified_action_receipt_does_not_resolve_incident() -> None:
    executor, _, _ = service()
    assert executor.execute(intent()).status is ReceiptStatus.VERIFIED
    incident = Incident("incident-p1b", "release-v2", status=IncidentStatus.PLAN_SELECTED)
    incident.transition_to(IncidentStatus.EXECUTING)
    incident.transition_to(IncidentStatus.VERIFYING)
    assert incident.status is IncidentStatus.VERIFYING
    assert IncidentStatus.RESOLVED not in incident.history
