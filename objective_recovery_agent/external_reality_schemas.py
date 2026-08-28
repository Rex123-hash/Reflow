"""Additive, credential-free external-reality presentation contract."""

from typing import Literal

from pydantic import Field

from objective_recovery_agent.ui_schemas import PresentationModel, VerificationStatus


class ExternalEventState(PresentationModel):
    """Allowlisted event fields; never calendar/account IDs or arbitrary event text."""

    start: str | None = None
    end: str | None = None
    status: Literal["confirmed", "tentative", "cancelled"] | None = None


class ExternalObservation(PresentationModel):
    state: ExternalEventState
    observed_at: str
    verification_status: VerificationStatus
    source_freshness: Literal["FRESH_READ", "PERSISTED_READBACK"]


class ExternalResourceView(PresentationModel):
    authority: Literal["google_calendar"] = "google_calendar"
    resource_type: Literal["event"] = "event"
    presentation_label: str = "Recovery coordination commitment"
    resource_id: str
    action_id: str
    receipt_id: str
    evidence_id: str
    recovery_attempt: int = 1
    expected: ExternalEventState
    write_acknowledged_at: str | None
    receipt_status: Literal[
        "PENDING", "WRITE_ACKNOWLEDGED", "VERIFIED", "VERIFICATION_FAILED", "FAILED", "UNAVAILABLE"
    ]
    receipt_readback: ExternalObservation | None
    latest_readback: ExternalObservation | None
    fresh_read_status: Literal["NOT_REQUESTED", "READ_BACK", "NOT_FOUND", "TIMEOUT", "UNAVAILABLE"]
    checked_at: str | None = None


class ExternalRealityView(PresentationModel):
    incident_id: str
    revision: int
    resources: list[ExternalResourceView] = Field(default_factory=list)
    availability: Literal["AVAILABLE", "EVIDENCE_UNAVAILABLE"] = "EVIDENCE_UNAVAILABLE"
