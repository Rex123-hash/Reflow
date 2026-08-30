"""Same-origin authenticated BFF boundary for one ephemeral image upload."""

from __future__ import annotations

import hashlib
import uuid
from collections.abc import Callable
from typing import Protocol, cast

import requests
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from objective_recovery_agent.image_schemas import (
    ImageErrorDetail,
    ImageErrorResponse,
    ImageUnderstandingResponse,
)
from objective_recovery_agent.image_validation import (
    ImageRequestError,
    parse_and_validate_image_request,
)
from starlette.concurrency import run_in_threadpool

from objective_recovery.web_bff.auth import SessionPrincipal
from objective_recovery.web_bff.backend import BackendGateway, BackendResponse
from objective_recovery.web_bff.operator import subject_role


class ImageBackendGateway(Protocol):
    def query_image(
        self,
        image: bytes,
        mime_type: str,
        incident_id: str,
        message: str | None,
        subject: str,
        request_id: str,
        role: str,
    ) -> BackendResponse: ...


def _error(error: ImageRequestError) -> Response:
    value = ImageErrorResponse(error=ImageErrorDetail(code=error.code, message=error.message))
    return Response(
        value.model_dump_json(),
        status_code=error.status_code,
        media_type="application/json",
        headers={"Cache-Control": "no-store"},
    )


def register_image_route(
    app: FastAPI,
    backend: BackendGateway,
    require_principal: Callable[..., SessionPrincipal],
    require_allowed_origin: Callable[..., None],
) -> None:
    principal_dependency = Depends(require_principal)
    origin_dependency = Depends(require_allowed_origin)

    @app.post(
        "/api/v1/operator/image",
        response_model=ImageUnderstandingResponse,
        responses={400: {"model": ImageErrorResponse}, 413: {"model": ImageErrorResponse}},
    )
    async def understand_image(
        request: Request,
        principal: SessionPrincipal = principal_dependency,
        _: None = origin_dependency,
    ) -> Response:
        if principal.mode != "live":
            return _error(
                ImageRequestError(
                    "authentication_required",
                    "Real image understanding requires Google sign-in.",
                    403,
                )
            )
        try:
            upload = await parse_and_validate_image_request(request)
        except ImageRequestError as error:
            return _error(error)
        subject = hashlib.sha256(principal.uid.encode()).hexdigest()
        request_id = str(uuid.uuid4())
        role = subject_role(principal)
        try:
            upstream = await run_in_threadpool(
                cast(ImageBackendGateway, backend).query_image,
                upload.content,
                upload.provenance.detected_mime_type,
                upload.metadata.incident_id,
                upload.metadata.message,
                subject,
                request_id,
                role,
            )
        except (requests.RequestException, ValueError) as error:
            raise HTTPException(
                503,
                detail=ImageErrorDetail(
                    code="upstream_unavailable",
                    message="Image understanding is temporarily unavailable.",
                ).model_dump(),
            ) from error
        headers = {
            "Cache-Control": "no-store",
            "X-Reflow-Workspace": "live",
            "X-Reflow-Request-Id": request_id,
        }
        if upstream.status_code != 200:
            status_code = (
                upstream.status_code if upstream.status_code in {400, 413, 415, 429, 503} else 502
            )
            return _error(
                ImageRequestError(
                    "upstream_unavailable",
                    "Image understanding is temporarily unavailable.",
                    status_code,
                )
            )
        try:
            response = ImageUnderstandingResponse.model_validate_json(upstream.body)
            if (
                response.request_id != request_id
                or response.incident_id != upload.metadata.incident_id
                or response.provenance != upload.provenance
            ):
                raise ValueError("Mismatched image response")
        except ValueError:
            return _error(
                ImageRequestError("response_invalid", "The image response failed validation.", 502)
            )
        return Response(response.model_dump_json(), media_type="application/json", headers=headers)


__all__ = ["register_image_route"]
