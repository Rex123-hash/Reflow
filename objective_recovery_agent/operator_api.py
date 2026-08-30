"""Private Operator route; Cloud Run IAM remains the service authentication boundary."""

from __future__ import annotations

import asyncio
import os
import re
from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from objective_recovery_agent.calendar_gateway import GoogleCalendarGateway
from objective_recovery_agent.calendar_operator_adapter import (
    CalendarOperatorAdapter,
    OperatorCalendarGateway,
)
from objective_recovery_agent.demo_policy import (
    DEMO_OPERATOR_ROLE,
    is_canonical_demo_incident,
)
from objective_recovery_agent.external_reality import ExternalRealityService
from objective_recovery_agent.jira_operator_adapter import JiraOperatorAdapter
from objective_recovery_agent.operator_actions import (
    CapabilityRegistry,
    FirestoreOperatorActionStore,
    OperatorActionAdapter,
    OperatorActionCoordinator,
    OperatorAdapterError,
)
from objective_recovery_agent.operator_agents import OperatorReasoningError
from objective_recovery_agent.operator_context import build_snapshot
from objective_recovery_agent.operator_quota import FirestoreOperatorQuota, OperatorRateLimited
from objective_recovery_agent.operator_schemas import (
    OperatorActionView,
    OperatorQuery,
    OperatorResponse,
    OperatorSnapshot,
)
from objective_recovery_agent.operator_service import OperatorService
from objective_recovery_agent.presentation import PresentationService
from objective_recovery_agent.slack_operator_adapter import SlackOperatorAdapter
from objective_recovery_agent.ui_store import FirestorePresentationStore

router = APIRouter()
_slots = asyncio.Semaphore(2)


def authorized_role(subject: str, requested_role: str) -> str:
    allowed = {
        value.strip()
        for value in os.environ.get("OPERATOR_ALLOWED_SUBJECT_HASHES", "").split(",")
        if value.strip()
    }
    return "OPERATOR" if requested_role == "OPERATOR" and subject in allowed else "VIEWER"


@lru_cache(maxsize=1)
def get_operator_service() -> OperatorService:
    project = os.environ["GOOGLE_CLOUD_PROJECT"]
    presentation = PresentationService(FirestorePresentationStore(project, transport="rest"))

    async def read_snapshot(incident_id: str) -> OperatorSnapshot:
        def read() -> OperatorSnapshot:
            return build_snapshot(
                incident_id,
                presentation.recovery_case(incident_id),
                presentation.events(incident_id, limit=100),
            )

        return await asyncio.wait_for(asyncio.to_thread(read), timeout=15)

    account = os.environ.get("OBJECTIVE_RECOVERY_SERVICE_ACCOUNT")
    calendar = ExternalRealityService(
        FirestorePresentationStore(project, transport="rest"),
        allowed_calendar_id=os.environ.get("GOOGLE_CALENDAR_ID"),
        reader_factory=(
            lambda: GoogleCalendarGateway(service_account_email=account, request_timeout=3)
        )
        if account
        else None,
    )
    adapters: list[OperatorActionAdapter] = []
    calendar_id = os.environ.get("GOOGLE_CALENDAR_ID", "").strip()
    demo_event_id = os.environ.get("OPERATOR_DEMO_CALENDAR_EVENT_ID", "").strip()
    if account and calendar_id:
        adapters.append(
            CalendarOperatorAdapter(
                calendar_id=calendar_id,
                demo_event_id=demo_event_id or None,
                gateway=OperatorCalendarGateway(service_account_email=account, request_timeout=15),
                timezone=os.environ.get("OPERATOR_CALENDAR_TIMEZONE", "Etc/UTC").strip()
                or "Etc/UTC",
            )
        )
    jira_base_url = os.environ.get("JIRA_BASE_URL", "").strip()
    jira_email = os.environ.get("JIRA_EMAIL", "").strip()
    jira_api_token = os.environ.get("JIRA_API_TOKEN", "").strip()
    jira_demo_issue_key = os.environ.get("JIRA_DEMO_ISSUE_KEY", "").strip()
    jira_values = (jira_base_url, jira_email, jira_api_token, jira_demo_issue_key)
    if all(jira_values):
        adapters.append(
            JiraOperatorAdapter(
                base_url=jira_base_url,
                email=jira_email,
                api_token=jira_api_token,
                demo_issue_key=jira_demo_issue_key,
                allowed_account_ids=frozenset(
                    item.strip()
                    for item in os.environ.get("JIRA_ALLOWED_ACCOUNT_IDS", "").split(",")
                    if item.strip()
                ),
            )
        )
    slack_values = tuple(
        os.environ.get(name, "").strip()
        for name in ("SLACK_BOT_TOKEN", "SLACK_DEMO_CHANNEL_ID", "SLACK_TEAM_ID")
    )
    if all(slack_values):
        adapters.append(
            SlackOperatorAdapter(
                bot_token=slack_values[0], demo_channel_id=slack_values[1], team_id=slack_values[2]
            )
        )
    registry = CapabilityRegistry(tuple(adapters))
    coordinator = OperatorActionCoordinator(registry, FirestoreOperatorActionStore(project))
    return OperatorService(read_snapshot, calendar.read, action_coordinator=coordinator)


