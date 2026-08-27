"""Private Cloud Run ingress for authenticated Pub/Sub push delivery."""

from __future__ import annotations

import base64
import binascii
import json
import os
from functools import lru_cache
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Response, status
from fastapi.responses import JSONResponse
from google.api_core.exceptions import GoogleAPIError
from pydantic import ValidationError

from objective_recovery_agent.action_ledger import FirestoreActionReceiptLedger
from objective_recovery_agent.calendar_execution import CalendarExecutionService
from objective_recovery_agent.calendar_gateway import GoogleCalendarGateway
from objective_recovery_agent.github_execution import (
    GitHubP1CService,
    GitHubP1DPromotionService,
    P1CState,
)
from objective_recovery_agent.github_gateway import RequestsGitHubGateway
from objective_recovery_agent.github_ledger import FirestoreGitHubActionLedger
from objective_recovery_agent.ledger import FirestoreWorkflowLedger
from objective_recovery_agent.objective_store import FirestoreObjectiveStore
from objective_recovery_agent.observability import OperationalEvent, emit_operational_event
from objective_recovery_agent.orchestrator import RecoveryOrchestrator
from objective_recovery_agent.p1c import P1CConfiguration, authorize_p1c_intent
from objective_recovery_agent.p1d import (
    REQUIRED_COMPATIBILITY_STEP,
    P1DConfiguration,
    P1DService,
    P1DState,
)
from objective_recovery_agent.p1d_store import FirestoreP1DStore
from objective_recovery_agent.planning import AdkPlanningService
from objective_recovery_agent.presentation import PresentationService
from objective_recovery_agent.recovery_outbox import PubSubRecoveryPublisher
from objective_recovery_agent.schemas import (
    DisruptionEvent,
    P1CContinuation,
    P1DContinuation,
    PubSubEnvelope,
)
from objective_recovery_agent.ui_schemas import (
    EvidencePageView,
    ExecutionEventsView,
    ObjectiveFilter,
    ObjectivesView,
    OperatorContextView,
    OverviewView,
    RecoveryCaseView,
)
from objective_recovery_agent.ui_store import FirestorePresentationStore

if os.getenv("K_SERVICE"):
    from objective_recovery_agent.app_utils.telemetry import setup_telemetry

    setup_telemetry()

app = FastAPI(
    title="Reflow Objective Recovery API",
    description="Recovery execution plus stable read-only presentation resources.",
    docs_url=None,
    redoc_url=None,
    openapi_url="/openapi.json",
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
        "scope": "P1D",
        "terminal_state": "RESOLVED",
    }


@lru_cache(maxsize=1)
def get_presentation_service() -> PresentationService:
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
    if not project_id:
        raise RuntimeError("GOOGLE_CLOUD_PROJECT is required")
    return PresentationService(FirestorePresentationStore(project_id))


type PresentationValue = (
    OverviewView
    | ObjectivesView
    | RecoveryCaseView
    | EvidencePageView
    | ExecutionEventsView
    | OperatorContextView
)


def _presentation_response(
    value: PresentationValue,
    if_none_match: str | None,
) -> Response:
    revision = value.revision
    etag = f'W/"{revision}"'
    if if_none_match == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers={"ETag": etag})
    return JSONResponse(
        content=value.model_dump(mode="json"),
        headers={"ETag": etag, "Cache-Control": "private, no-cache"},
    )


def _presentation_failure(error: Exception) -> HTTPException:
    if isinstance(error, KeyError):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "resource_not_found", "message": str(error.args[0])},
        )
    if isinstance(error, ValueError):
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "malformed_request", "message": str(error)},
        )
    if isinstance(error, GoogleAPIError):
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "backend_infrastructure_unavailable",
                "message": "Presentation data is temporarily unavailable.",
            },
        )
    raise error


@app.get("/api/v1/ui/overview", response_model=OverviewView)
def ui_overview(
    service: Annotated[PresentationService, Depends(get_presentation_service)],
    if_none_match: Annotated[str | None, Header()] = None,
) -> Response:
    try:
        return _presentation_response(service.overview(), if_none_match)
    except Exception as error:
        raise _presentation_failure(error) from error


