"""Private, authenticated image-understanding route."""

from __future__ import annotations

import asyncio
import re
from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from objective_recovery_agent.image_schemas import (
    ImageErrorDetail,
    ImageErrorResponse,
    ImageUnderstandingResponse,
)
from objective_recovery_agent.image_service import ImageUnderstandingService
from objective_recovery_agent.image_validation import (
    ImageRequestError,
    parse_and_validate_image_request,
)
from objective_recovery_agent.operator_agents import OperatorReasoningError
from objective_recovery_agent.operator_api import (
    authorized_role,
    get_operator_quota,
    get_operator_service,
)
from objective_recovery_agent.operator_quota import FirestoreOperatorQuota, OperatorRateLimited

router = APIRouter()
_slots = asyncio.Semaphore(1)


def _error(error: ImageRequestError) -> JSONResponse:
    value = ImageErrorResponse(
        error=ImageErrorDetail(code=error.code, message=error.message)
    )
    return JSONResponse(
        value.model_dump(mode="json"),
        status_code=error.status_code,
        headers={"Cache-Control": "no-store"},
    )


@lru_cache(maxsize=1)
def get_image_service() -> ImageUnderstandingService:
    return ImageUnderstandingService(get_operator_service())


@router.post(
    "/api/v1/operator/image",
    response_model=ImageUnderstandingResponse,
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "multipart/form-data": {
                    "schema": {
                        "type": "object",
                        "required": ["image", "incident_id"],
                        "properties": {
                            "image": {"type": "string", "format": "binary"},
                            "incident_id": {"type": "string"},
                            "message": {"type": "string", "minLength": 3, "maxLength": 1200},
                        },
                    }
                }
            },
        }
    },
    responses={
        400: {"model": ImageErrorResponse},
        403: {"model": ImageErrorResponse},
        413: {"model": ImageErrorResponse},
        415: {"model": ImageErrorResponse},
        429: {"model": ImageErrorResponse},
        503: {"model": ImageErrorResponse},
    },
)
async def understand_image(
    request: Request,
    service: Annotated[ImageUnderstandingService, Depends(get_image_service)],
    quota: Annotated[FirestoreOperatorQuota, Depends(get_operator_quota)],
) -> JSONResponse:
    subject = request.headers.get("X-Reflow-Operator-Subject", "")
    request_id = request.headers.get("X-Reflow-Request-Id", "")
    role = request.headers.get("X-Reflow-Operator-Role", "VIEWER")
    if (
        not re.fullmatch(r"[a-f0-9]{64}", subject)
        or not re.fullmatch(r"[a-f0-9-]{36}", request_id)
        or role not in {"VIEWER", "OPERATOR"}
    ):
        return _error(
            ImageRequestError(
                "authentication_required", "Authenticated Operator context required.", 403
            )
        )
    try:
        upload = await parse_and_validate_image_request(request)
    except ImageRequestError as error:
        return _error(error)
    try:
        await asyncio.wait_for(asyncio.to_thread(quota.consume, subject), timeout=8)
        if _slots.locked():
            raise OperatorRateLimited("Image understanding is busy")
        async with _slots:
            result = await service.understand(
                upload,
                request_id,
                subject,
                authorized_role(subject, role),
            )
        return JSONResponse(
            result.model_dump(mode="json"), headers={"Cache-Control": "no-store"}
        )
    except OperatorRateLimited:
        return _error(
            ImageRequestError(
                "upstream_unavailable", "Image understanding budget reached or busy.", 429
            )
        )
    except (OperatorReasoningError, TimeoutError, ValueError):
        return _error(
            ImageRequestError(
                "upstream_unavailable", "Image understanding is temporarily unavailable.", 503
            )
        )
    except Exception:
        return _error(
            ImageRequestError(
                "upstream_unavailable", "Image understanding is temporarily unavailable.", 503
            )
        )


__all__ = ["get_image_service", "router"]