@lru_cache(maxsize=1)
def get_operator_quota() -> FirestoreOperatorQuota:
    return FirestoreOperatorQuota(os.environ["GOOGLE_CLOUD_PROJECT"])


async def bounded_query(request: Request) -> OperatorQuery:
    if request.headers.get("content-type", "").split(";")[0] != "application/json":
        raise HTTPException(415, "JSON required.")
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > 8192:
            raise HTTPException(413, "Operator request too large.")
    try:
        return OperatorQuery.model_validate_json(body)
    except ValidationError as error:
        raise HTTPException(400, "Invalid bounded Operator request.") from error


@router.post(
    "/api/v1/operator/query",
    response_model=OperatorResponse,
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {"application/json": {"schema": OperatorQuery.model_json_schema()}},
        }
    },
)
async def operator_query(
    request: Request,
    service: Annotated[OperatorService, Depends(get_operator_service)],
    quota: Annotated[FirestoreOperatorQuota, Depends(get_operator_quota)],
) -> JSONResponse:
    subject = request.headers.get("X-Reflow-Operator-Subject", "")
    correlation = request.headers.get("X-Reflow-Request-Id", "")
    role = request.headers.get("X-Reflow-Operator-Role", "VIEWER")
    if not re.fullmatch(r"[a-f0-9]{64}", subject) or not re.fullmatch(
        r"[a-f0-9-]{36}", correlation
    ):
        raise HTTPException(403, "Authenticated Operator context required.")
    if role not in {"VIEWER", "OPERATOR", DEMO_OPERATOR_ROLE}:
        raise HTTPException(403, "Authenticated Operator role required.")
    payload = await bounded_query(request)
    demo_authority = role == DEMO_OPERATOR_ROLE
    if demo_authority and not is_canonical_demo_incident(payload.incident_id):
        raise HTTPException(404, "Demo incident context unavailable.")
    effective_role = "VIEWER" if demo_authority else authorized_role(subject, role)
    try:
        await asyncio.wait_for(asyncio.to_thread(quota.consume, subject), timeout=8)
        if _slots.locked():
            raise OperatorRateLimited("Operator is busy")
        async with _slots:
            result = await service.query(
                payload,
                correlation,
                subject,
                effective_role,
                authority="DEMO" if demo_authority else "LIVE",
            )
        return JSONResponse(result.model_dump(mode="json"), headers={"Cache-Control": "no-store"})
    except OperatorRateLimited as error:
        raise HTTPException(
            429,
            "Operator budget reached or busy. Try later.",
            headers={"Retry-After": "60", "Cache-Control": "no-store"},
        ) from error
    except KeyError as error:
        raise HTTPException(404, "Incident context unavailable.") from error
    except (OperatorReasoningError, TimeoutError, ValueError) as error:
        raise HTTPException(
            503,
            "Result unavailable. Retry with the same idempotency key; "
            "action outcome may be pending.",
        ) from error
    except Exception as error:
        raise HTTPException(
            503,
            "Result unavailable. Retry with the same idempotency key; "
            "action outcome may be pending.",
        ) from error


@router.post(
    "/api/v1/operator/actions/{action_id}/approve",
    response_model=OperatorActionView,
)
async def approve_operator_action(
    action_id: str,
    request: Request,
    service: Annotated[OperatorService, Depends(get_operator_service)],
    quota: Annotated[FirestoreOperatorQuota, Depends(get_operator_quota)],
) -> JSONResponse:
    subject = request.headers.get("X-Reflow-Operator-Subject", "")
    correlation = request.headers.get("X-Reflow-Request-Id", "")
    role = request.headers.get("X-Reflow-Operator-Role", "VIEWER")
    if (
        not re.fullmatch(r"[a-f0-9]{64}", subject)
        or not re.fullmatch(r"[a-f0-9-]{36}", correlation)
        or not re.fullmatch(r"[a-f0-9]{64}", action_id)
        or role not in {"VIEWER", "OPERATOR"}
    ):
        raise HTTPException(403, "Authenticated Operator approval context required.")
    if authorized_role(subject, role) != "OPERATOR":
        raise HTTPException(403, "Operator approval permission required.")
    if request.headers.get("content-type", "").split(";")[0] != "application/json":
        raise HTTPException(415, "JSON required.")
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > 256:
            raise HTTPException(413, "Operator approval too large.")
    if bytes(body).strip() not in {b"", b"{}"}:
        raise HTTPException(400, "Approval body must be empty.")
    try:
        await asyncio.wait_for(asyncio.to_thread(quota.consume, subject), timeout=8)
        if _slots.locked():
            raise OperatorRateLimited("Operator is busy")
        async with _slots:
            result = await asyncio.wait_for(
                service.approve_action(action_id, subject, role), timeout=70
            )
        action = OperatorActionView.model_validate(result)
        return JSONResponse(action.model_dump(mode="json"), headers={"Cache-Control": "no-store"})
    except OperatorRateLimited as error:
        raise HTTPException(
            429, "Operator budget reached or busy.", headers={"Retry-After": "60"}
        ) from error
    except OperatorAdapterError as error:
        status = 404 if error.category == "missing_action" else 403
        raise HTTPException(status, "Operator approval unavailable.") from error
    except Exception as error:
        raise HTTPException(
            503, "Approval result unavailable; retry this approval to retrieve its durable state."
        ) from error
