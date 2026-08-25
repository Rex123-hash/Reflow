"""Private Cloud Run ingress for authenticated Pub/Sub push delivery."""

from __future__ import annotations

import base64
import binascii
import json
import os
from functools import lru_cache

from fastapi import FastAPI, HTTPException, Response, status
from pydantic import ValidationError

from objective_recovery_agent.ledger import FirestoreWorkflowLedger
from objective_recovery_agent.orchestrator import RecoveryOrchestrator
from objective_recovery_agent.planning import AdkPlanningService
from objective_recovery_agent.schemas import DisruptionEvent, PubSubEnvelope

if os.getenv("K_SERVICE"):
    from objective_recovery_agent.app_utils.telemetry import setup_telemetry

    setup_telemetry()

app = FastAPI(
    title="Objective Recovery P1A",
    description="Event-driven recovery planning spine; no external action endpoints.",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


@lru_cache(maxsize=1)
def get_orchestrator() -> RecoveryOrchestrator:
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
    if not project_id:
        raise RuntimeError("GOOGLE_CLOUD_PROJECT is required")
    return RecoveryOrchestrator(
        FirestoreWorkflowLedger(project_id),
        AdkPlanningService(),
    )


@app.get("/")
def health() -> dict[str, str]:
    return {
        "status": "ready",
        "scope": "P1A",
        "terminal_state": "PLAN_SELECTED",
    }


@app.post("/apps/objective_recovery_agent/trigger/pubsub")
async def receive_pubsub(envelope_data: dict[str, object]) -> Response:
    try:
        envelope = PubSubEnvelope.model_validate(envelope_data)
        decoded = base64.b64decode(envelope.message.data, validate=True)
        disruption = DisruptionEvent.model_validate_json(decoded)
    except (ValidationError, ValueError, binascii.Error, json.JSONDecodeError) as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"invalid Pub/Sub disruption envelope: {type(error).__name__}",
        ) from error

    try:
        result = await get_orchestrator().process(disruption, envelope.message.message_id)
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"retryable planning failure: {type(error).__name__}",
        ) from error

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
