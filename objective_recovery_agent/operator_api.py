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
from objective_recovery_agent.external_reality import ExternalRealityService
from objective_recovery_agent.operator_agents import OperatorReasoningError
from objective_recovery_agent.operator_context import build_snapshot
from objective_recovery_agent.operator_quota import FirestoreOperatorQuota, OperatorRateLimited
from objective_recovery_agent.operator_schemas import (
    OperatorQuery,
    OperatorResponse,
    OperatorSnapshot,
)
from objective_recovery_agent.operator_service import OperatorService
from objective_recovery_agent.presentation import PresentationService
from objective_recovery_agent.ui_store import FirestorePresentationStore

router = APIRouter()
_slots = asyncio.Semaphore(2)


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
    return OperatorService(read_snapshot, calendar.read)


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
    if not re.fullmatch(r"[a-f0-9]{64}", subject) or not re.fullmatch(
        r"[a-f0-9-]{36}", correlation
    ):
        raise HTTPException(403, "Authenticated Operator context required.")
    payload = await bounded_query(request)
    try:
        await asyncio.wait_for(asyncio.to_thread(quota.consume, subject), timeout=8)
        if _slots.locked():
            raise OperatorRateLimited("Operator is busy")
        async with _slots:
            result = await service.query(payload, correlation)
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
        raise HTTPException(503, "Operator reasoning unavailable; no action occurred.") from error
    except Exception as error:
        raise HTTPException(503, "Operator temporarily unavailable; no action occurred.") from error