@app.get("/api/v1/ui/objectives", response_model=ObjectivesView)
def ui_objectives(
    service: Annotated[PresentationService, Depends(get_presentation_service)],
    selected_filter: Annotated[ObjectiveFilter, Query(alias="status")] = ObjectiveFilter.ALL,
    if_none_match: Annotated[str | None, Header()] = None,
) -> Response:
    try:
        return _presentation_response(service.objectives(selected_filter), if_none_match)
    except Exception as error:
        raise _presentation_failure(error) from error


@app.get("/api/v1/ui/recoveries/{incident_id}", response_model=RecoveryCaseView)
def ui_recovery(
    incident_id: str,
    service: Annotated[PresentationService, Depends(get_presentation_service)],
    if_none_match: Annotated[str | None, Header()] = None,
) -> Response:
    try:
        return _presentation_response(service.recovery_case(incident_id), if_none_match)
    except Exception as error:
        raise _presentation_failure(error) from error


@app.get("/api/v1/ui/evidence/{incident_id}", response_model=EvidencePageView)
def ui_evidence(
    incident_id: str,
    service: Annotated[PresentationService, Depends(get_presentation_service)],
    if_none_match: Annotated[str | None, Header()] = None,
) -> Response:
    try:
        return _presentation_response(service.evidence_page(incident_id), if_none_match)
    except Exception as error:
        raise _presentation_failure(error) from error


@app.get(
    "/api/v1/ui/recoveries/{incident_id}/events",
    response_model=ExecutionEventsView,
)
def ui_events(
    incident_id: str,
    service: Annotated[PresentationService, Depends(get_presentation_service)],
    after: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    if_none_match: Annotated[str | None, Header()] = None,
) -> Response:
    try:
        return _presentation_response(service.events(incident_id, after, limit), if_none_match)
    except Exception as error:
        raise _presentation_failure(error) from error


@app.get("/api/v1/ui/operator/context", response_model=OperatorContextView)
def ui_operator_context(
    incident_id: str,
    service: Annotated[PresentationService, Depends(get_presentation_service)],
    if_none_match: Annotated[str | None, Header()] = None,
) -> Response:
    try:
        value = service.operator_context(incident_id)
        return _presentation_response(value, if_none_match)
    except Exception as error:
        raise _presentation_failure(error) from error


@lru_cache(maxsize=1)
def get_p1c_service() -> tuple[GitHubP1CService, FirestoreWorkflowLedger, P1CConfiguration]:
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
    token = os.environ.get("GITHUB_P1C_TOKEN")
    if not project_id or not token:
        raise RuntimeError("GOOGLE_CLOUD_PROJECT and GITHUB_P1C_TOKEN are required")
    workflow = FirestoreWorkflowLedger(project_id)
    configuration = P1CConfiguration(
        repository=os.environ.get("GITHUB_P1C_REPOSITORY", "Rex123-hash/EXperiments"),
        candidate_sha=os.environ.get(
            "GITHUB_P1C_CANDIDATE_SHA",
            "5353cf7c664f384d6642b5348c7f190187b06b4c",
        ),
        workflow_id=int(os.environ.get("GITHUB_P1C_WORKFLOW_ID", "343576501")),
        workflow_path=os.environ.get(
            "GITHUB_P1C_WORKFLOW_PATH", ".github/workflows/release-validation.yml"
        ),
    )
    service = GitHubP1CService(
        ledger=FirestoreGitHubActionLedger(project_id),
        workflow_ledger=workflow,
        gateway=RequestsGitHubGateway(token),
        recovery_publisher=PubSubRecoveryPublisher(
            project_id,
            os.environ.get("P1D_PUBSUB_TOPIC", "objective-recovery-p1d"),
        ),
    )
    return service, workflow, configuration


