"""Private Cloud Run ingress for authenticated Pub/Sub push delivery."""

from __future__ import annotations

import base64
import binascii
import json
import os
from functools import lru_cache

from fastapi import FastAPI, HTTPException, Response, status
from pydantic import ValidationError

from objective_recovery_agent.action_ledger import FirestoreActionReceiptLedger
from objective_recovery_agent.calendar_execution import CalendarExecutionService
from objective_recovery_agent.calendar_gateway import GoogleCalendarGateway
from objective_recovery_agent.ledger import FirestoreWorkflowLedger
from objective_recovery_agent.observability import OperationalEvent, emit_operational_event
from objective_recovery_agent.orchestrator import RecoveryOrchestrator
from objective_recovery_agent.planning import AdkPlanningService
from objective_recovery_agent.schemas import DisruptionEvent, PubSubEnvelope

if os.getenv("K_SERVICE"):
    from objective_recovery_agent.app_utils.telemetry import setup_telemetry

    setup_telemetry()

app = FastAPI(
    title="Objective Recovery P1B",
    description="Event-driven planning plus a verified, scoped Calendar action.",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


@lru_cache(maxsize=1)
def get_orchestrator() -> RecoveryOrchestrator:
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
    if not project_id:
        raise RuntimeError("GOOGLE_CLOUD_PROJECT is required")
    calendar_id = os.environ.get("GOOGLE_CALENDAR_ID")
    service_account_email = os.environ.get("OBJECTIVE_RECOVERY_SERVICE_ACCOUNT")
    calendar_executor = None
    if calendar_id and service_account_email:
        calendar_executor = CalendarExecutionService(
            calendar_id=calendar_id,
            ledger=FirestoreActionReceiptLedger(project_id),
            gateway=GoogleCalendarGateway(service_account_email=service_account_email),
        )
    return RecoveryOrchestrator(
        FirestoreWorkflowLedger(project_id),
        AdkPlanningService(),
        calendar_executor,
    )


@app.get("/")
def health() -> dict[str, str]:
    return {
        "status": "ready",
        "scope": "P1B",
        "terminal_state": "VERIFYING",
    }


@app.post("/apps/objective_recovery_agent/trigger/pubsub")
async def receive_pubsub(envelope_data: dict[str, object]) -> Response:
    try:
        envelope = PubSubEnvelope.model_validate(envelope_data)
        decoded = base64.b64decode(envelope.message.data, validate=True)
        disruption = DisruptionEvent.model_validate_json(decoded)
    except (ValidationError, ValueError, binascii.Error, json.JSONDecodeError) as error:
        message = envelope_data.get("message")
        message_id = message.get("messageId") if isinstance(message, dict) else None
        emit_operational_event(
            OperationalEvent.PUBSUB_DECODE_FAILED,
            message_id=message_id,
            error_category=OperationalEvent.PUBSUB_DECODE_FAILED.value,
            error_type=type(error).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"invalid Pub/Sub disruption envelope: {type(error).__name__}",
        ) from error

    try:
        result = await get_orchestrator().process(disruption, envelope.message.message_id)
    except Exception as error:
        emit_operational_event(
            OperationalEvent.WORKFLOW_FAILED,
            event_id=disruption.event_id,
            message_id=envelope.message.message_id,
            error_type=type(error).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"retryable planning failure: {type(error).__name__}",
        ) from error

    if result.in_progress:
        # A concurrent delivery may be harmless, but it can also be the first retry
        # after a worker died while its lease is still active. Keep Pub/Sub retrying
        # until the active worker completes the claim or the lease expires.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="incident claim is still in progress; retry delivery",
        )

    body = {
        "incident_id": result.incident_id,
        "deduplicated": result.deduplicated,
        "in_progress": result.in_progress,
        "stage": result.stage.value,
        "selected_plan_id": result.selected_plan_id,
        "end_to_end_latency_ms": result.end_to_end_latency_ms,
    }
    return Response(
        content=json.dumps(body),
        media_type="application/json",
        status_code=status.HTTP_200_OK,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
