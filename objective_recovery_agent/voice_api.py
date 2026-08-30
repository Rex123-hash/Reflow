"""Private voice-session route; Cloud Run IAM remains the service authentication boundary.

These endpoints mint one short-lived, model-locked Live credential. They hold no adapter,
touch no canonical state, and cannot execute anything. Operational authority stays entirely
inside the existing Operator route.
"""

from __future__ import annotations

import asyncio
import re
from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from objective_recovery_agent.demo_policy import (
    DEMO_OPERATOR_ROLE,
    is_canonical_demo_incident,
)
from objective_recovery_agent.voice_schemas import (
    LiveVoiceSession,
    VoiceCapability,
    VoiceFailureView,
    VoiceSessionRequest,
    VoiceTranscriptionSession,
)
from objective_recovery_agent.voice_sessions import (
    VoiceCredentialError,
    VoiceSessionIssuer,
    VoiceSettings,
    VoiceUnavailableError,
)

router = APIRouter()
_MAX_BODY = 1024
_NO_STORE = {"Cache-Control": "no-store"}


@lru_cache(maxsize=1)
def get_voice_issuer() -> VoiceSessionIssuer:
    return VoiceSessionIssuer(VoiceSettings.from_environment())


def _unavailable() -> HTTPException:
    return HTTPException(
        503,
        VoiceFailureView(
            code="VOICE_UNAVAILABLE",
            message="Voice is not configured in this deployment.",
        ).model_dump(),
        headers=_NO_STORE,
    )


def _credential_failed() -> HTTPException:
    return HTTPException(
        503,
        VoiceFailureView(
            code="SESSION_CREDENTIAL_FAILED",
            message="A voice session credential could not be issued. Retry shortly.",
        ).model_dump(),
        headers=_NO_STORE,
    )


def authenticated_context(request: Request) -> tuple[str, str, str]:
    subject = request.headers.get("X-Reflow-Operator-Subject", "")
    correlation = request.headers.get("X-Reflow-Request-Id", "")
    role = request.headers.get("X-Reflow-Operator-Role", "VIEWER")
    if not re.fullmatch(r"[a-f0-9]{64}", subject) or not re.fullmatch(
        r"[a-f0-9-]{36}", correlation
    ) or role not in {"VIEWER", "OPERATOR", DEMO_OPERATOR_ROLE}:
        raise HTTPException(403, "Authenticated voice context required.")
    return subject, correlation, role


def require_demo_scope(payload: VoiceSessionRequest, role: str) -> None:
    if role == DEMO_OPERATOR_ROLE and not is_canonical_demo_incident(payload.incident_id):
        raise HTTPException(404, "Demo incident context unavailable.")


async def bounded_session_request(
    request: Request, expected: VoiceCapability
) -> VoiceSessionRequest:
    if request.headers.get("content-type", "").split(";")[0] != "application/json":
        raise HTTPException(415, "JSON required.")
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > _MAX_BODY:
            raise HTTPException(413, "Voice session request too large.")
    try:
        payload = VoiceSessionRequest.model_validate_json(body)
    except ValidationError as error:
        raise HTTPException(400, "Invalid bounded voice session request.") from error
    if payload.capability != expected:
        raise HTTPException(400, "The requested capability does not match this endpoint.")
    return payload


def _issuer() -> VoiceSessionIssuer:
    try:
        return get_voice_issuer()
    except VoiceUnavailableError as error:
        raise _unavailable() from error


@router.post("/api/v1/voice/transcription/session", response_model=VoiceTranscriptionSession)
async def create_transcription_session(
    request: Request,
    context: Annotated[tuple[str, str, str], Depends(authenticated_context)],
) -> JSONResponse:
    payload = await bounded_session_request(request, "TRANSCRIPTION")
    issuer = _issuer()
    subject, correlation, role = context
    require_demo_scope(payload, role)
    try:
        session = await asyncio.wait_for(
            asyncio.to_thread(issuer.transcription_session, subject, correlation), timeout=15
        )
    except (VoiceCredentialError, TimeoutError, ValueError) as error:
        raise _credential_failed() from error
    return JSONResponse(session.model_dump(mode="json"), headers=_NO_STORE)


@router.post("/api/v1/voice/live/session", response_model=LiveVoiceSession)
async def create_live_session(
    request: Request,
    context: Annotated[tuple[str, str, str], Depends(authenticated_context)],
) -> JSONResponse:
    payload = await bounded_session_request(request, "LIVE_CALL")
    issuer = _issuer()
    subject, correlation, role = context
    require_demo_scope(payload, role)
    try:
        session = await asyncio.wait_for(
            asyncio.to_thread(issuer.live_session, payload.incident_id, subject, correlation),
            timeout=15,
        )
    except (VoiceCredentialError, TimeoutError, ValueError) as error:
        raise _credential_failed() from error
    return JSONResponse(session.model_dump(mode="json"), headers=_NO_STORE)