@lru_cache(maxsize=1)
def get_p1d_service() -> P1DService:
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
    token = os.environ.get("GITHUB_P1C_TOKEN")
    calendar_id = os.environ.get("GOOGLE_CALENDAR_ID")
    service_account_email = os.environ.get("OBJECTIVE_RECOVERY_SERVICE_ACCOUNT")
    if not project_id or not token or not calendar_id or not service_account_email:
        raise RuntimeError("P1D runtime configuration is incomplete")
    configuration = P1DConfiguration(
        repository=os.environ.get("GITHUB_P1C_REPOSITORY", "Rex123-hash/EXperiments"),
        workflow_id=int(os.environ.get("GITHUB_P1C_WORKFLOW_ID", "343576501")),
        workflow_path=os.environ.get(
            "GITHUB_P1C_WORKFLOW_PATH", ".github/workflows/release-validation.yml"
        ),
    )
    workflow = FirestoreWorkflowLedger(project_id)
    github_ledger = FirestoreGitHubActionLedger(project_id)
    gateway = RequestsGitHubGateway(token)
    return P1DService(
        store=FirestoreP1DStore(project_id),
        workflow=workflow,
        objective_store=FirestoreObjectiveStore(project_id),
        planner=AdkPlanningService(),
        github_validation=GitHubP1CService(
            ledger=github_ledger,
            workflow_ledger=workflow,
            gateway=gateway,
            required_success_step=REQUIRED_COMPATIBILITY_STEP,
            automatic_recovery_handoff=False,
        ),
        github_promotion=GitHubP1DPromotionService(
            ledger=github_ledger,
            gateway=gateway,
        ),
        github_ledger=github_ledger,
        calendar=CalendarExecutionService(
            calendar_id=calendar_id,
            ledger=FirestoreActionReceiptLedger(project_id),
            gateway=GoogleCalendarGateway(service_account_email=service_account_email),
        ),
        configuration=configuration,
    )


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


@app.post("/apps/objective_recovery_agent/trigger/p1c/pubsub")
async def receive_p1c_pubsub(envelope_data: dict[str, object]) -> Response:
    try:
        envelope = PubSubEnvelope.model_validate(envelope_data)
        decoded = base64.b64decode(envelope.message.data, validate=True)
        continuation = P1CContinuation.model_validate_json(decoded)
    except (ValidationError, ValueError, binascii.Error, json.JSONDecodeError) as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"invalid P1C continuation envelope: {type(error).__name__}",
        ) from error
    try:
        service, workflow, configuration = get_p1c_service()
        incident = workflow.load_incident(continuation.incident_id)
        intent = authorize_p1c_intent(incident, configuration)
        result = service.advance(intent)
    except Exception as error:
        retryable = bool(getattr(error, "retryable", False))
        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE if retryable else status.HTTP_409_CONFLICT
            ),
            detail=f"P1C continuation failed: {type(error).__name__}",
        ) from error
    if result.state in {P1CState.WAITING_FOR_RUN, P1CState.WAITING_FOR_COMPLETION}:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"P1C continuation pending: {result.state.value}",
        )
    return Response(
        content=json.dumps(
            {
                "incident_id": continuation.incident_id,
                "stage": result.state.value,
                "receipt_status": result.receipt_status.value,
                "run_id": result.run_id,
                "run_attempt": result.run_attempt,
                "handoff_id": result.handoff_id,
            }
        ),
        media_type="application/json",
        status_code=status.HTTP_200_OK,
    )


@app.post("/apps/objective_recovery_agent/trigger/p1d/pubsub")
async def receive_p1d_pubsub(envelope_data: dict[str, object]) -> Response:
    try:
        envelope = PubSubEnvelope.model_validate(envelope_data)
        decoded = base64.b64decode(envelope.message.data, validate=True)
        continuation = P1DContinuation.model_validate_json(decoded)
    except (ValidationError, ValueError, binascii.Error, json.JSONDecodeError) as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"invalid P1D continuation envelope: {type(error).__name__}",
        ) from error
    try:
        result = await get_p1d_service().advance(continuation)
    except Exception as error:
        retryable = bool(getattr(error, "retryable", True))
        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE if retryable else status.HTTP_409_CONFLICT
            ),
            detail=f"P1D continuation failed: {type(error).__name__}",
        ) from error
    if result.state is P1DState.PENDING:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="P1D continuation is waiting for authoritative external state",
        )
    return Response(
        content=json.dumps(
            {
                "incident_id": result.incident_id,
                "state": result.state.value,
                "stage": result.stage,
                "selected_plan_id": result.selected_plan_id,
                "release_id": result.release_id,
            }
        ),
        media_type="application/json",
        status_code=status.HTTP_200_OK,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
