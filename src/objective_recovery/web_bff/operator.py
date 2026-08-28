"""Authenticated, origin-checked, bounded Operator POST; Guest never invokes Gemini."""

import hashlib
import os
import re
import uuid
from collections.abc import Callable
from typing import Annotated, Protocol, cast

import requests
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from objective_recovery_agent.operator_schemas import (
    OperatorActionView,
    OperatorQuery,
    OperatorResponse,
)
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool

from objective_recovery.web_bff.auth import SessionPrincipal
from objective_recovery.web_bff.backend import BackendGateway, BackendResponse


class OperatorBackendGateway(Protocol):
    def query_operator(
        self, payload: bytes, subject: str, request_id: str, role: str
    ) -> BackendResponse: ...

    def approve_operator(
        self, action_id: str, subject: str, request_id: str, role: str
    ) -> BackendResponse: ...


def _role(principal: SessionPrincipal) -> str:
    allowed = {
        item.strip().casefold()
        for item in os.environ.get("OPERATOR_ALLOWED_SUBJECT_HASHES", "").split(",")
        if item.strip()
    }
    return "OPERATOR" if hashlib.sha256(principal.uid.encode()).hexdigest() in allowed else "VIEWER"


def register_operator_route(
    app: FastAPI,
    backend: BackendGateway,
    require_principal: Callable[..., SessionPrincipal],
    require_allowed_origin: Callable[..., None],
) -> None:
    @app.post("/api/v1/operator/query")
    async def query(
        request: Request,
        principal: Annotated[SessionPrincipal, Depends(require_principal)],
        _: Annotated[None, Depends(require_allowed_origin)],
    ) -> Response:
        if principal.mode != "live":
            raise HTTPException(
                403, "Real Operator reasoning requires Google sign-in. Demo is read-only."
            )
        if request.headers.get("content-type", "").split(";")[0] != "application/json":
            raise HTTPException(415, "JSON required.")
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 8192:
                raise HTTPException(413, "Operator request too large.")
        try:
            payload = OperatorQuery.model_validate_json(body)
        except ValidationError as error:
            raise HTTPException(400, "Invalid bounded Operator request.") from error
        subject = hashlib.sha256(principal.uid.encode()).hexdigest()
        request_id = str(uuid.uuid4())
        role = _role(principal)
        try:
            result = await run_in_threadpool(
                cast(OperatorBackendGateway, backend).query_operator,
                payload.model_dump_json().encode(),
                subject,
                request_id,
                role,
            )
        except (requests.RequestException, ValueError) as error:
            raise HTTPException(
                503, "Result unavailable; retry the same request to retrieve its durable state."
            ) from error
        headers = {
            "Cache-Control": "no-store",
            "X-Reflow-Workspace": "live",
            "X-Reflow-Request-Id": request_id,
        }
        if result.status_code != 200:
            status_code = result.status_code if result.status_code in {400, 404, 429, 503} else 502
            raise HTTPException(
                status_code,
                "Result unavailable; retry the same request to retrieve its durable state.",
                headers={**headers, **({"Retry-After": "60"} if status_code == 429 else {})},
            )
        try:
            response = OperatorResponse.model_validate_json(result.body)
            if response.request_id != request_id or response.incident_id != payload.incident_id:
                raise ValueError("Mismatched Operator response")
        except ValueError as error:
            raise HTTPException(
                502, "Operator response failed validation.", headers=headers
            ) from error
        return Response(response.model_dump_json(), media_type="application/json", headers=headers)

    @app.post("/api/v1/operator/actions/{action_id}/approve")
    async def approve(
        action_id: str,
        request: Request,
        principal: Annotated[SessionPrincipal, Depends(require_principal)],
        _: Annotated[None, Depends(require_allowed_origin)],
    ) -> Response:
        if principal.mode != "live" or _role(principal) != "OPERATOR":
            raise HTTPException(403, "Operator approval permission required.")
        if not re.fullmatch(r"[a-f0-9]{64}", action_id):
            raise HTTPException(404, "Operator action unavailable.")
        if request.headers.get("content-type", "").split(";")[0] != "application/json":
            raise HTTPException(415, "JSON required.")
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 256:
                raise HTTPException(413, "Operator approval too large.")
        if bytes(body).strip() not in {b"", b"{}"}:
            raise HTTPException(400, "Approval body must be empty.")
        subject = hashlib.sha256(principal.uid.encode()).hexdigest()
        request_id = str(uuid.uuid4())
        try:
            result = await run_in_threadpool(
                cast(OperatorBackendGateway, backend).approve_operator,
                action_id,
                subject,
                request_id,
                "OPERATOR",
            )
        except (requests.RequestException, ValueError) as error:
            raise HTTPException(503, "Operator approval unavailable.") from error
        headers = {
            "Cache-Control": "no-store",
            "X-Reflow-Workspace": "live",
            "X-Reflow-Request-Id": request_id,
        }
        if result.status_code != 200:
            status_code = (
                result.status_code if result.status_code in {400, 403, 404, 429, 503} else 502
            )
            raise HTTPException(status_code, "Operator approval unavailable.", headers=headers)
        try:
            response = OperatorActionView.model_validate_json(result.body)
            if (
                response.operator_action_id != action_id
                or response.authenticated_subject_hash != subject
            ):
                raise ValueError("Mismatched Operator action response")
        except ValueError as error:
            raise HTTPException(
                502, "Operator approval response failed validation.", headers=headers
            ) from error
        return Response(response.model_dump_json(), media_type="application/json", headers=headers)
