"""Read-only projections of existing external receipts and independent observations."""

from __future__ import annotations

import asyncio
import re
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Protocol

from google.auth.exceptions import GoogleAuthError

from objective_recovery_agent.calendar_contract import (
    CalendarActionIntent,
    normalize_calendar_event,
    verification_differences,
)
from objective_recovery_agent.calendar_gateway import CalendarAdapterError
from objective_recovery_agent.external_reality_schemas import (
    ExternalEventState,
    ExternalObservation,
    ExternalRealityView,
    ExternalResourceView,
)
from objective_recovery_agent.p1d import _calendar_intent
from objective_recovery_agent.ui_schemas import VerificationStatus
from objective_recovery_agent.ui_store import PresentationStore


class CalendarReader(Protocol):
    """No mutation method is available to the presentation service."""

    def get_event(self, calendar_id: str, event_id: str) -> dict[str, object] | None: ...


def _timestamp(value: object) -> str | None:
    try:
        parsed = value if isinstance(value, datetime) else datetime.fromisoformat(str(value))
        return parsed.astimezone(UTC).isoformat() if parsed.tzinfo else None
    except (ValueError, TypeError):
        return None


def _state(value: dict[str, Any]) -> ExternalEventState:
    status = value.get("status")
    return ExternalEventState(
        start=_timestamp(value.get("start")),
        end=_timestamp(value.get("end")),
        status=status if status in ("confirmed", "tentative", "cancelled") else None,
    )


@dataclass(frozen=True)
class CalendarContext:
    view: ExternalRealityView
    intent: CalendarActionIntent | None = None


class ExternalRealityService:
    def __init__(
        self,
        store: PresentationStore,
        *,
        allowed_calendar_id: str | None = None,
        reader_factory: Callable[[], CalendarReader] | None = None,
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
        timeout_seconds: float = 6,
    ) -> None:
        self._store = store
        self._allowed_calendar_id = allowed_calendar_id
        self._reader_factory = reader_factory
        self._clock = clock
        self._timeout_seconds = timeout_seconds

    def persisted(self, incident_id: str) -> CalendarContext:
        # Only the stored incident -> receipt -> claim determines the event. No caller event ID.
        incident = self._store.load_incident(incident_id)
        empty = ExternalRealityView(incident_id=incident_id, revision=incident.get("revision", 0))
        receipt_id = incident.get("action_receipt_id")
        loaded = (
            self._store.load_action_evidence(receipt_id) if isinstance(receipt_id, str) else None
        )
        if loaded is None:
            return CalendarContext(empty)
        claim, receipt = loaded
        try:
            intent = _calendar_intent(claim)
        except (KeyError, ValueError, TypeError):
            return CalendarContext(empty)
        if (
            intent.incident_id != incident_id
            or intent.receipt_id != receipt_id
            or receipt.get("incident_id") != incident_id
            or receipt.get("receipt_id") != receipt_id
            or receipt.get("action_id") != intent.action.action_id
            or receipt.get("external_event_id") != intent.event_id
            or receipt.get("external_calendar_id") != intent.calendar_id
            or not re.fullmatch(r"p1b[a-f0-9]{64}", intent.event_id)
        ):
            return CalendarContext(empty)
        original = None
        read_at = _timestamp(receipt.get("read_back_at"))
        observed = receipt.get("observed_state")
        receipt_status = str(receipt.get("status", "unavailable")).upper()
        statuses = {"PENDING", "WRITE_ACKNOWLEDGED", "VERIFIED", "VERIFICATION_FAILED", "FAILED"}
        if receipt_status not in statuses:
            receipt_status = "UNAVAILABLE"
        if isinstance(observed, dict) and read_at and observed.get("event_id") == intent.event_id:
            original = ExternalObservation(
                state=_state(observed),
                observed_at=read_at,
                verification_status=(
                    VerificationStatus.PASSED
                    if receipt_status == "VERIFIED"
                    else VerificationStatus.FAILED
                    if receipt_status == "VERIFICATION_FAILED"
                    else VerificationStatus.UNAVAILABLE
                ),
                source_freshness="PERSISTED_READBACK",
            )
        latest = original
        revision = self._store.load_plan_revision(incident_id, 2) or {}
        closure = revision.get("calendar_closure_evidence", {})
        if isinstance(closure, dict):
            closed_at = _timestamp(closure.get("observed_at"))
            closed_state = closure.get("observed_state")
            if (
                isinstance(closed_state, dict)
                and closed_at
                and closure.get("source_reference") == f"google_calendar:{intent.event_id}"
                and closed_state.get("event_id") == intent.event_id
                and (latest is None or closed_at > latest.observed_at)
            ):
                latest = ExternalObservation(
                    state=_state(closed_state),
                    observed_at=closed_at,
                    verification_status=(
                        VerificationStatus.PASSED
                        if closure.get("passed") is True
                        else VerificationStatus.FAILED
                        if closure.get("passed") is False
                        else VerificationStatus.UNAVAILABLE
                    ),
                    source_freshness="PERSISTED_READBACK",
                )
        resource = ExternalResourceView.model_validate(
            {
                "resource_id": intent.event_id,
                "action_id": intent.action.action_id,
                "receipt_id": receipt_id,
                "evidence_id": f"calendar:{receipt_id}",
                "expected": _state(intent.desired.model_dump()),
                "write_acknowledged_at": _timestamp(receipt.get("write_acknowledged_at")),
                "receipt_status": receipt_status,
                "receipt_readback": original,
                "latest_readback": latest,
                "fresh_read_status": "NOT_REQUESTED",
            }
        )
        return CalendarContext(
            empty.model_copy(update={"resources": [resource], "availability": "AVAILABLE"}), intent
        )

    def _fresh(self, intent: CalendarActionIntent) -> ExternalObservation | None:
        assert self._reader_factory is not None
        payload = self._reader_factory().get_event(intent.calendar_id, intent.event_id)
        if payload is None:
            return None
        observed = normalize_calendar_event(calendar_id=intent.calendar_id, payload=payload)
        differences = verification_differences(intent, observed)
        return ExternalObservation(
            state=_state(observed.model_dump()),
            observed_at=self._clock().isoformat(),
            verification_status=VerificationStatus.FAILED
            if differences
            else VerificationStatus.PASSED,
            source_freshness="FRESH_READ",
        )

    async def read(self, incident_id: str) -> ExternalRealityView:
        context = await asyncio.to_thread(self.persisted, incident_id)
        if not context.view.resources or context.intent is None:
            return context.view
        resource = context.view.resources[0]
        updates: dict[str, Any] = {"fresh_read_status": "UNAVAILABLE"}
        if self._reader_factory and context.intent.calendar_id == self._allowed_calendar_id:
            try:
                current = await asyncio.wait_for(
                    asyncio.to_thread(self._fresh, context.intent), self._timeout_seconds
                )
                updates = {"fresh_read_status": "NOT_FOUND" if current is None else "READ_BACK"}
                if current is not None:
                    updates["latest_readback"] = current
            except TimeoutError:
                updates = {"fresh_read_status": "TIMEOUT"}
            except (CalendarAdapterError, GoogleAuthError, ValueError):
                # Do not surface raw provider errors or private resource identifiers.
                pass
        updates["checked_at"] = self._clock().isoformat()
        return context.view.model_copy(update={"resources": [resource.model_copy(update=updates)]})
