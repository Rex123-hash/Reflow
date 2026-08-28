"""Authenticated, origin-checked, bounded Operator POST; Guest never invokes Gemini."""

import hashlib
import uuid
from collections.abc import Callable
from typing import Annotated, Protocol, cast

import requests
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from objective_recovery_agent.operator_schemas import OperatorQuery, OperatorResponse
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool

from objective_recovery.web_bff.auth import SessionPrincipal
from objective_recovery.web_bff.backend import BackendGateway, BackendResponse


class OperatorBackendGateway(Protocol):
    def query_operator(self, payload: bytes, subject: str, request_id: str) -> BackendResponse: ...


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
        try:
            result = await run_in_threadpool(
                cast(OperatorBackendGateway, backend).query_operator,
                payload.model_dump_json().encode(),
                subject,
                request_id,
            )
        except (requests.RequestException, ValueError) as error:
            raise HTTPException(503, "Operator unavailable; no action occurred.") from error
        headers = {
            "Cache-Control": "no-store",
            "X-Reflow-Workspace": "live",
            "X-Reflow-Request-Id": request_id,
        }
        if result.status_code != 200:
            status_code = result.status_code if result.status_code in {400, 404, 429, 503} else 502
            raise HTTPException(
                status_code,
                "Operator request unavailable; no action occurred.",
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
