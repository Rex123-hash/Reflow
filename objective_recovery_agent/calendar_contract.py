"""Deterministic contract for the single P1B Google Calendar action."""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime, timedelta
from enum import StrEnum

from pydantic import BaseModel, ConfigDict

from objective_recovery.domain.actions import derive_idempotency_key
from objective_recovery.domain.models import Action, RecoveryPlan
from objective_recovery_agent.schemas import PlanningInput

CALENDAR_ACTION_TYPE = "calendar.create_recovery_coordination_block"


class ActionRisk(StrEnum):
    LOW = "low"


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class CalendarDesiredState(ContractModel):
    summary: str
    description: str
    start: str
    end: str
    status: str = "confirmed"
    visibility: str = "private"
    transparency: str = "opaque"
    private_extended_properties: dict[str, str]


class CalendarObservedState(CalendarDesiredState):
    event_id: str
    calendar_id: str


class CalendarActionIntent(ContractModel):
    incident_id: str
    plan_id: str
    plan_revision: int
    action: Action
    calendar_id: str
    event_id: str
    receipt_id: str
    risk: ActionRisk
    desired: CalendarDesiredState
    desired_state_fingerprint: str
    protected_deadline: str
    compensation_operation: str = "events.delete"


class CalendarWriteAcknowledgement(ContractModel):
    event_id: str
    etag: str | None = None


class CalendarPolicyError(ValueError):
    """The selected plan cannot authorize the narrow P1B Calendar action."""


def _canonical(value: object) -> str:
    if isinstance(value, BaseModel):
        value = value.model_dump(mode="json")
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def desired_fingerprint(desired: CalendarDesiredState) -> str:
    return hashlib.sha256(_canonical(desired).encode()).hexdigest()


def intent_fingerprint(intent: CalendarActionIntent) -> str:
    return hashlib.sha256(_canonical(intent).encode()).hexdigest()


def project_calendar_action(
    *,
    incident_id: str,
    plan: RecoveryPlan,
    context: PlanningInput,
    calendar_id: str,
    plan_revision: int = 0,
) -> CalendarActionIntent:
    """Derive one useful block only from a genuinely cross-functional plan."""

    workstreams = {assignment.work_item_id for assignment in plan.assignments}
    people = {assignment.person_id for assignment in plan.assignments}
    if len(workstreams) < 2 or len(people) < 2:
        raise CalendarPolicyError(
            "selected plan does not coordinate at least two workstreams and assignees"
        )
    if not calendar_id.strip():
        raise CalendarPolicyError("a dedicated Calendar identifier is required")

    protected_deadline = datetime.fromisoformat(context.protected_deadline)
    start = protected_deadline - timedelta(hours=4)
    end = start + timedelta(hours=1)
    base_metadata = {
        "or_action": "recovery_coordination",
        "or_incident": incident_id,
        "or_plan": plan.plan_id,
    }
    draft = CalendarDesiredState(
        summary=f"Objective Recovery: {context.objective_label} coordination",
        description=(
            "Coordination block for the selected recovery plan's reassigned release "
            "workstreams. No attendees or notifications."
        ),
        start=start.isoformat(),
        end=end.isoformat(),
        private_extended_properties=base_metadata,
    )
    fingerprint = desired_fingerprint(draft)
    desired = draft.model_copy(
        update={
            "private_extended_properties": {
                **base_metadata,
                "or_desired": fingerprint,
            }
        }
    )
    idempotency_key = derive_idempotency_key(
        incident_id=incident_id,
        revision=plan_revision,
        action_type=CALENDAR_ACTION_TYPE,
        target=calendar_id,
        desired_state=_canonical(desired),
    )
    action_id = f"calendar-{idempotency_key[:20]}"
    event_id = f"p1b{idempotency_key}"
    action = Action(
        action_id=action_id,
        action_type=CALENDAR_ACTION_TYPE,
        target=calendar_id,
        parameters=tuple(
            sorted(
                {
                    "event_id": event_id,
                    "desired_state_fingerprint": fingerprint,
                    "operation": "events.insert",
                }.items()
            )
        ),
        idempotency_key=idempotency_key,
    )
    intent = CalendarActionIntent(
        incident_id=incident_id,
        plan_id=plan.plan_id,
        plan_revision=plan_revision,
        action=action,
        calendar_id=calendar_id,
        event_id=event_id,
        receipt_id=f"receipt-{idempotency_key}",
        risk=ActionRisk.LOW,
        desired=desired,
        desired_state_fingerprint=fingerprint,
        protected_deadline=protected_deadline.isoformat(),
    )
    authorize_calendar_action(intent, calendar_id)
    return intent


