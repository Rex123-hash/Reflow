"""Authenticated voice-session issuance and the one bounded Operator handoff.

The handoff does not open a second action path: it composes the same `OperatorQuery` a
typed request composes and sends it down the same single admitted Operator POST, then
translates the Operator's own result into what voice is permitted to say.
"""

import hashlib
import uuid
from collections.abc import Callable
from typing import Annotated, Protocol, cast

import requests
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from objective_recovery_agent.demo_policy import is_canonical_demo_incident
from objective_recovery_agent.operator_schemas import OperatorQuery, OperatorResponse
from objective_recovery_agent.voice_handoff import failed_handoff_result, handoff_result
from objective_recovery_agent.voice_schemas import (
    LiveVoiceSession,
    VoiceCapability,
    VoiceFailureView,
    VoiceOperatorHandoff,
    VoiceOperatorHandoffResult,
    VoiceSessionRequest,
    VoiceTranscriptionSession,
)
from pydantic import ValidationError

from objective_recovery.web_bff.auth import SessionPrincipal
from objective_recovery.web_bff.backend import BackendGateway, BackendResponse
from objective_recovery.web_bff.operator import (
    OperatorBackendGateway,
    backend_role,
)

_MAX_SESSION_BODY = 1024
_MAX_HANDOFF_BODY = 4096
_NO_STORE = {"Cache-Control": "no-store"}


class VoiceBackendGateway(OperatorBackendGateway, Protocol):
    def create_voice_session(
        self, capability: str, payload: bytes, subject: str, request_id: str, role: str
    ) -> BackendResponse: ...


async def _read(request: Request, limit: int) -> bytes:
    if request.headers.get("content-type", "").split(";")[0] != "application/json":
        raise HTTPException(415, "JSON required.")
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > limit:
            raise HTTPException(413, "Voice request too large.")
    return bytes(body)


def _headers(principal: SessionPrincipal) -> dict[str, str]:
    return {**_NO_STORE, "X-Reflow-Workspace": principal.mode}


def _unavailable(code: str, message: str, principal: SessionPrincipal) -> HTTPException:
    return HTTPException(
        503,
        VoiceFailureView.model_validate({"code": code, "message": message}).model_dump(),
        headers=_headers(principal),
    )


def register_voice_routes(
    app: FastAPI,
    session_backend: BackendGateway,
    operator_backend: BackendGateway,
    require_principal: Callable[..., SessionPrincipal],
    require_allowed_origin: Callable[..., None],
) -> None:
    async def _session(
        request: Request, principal: SessionPrincipal, capability: VoiceCapability
    ) -> Response:
        body = await _read(request, _MAX_SESSION_BODY)
        try:
            payload = VoiceSessionRequest.model_validate_json(body)
        except ValidationError as error:
            raise HTTPException(400, "Invalid bounded voice session request.") from error
        if payload.capability != capability:
            raise HTTPException(400, "The requested capability does not match this endpoint.")
        if principal.mode == "guest" and not is_canonical_demo_incident(payload.incident_id):
            raise HTTPException(404, "Demo incident context unavailable.")
        subject = hashlib.sha256(principal.uid.encode()).hexdigest()
        request_id = str(uuid.uuid4())
        try:
            result = cast(VoiceBackendGateway, session_backend).create_voice_session(
                capability,
                payload.model_dump_json().encode(),
                subject,
                request_id,
                backend_role(principal),
            )
        except (requests.RequestException, ValueError) as error:
            raise _unavailable(
                "SESSION_CREDENTIAL_FAILED",
                "A voice session credential could not be issued. Retry shortly.",
                principal,
            ) from error
        if result.status_code != 200:
            raise _unavailable(
                "VOICE_UNAVAILABLE" if result.status_code == 503 else "SESSION_CREDENTIAL_FAILED",
                "Voice is unavailable for this workspace right now.",
                principal,
            )
        schema = VoiceTranscriptionSession if capability == "TRANSCRIPTION" else LiveVoiceSession
        try:
            session = schema.model_validate_json(result.body)
        except ValidationError as error:
            raise _unavailable(
                "SESSION_CREDENTIAL_FAILED",
                "The voice session failed contract validation and was discarded.",
                principal,
            ) from error
        return Response(
            session.model_dump_json(),
            media_type="application/json",
            headers={**_headers(principal), "X-Reflow-Request-Id": request_id},
        )

    @app.post("/api/v1/voice/transcription/session")
    async def transcription_session(
        request: Request,
        principal: Annotated[SessionPrincipal, Depends(require_principal)],
        _: Annotated[None, Depends(require_allowed_origin)],
    ) -> Response:
        return await _session(request, principal, "TRANSCRIPTION")

    @app.post("/api/v1/voice/live/session")
    async def live_session(
        request: Request,
        principal: Annotated[SessionPrincipal, Depends(require_principal)],
        _: Annotated[None, Depends(require_allowed_origin)],
    ) -> Response:
        return await _session(request, principal, "LIVE_CALL")

    @app.post("/api/v1/voice/operator/handoff", response_model=VoiceOperatorHandoffResult)
    async def operator_handoff(
        request: Request,
        principal: Annotated[SessionPrincipal, Depends(require_principal)],
        _: Annotated[None, Depends(require_allowed_origin)],
    ) -> Response:
        body = await _read(request, _MAX_HANDOFF_BODY)
        try:
            handoff = VoiceOperatorHandoff.model_validate_json(body)
        except ValidationError as error:
            raise HTTPException(400, "Invalid bounded voice handoff request.") from error
        if principal.mode == "guest" and not is_canonical_demo_incident(handoff.incident_id):
            raise HTTPException(404, "Demo incident context unavailable.")
        subject = hashlib.sha256(principal.uid.encode()).hexdigest()
        request_id = str(uuid.uuid4())
        # The spoken utterance is the authoritative input, unedited and unsummarized.
        query = OperatorQuery(
            incident_id=handoff.incident_id,
            message=handoff.spoken_request,
            idempotency_key=handoff.idempotency_key,
            conversation_context=handoff.conversation_context,
        )
        headers = {**_headers(principal), "X-Reflow-Request-Id": request_id}

        def failed(detail: str) -> Response:
            result = failed_handoff_result(
                voice_session_id=handoff.voice_session_id,
                request_id=request_id,
                incident_id=handoff.incident_id,
                spoken_request=handoff.spoken_request,
                detail=detail,
            )
            return Response(
                result.model_dump_json(), media_type="application/json", headers=headers
            )

        try:
            upstream = cast(OperatorBackendGateway, operator_backend).query_operator(
                query.model_dump_json().encode(),
                subject,
                request_id,
                backend_role(principal),
            )
        except (requests.RequestException, ValueError):
            return failed("Reflow's Operator did not answer. Nothing was attempted.")
        if upstream.status_code != 200:
            return failed(
                "Reflow's Operator is busy or unavailable. Nothing was attempted."
                if upstream.status_code == 429
                else "Reflow's Operator returned no usable result. Nothing was attempted."
            )
        try:
            response = OperatorResponse.model_validate_json(upstream.body)
            if response.request_id != request_id or response.incident_id != handoff.incident_id:
                raise ValueError("Mismatched Operator response")
            result = handoff_result(
                response=response,
                voice_session_id=handoff.voice_session_id,
                spoken_request=handoff.spoken_request,
            )
        except ValueError:
            return failed("Reflow's Operator result failed validation and was discarded.")
        return Response(result.model_dump_json(), media_type="application/json", headers=headers)