def authorize_calendar_action(intent: CalendarActionIntent, allowed_calendar_id: str) -> None:
    """Code-owned allow-list; model output never crosses this boundary directly."""

    if intent.action.action_type != CALENDAR_ACTION_TYPE:
        raise CalendarPolicyError("unsupported Calendar action type")
    if intent.calendar_id != allowed_calendar_id or intent.action.target != allowed_calendar_id:
        raise CalendarPolicyError("Calendar target is not the configured dedicated calendar")
    if intent.risk is not ActionRisk.LOW:
        raise CalendarPolicyError("only low-risk Calendar actions are allowed in P1B")
    start = datetime.fromisoformat(intent.desired.start)
    end = datetime.fromisoformat(intent.desired.end)
    if not timedelta(minutes=15) <= end - start <= timedelta(hours=2):
        raise CalendarPolicyError("coordination block duration is outside the allow-list")
    if end > datetime.fromisoformat(intent.protected_deadline):
        raise CalendarPolicyError("coordination block exceeds the protected deadline")
    expected_parameters = {
        "desired_state_fingerprint": intent.desired_state_fingerprint,
        "event_id": intent.event_id,
        "operation": "events.insert",
    }
    if dict(intent.action.parameters) != expected_parameters:
        raise CalendarPolicyError("Calendar action parameters differ from the typed intent")


def normalize_calendar_event(
    *, calendar_id: str, payload: dict[str, object]
) -> CalendarObservedState:
    extended = payload.get("extendedProperties")
    private: object = {}
    if isinstance(extended, dict):
        private = extended.get("private", {})
    start = payload.get("start")
    end = payload.get("end")
    if not isinstance(start, dict):
        start = {}
    if not isinstance(end, dict):
        end = {}
    if not isinstance(private, dict):
        private = {}

    def normalized_timestamp(value: object) -> str:
        raw = str(value)
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(UTC).isoformat()
        except ValueError:
            return raw

    return CalendarObservedState(
        event_id=str(payload.get("id", "")),
        calendar_id=calendar_id,
        summary=str(payload.get("summary", "")),
        description=str(payload.get("description", "")),
        start=normalized_timestamp(start.get("dateTime", "")),
        end=normalized_timestamp(end.get("dateTime", "")),
        status=str(payload.get("status", "")),
        visibility=str(payload.get("visibility", "default")),
        transparency=str(payload.get("transparency", "opaque")),
        private_extended_properties={str(key): str(value) for key, value in private.items()},
    )


def verification_differences(
    intent: CalendarActionIntent, observed: CalendarObservedState
) -> tuple[str, ...]:
    expected = {
        **intent.desired.model_dump(mode="json"),
        "event_id": intent.event_id,
        "calendar_id": intent.calendar_id,
    }
    actual = observed.model_dump(mode="json")
    return tuple(
        key for key in sorted(expected) if _canonical(expected[key]) != _canonical(actual.get(key))
    )


def safe_observed_state(observed: CalendarObservedState) -> tuple[tuple[str, str], ...]:
    return tuple(
        sorted(
            {
                "calendar_id": observed.calendar_id,
                "event_id": observed.event_id,
                "start": observed.start,
                "end": observed.end,
                "status": observed.status,
                "desired_fingerprint": observed.private_extended_properties.get("or_desired", ""),
            }.items()
        )
    )
