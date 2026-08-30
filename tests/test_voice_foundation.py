"""Voice backend foundation: session issuance boundary and Operator handoff truth.

Voice must add zero action authority. These tests pin that the credential is short-lived
and model-locked, that a Live session carries exactly one handoff capability and no
business adapter, that the handoff enters the unchanged Operator pipeline carrying the
original utterance, and that no non-verified Operator result can be spoken as a success.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Callable, Mapping
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

import pytest
from fastapi.testclient import TestClient
from google.genai import types
from objective_recovery_agent.agent_runtime import AgentId
from objective_recovery_agent.operator_agents import OPERATOR_AGENT_NAMES
from objective_recovery_agent.operator_schemas import (
    ConversationContext,
    ConversationEnvelope,
    HumanResponse,
    OperatorActionView,
    OperatorQuery,
    OperatorResponse,
    RequestedOperation,
)
from objective_recovery_agent.voice_handoff import failed_handoff_result, handoff_result
from objective_recovery_agent.voice_schemas import (
    APPROVED_LIVE_MODELS,
    APPROVED_TRANSCRIPTION_MODELS,
    LIVE_CALL_MODEL,
    LIVE_SESSION_SECONDS,
    NEW_SESSION_SECONDS,
    OPERATOR_HANDOFF_TOOL,
    TRANSCRIPTION_MODEL,
    TRANSCRIPTION_SESSION_SECONDS,
    VOICE_RESULT_LEAD,
    VOICE_TRUTH_STATES,
    LiveVoiceSession,
    VoiceOperatorHandoff,
    VoiceOperatorHandoffResult,
    VoiceSessionRequest,
    VoiceTranscriptionSession,
    makes_completion_claim,
)
from objective_recovery_agent.voice_sessions import (
    DEFAULT_CUSTOM_VOCABULARY,
    LIVE_SYSTEM_INSTRUCTION,
    VoiceCredentialError,
    VoiceSessionIssuer,
    VoiceSettings,
    VoiceUnavailableError,
    declared_tool_behaviors,
    developer_api_client,
    live_call_constraints,
    live_configuration_names,
    operator_handoff_tool,
    transcription_constraints,
)
from pydantic import ValidationError

from objective_recovery.web_bff.app import create_app
from objective_recovery.web_bff.backend import BackendResponse, GoogleIdentityBackendGateway
from objective_recovery.web_bff.config import BffSettings
from objective_recovery.web_bff.demo import DemoStore
from test_p2d_web_bff import ORIGIN, FakeBackend, FakeSessions, fixture_root, sign_in

INCIDENT = "incident-0fc3af5b0bd1ad847aea"
API_KEY = "AIzaTESTKEYVALUEdoesnotleave000000000000"
SPOKEN = "Post the release status to the configured Slack channel."
GOOGLE_SUBJECT = hashlib.sha256(b"google-user").hexdigest()
SESSION_ID = "Ab3d_Ef5gH6ijK7lM8nO9pQr"
BUSINESS_SYSTEMS = ("slack", "jira", "calendar", "gmail", "github", "firestore", "pubsub")

# The canonical recovery fixture this milestone must leave untouched.
CANONICAL_RECOVERY_DIGEST = "6901d8f4495ae89d35a6c21b90d8793c7090556c4ac51073c6f8a554a5ff34cb"


def settings(**changes: Any) -> VoiceSettings:
    return VoiceSettings(api_key=API_KEY, **changes)


def fake_token(name: str = "auth_tokens/ephemeral-value") -> types.AuthToken:
    return types.AuthToken(name=name)


class RecordingFactory:
    """Stands in for the Gemini Developer API auth-token service."""

    def __init__(self, token: types.AuthToken | Exception | None = None) -> None:
        self.configs: list[types.CreateAuthTokenConfig] = []
        self.token = token if token is not None else fake_token()

    def __call__(self, config: types.CreateAuthTokenConfig) -> types.AuthToken:
        self.configs.append(config)
        if isinstance(self.token, Exception):
            raise self.token
        return self.token


def issuer(
    token: types.AuthToken | Exception | None = None,
) -> tuple[VoiceSessionIssuer, RecordingFactory]:
    factory = RecordingFactory(token)
    return VoiceSessionIssuer(settings(), factory), factory


# --------------------------------------------------------------------------------------
# Operator responses used to prove the handoff cannot upgrade a result.
# --------------------------------------------------------------------------------------


def envelope() -> ConversationEnvelope:
    return ConversationEnvelope(
        mode="TASK",
        user_goal="Post the release status",
        normalized_request=SPOKEN,
        requested_capability="SLACK_POST",
        requires_operator=True,
        tone="neutral",
        confidence="HIGH",
    )


def action(
    lifecycle: str,
    *,
    authorization: str = "AUTO_EXECUTABLE",
    verification: str = "NOT_RUN",
) -> OperatorActionView:
    verified = lifecycle == "VERIFIED"
    now = datetime.now(UTC).isoformat()
    return OperatorActionView.model_validate(
        {
            "operator_action_id": "a" * 64,
            "request_id": "12345678-1234-1234-1234-123456789abc",
            "authenticated_subject_hash": GOOGLE_SUBJECT,
            "authority": "SLACK",
            "resource_type": "CHANNEL",
            "resource_identifier": "configured-release-channel",
            "operations": (
                RequestedOperation(operation="SLACK_POST_MESSAGE", value="Release status."),
            ),
            "expected_state": {"text": "Release status."} if verified else {},
            "authorization_result": authorization,
            "lifecycle": lifecycle,
            "execution_acknowledgement": {"ts": "1"} if verified else {},
            "observed_state": {"text": "Release status."} if verified else {},
            "verification_result": verification,
            "created_at": now,
            "updated_at": now,
        }
    )


def verified_calendar_create_action(
    request_id: str = "12345678-1234-1234-1234-123456789abc",
) -> OperatorActionView:
    now = datetime.now(UTC).isoformat()
    event = {
        "summary": "Hackathon",
        "start": "2026-08-31T17:00:00+05:30",
        "end": "2026-08-31T18:00:00+05:30",
        "timezone": "Asia/Kolkata",
        "duration_minutes": 60,
        "time_basis": "ABSOLUTE",
        "reminders": {"use_default": True, "overrides": ()},
    }
    state = {
        "title": "Hackathon",
        "start": event["start"],
        "end": event["end"],
        "start_timezone": event["timezone"],
        "end_timezone": event["timezone"],
        "status": "confirmed",
        "event_id": "ref" + "a" * 61,
    }
    return OperatorActionView.model_validate(
        {
            "operator_action_id": "b" * 64,
            "request_id": request_id,
            "authenticated_subject_hash": GOOGLE_SUBJECT,
            "authority": "GOOGLE_CALENDAR",
            "resource_type": "EVENT",
            "resource_identifier": "configured-operator-calendar",
            "operations": ({"operation": "CREATE_CALENDAR_EVENT", "calendar_event": event},),
            "expected_state": state,
            "authorization_result": "AUTO_EXECUTABLE",
            "lifecycle": "VERIFIED",
            "execution_acknowledgement": {
                "operation": "created",
                "event_id": state["event_id"],
            },
            "observed_state": state,
            "verification_result": "PASSED",
            "created_at": now,
            "updated_at": now,
            "external_effects_possible": True,
        }
    )


def operator_response(
    *,
    disposition: str = "SUPPORTED",
    situation: str = "INSPECTION",
    action_view: OperatorActionView | None = None,
    external_effects: bool = False,
    request_id: str = "12345678-1234-1234-1234-123456789abc",
) -> OperatorResponse:
    return OperatorResponse.model_validate(
        {
            "request_id": request_id,
            "incident_id": INCIDENT,
            "revision": 16,
            "snapshot_fingerprint": "f" * 64,
            "generated_at": datetime.now(UTC).isoformat(),
            "disposition": disposition,
            "conversation": envelope(),
            "human_response": HumanResponse.model_validate(
                {
                    "human_summary": "Reflow reports the current state of that request.",
                    "situation_type": situation,
                    "current_state": "Recorded state read from the authoritative snapshot.",
                    "truth_boundary": "Only recorded state is asserted.",
                }
            ),
            "answer": "Reflow reports the current state of that request.",
            "facts": (),
            "evidence": (),
            "action": action_view,
            "provenance": "OPERATOR_ACTION" if action_view else "AUTHORITATIVE_SNAPSHOT",
            "external_effects_executed": external_effects,
            "agents": (),
        }
    )


def result_for(response: OperatorResponse) -> VoiceOperatorHandoffResult:
    return handoff_result(response=response, voice_session_id=SESSION_ID, spoken_request=SPOKEN)


# --------------------------------------------------------------------------------------
# 1. Unauthenticated session creation is denied.
# --------------------------------------------------------------------------------------


class VoiceBackend(FakeBackend):
    """The BFF's only two admitted POSTs, recorded exactly as the BFF issues them."""

    def __init__(self, root: Path) -> None:
        super().__init__(root)
        self.voice_calls: list[tuple[str, bytes, str, str]] = []
        self.operator_calls: list[tuple[bytes, str, str, str]] = []
        self.voice_response: BackendResponse | Exception | None = None
        self.operator_response: BackendResponse | Exception | None = None
        self.operator_response_factory: Callable[[str], OperatorResponse] | None = None

    def create_voice_session(
        self, capability: str, payload: bytes, subject: str, request_id: str
    ) -> BackendResponse:
        self.voice_calls.append((capability, payload, subject, request_id))
        if isinstance(self.voice_response, Exception):
            raise self.voice_response
        if self.voice_response is not None:
            return self.voice_response
        live, _ = issuer()
        session = (
            live.transcription_session(subject, request_id)
            if capability == "TRANSCRIPTION"
            else live.live_session(INCIDENT, subject, request_id)
        )
        return BackendResponse(200, session.model_dump_json().encode(), {})

    def query_operator(
        self, payload: bytes, subject: str, request_id: str, role: str = "VIEWER"
    ) -> BackendResponse:
        self.operator_calls.append((payload, subject, request_id, role))
        if isinstance(self.operator_response, Exception):
            raise self.operator_response
        if self.operator_response is not None:
            return self.operator_response
        response = (
            self.operator_response_factory(request_id)
            if self.operator_response_factory is not None
            else operator_response(request_id=request_id)
        )
        body = response.model_dump_json().encode()
        return BackendResponse(200, body, {})

    def __getattr__(self, name: str) -> Any:
        raise AssertionError(f"voice reached an unexpected backend capability: {name}")


def make_client() -> tuple[TestClient, VoiceBackend]:
    root = fixture_root()
    backend = VoiceBackend(root)
    bff = BffSettings(
        project_id="test-project",
        backend_base_url="https://private-backend.test",
        allowed_origins=frozenset({ORIGIN}),
        demo_data_dir=root,
    )
    app = create_app(bff, FakeSessions(), backend, DemoStore(root), clock=lambda: 1_050)
    return TestClient(app, base_url=ORIGIN), backend


def test_voice_session_candidate_is_isolated_from_the_operator_backend() -> None:
    root = fixture_root()
    production = VoiceBackend(root)
    candidate = VoiceBackend(root)
    settings = BffSettings(
        project_id="test-project",
        backend_base_url="https://private-backend.test",
        voice_backend_base_url="https://voice-candidate---private-backend.test",
        voice_backend_audience="https://private-backend.test",
        allowed_origins=frozenset({ORIGIN}),
        demo_data_dir=root,
    )
    app = create_app(
        settings,
        FakeSessions(),
        production,
        DemoStore(root),
        clock=lambda: 1_050,
        voice_backend=candidate,
    )
    client = TestClient(app, base_url=ORIGIN)
    sign_in(client, "google-id-token")

    minted = client.post(
        "/api/v1/voice/transcription/session",
        headers={"Origin": ORIGIN},
        json={"capability": "TRANSCRIPTION", "incident_id": INCIDENT},
    )
    handed_off = client.post(
        "/api/v1/voice/operator/handoff",
        headers={"Origin": ORIGIN},
        json={
            "voice_session_id": SESSION_ID,
            "incident_id": INCIDENT,
            "spoken_request": SPOKEN,
        },
    )

    assert minted.status_code == handed_off.status_code == 200
    assert len(candidate.voice_calls) == 1
    assert candidate.operator_calls == []
    assert production.voice_calls == []
    assert len(production.operator_calls) == 1


VOICE_SESSION_PATHS = (
    "/api/v1/voice/transcription/session",
    "/api/v1/voice/live/session",
)


@pytest.mark.parametrize("path", VOICE_SESSION_PATHS)
def test_voice_sessions_require_an_authenticated_google_session(path: str) -> None:
    client, backend = make_client()
    capability = "TRANSCRIPTION" if "transcription" in path else "LIVE_CALL"
    body = {"capability": capability, "incident_id": INCIDENT}

    anonymous = client.post(path, headers={"Origin": ORIGIN}, json=body)
    assert anonymous.status_code == 401

    sign_in(client, "guest-id-token")
    guest = client.post(path, headers={"Origin": ORIGIN}, json=body)
    assert guest.status_code == 403

    client.cookies.clear()
    sign_in(client, "google-id-token")
    assert client.post(path, json=body).status_code == 403  # Origin rejected.
    assert backend.voice_calls == []


def test_voice_handoff_requires_an_authenticated_google_session() -> None:
    client, backend = make_client()
    body = {
        "voice_session_id": SESSION_ID,
        "incident_id": INCIDENT,
        "spoken_request": SPOKEN,
    }
    assert client.post("/api/v1/voice/operator/handoff", json=body).status_code == 401
    sign_in(client, "guest-id-token")
    denied = client.post("/api/v1/voice/operator/handoff", headers={"Origin": ORIGIN}, json=body)
    assert denied.status_code == 403
    assert backend.operator_calls == []


def test_private_voice_route_requires_the_authenticated_operator_context() -> None:
    from objective_recovery_agent import voice_api

    client = TestClient(_private_app())
    body = {"capability": "TRANSCRIPTION", "incident_id": INCIDENT}
    assert client.post(VOICE_SESSION_PATHS[0], json=body).status_code == 403
    assert (
        client.post(
            VOICE_SESSION_PATHS[0],
            json=body,
            headers={
                "X-Reflow-Operator-Subject": "not-a-subject",
                "X-Reflow-Request-Id": "12345678-1234-1234-1234-123456789abc",
            },
        ).status_code
        == 403
    )
    assert voice_api.get_voice_issuer.cache_info().currsize == 0


PRIVATE_HEADERS = {
    "X-Reflow-Operator-Subject": GOOGLE_SUBJECT,
    "X-Reflow-Request-Id": "12345678-1234-1234-1234-123456789abc",
}


def test_an_unconfigured_deployment_reports_voice_unavailable(monkeypatch: Any) -> None:
    from objective_recovery_agent import voice_api

    monkeypatch.delenv("VOICE_GEMINI_API_KEY", raising=False)
    voice_api.get_voice_issuer.cache_clear()
    response = TestClient(_private_app()).post(
        VOICE_SESSION_PATHS[0],
        headers=PRIVATE_HEADERS,
        json={"capability": "TRANSCRIPTION", "incident_id": INCIDENT},
    )
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "VOICE_UNAVAILABLE"


@pytest.mark.parametrize(
    ("path", "capability"),
    [(VOICE_SESSION_PATHS[0], "TRANSCRIPTION"), (VOICE_SESSION_PATHS[1], "LIVE_CALL")],
)
def test_the_private_route_issues_a_locked_session_and_rejects_a_capability_mismatch(
    monkeypatch: Any, path: str, capability: str
) -> None:
    from objective_recovery_agent import voice_api

    voice, _ = issuer()
    monkeypatch.setattr(voice_api, "get_voice_issuer", lambda: voice)
    client = TestClient(_private_app())
    response = client.post(
        path, headers=PRIVATE_HEADERS, json={"capability": capability, "incident_id": INCIDENT}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["capability"] == capability
    assert body["configuration_locked"] is True
    assert body["model"] == (
        TRANSCRIPTION_MODEL if capability == "TRANSCRIPTION" else LIVE_CALL_MODEL
    )
    assert API_KEY not in response.text

    mismatched = client.post(
        path,
        headers=PRIVATE_HEADERS,
        json={
            "capability": "LIVE_CALL" if capability == "TRANSCRIPTION" else "TRANSCRIPTION",
            "incident_id": INCIDENT,
        },
    )
    assert mismatched.status_code == 400


def test_the_private_route_fails_closed_when_a_credential_cannot_be_minted(
    monkeypatch: Any,
) -> None:
    from objective_recovery_agent import voice_api

    voice, _ = issuer(RuntimeError("upstream rejected"))
    monkeypatch.setattr(voice_api, "get_voice_issuer", lambda: voice)
    response = TestClient(_private_app()).post(
        VOICE_SESSION_PATHS[1],
        headers=PRIVATE_HEADERS,
        json={"capability": "LIVE_CALL", "incident_id": INCIDENT},
    )
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "SESSION_CREDENTIAL_FAILED"


def test_the_private_route_bounds_its_request_body() -> None:
    client = TestClient(_private_app())
    oversized = client.post(
        VOICE_SESSION_PATHS[0],
        headers={**PRIVATE_HEADERS, "Content-Type": "application/json"},
        content=b"{" + b"a" * 2000 + b"}",
    )
    assert oversized.status_code == 413
    not_json = client.post(
        VOICE_SESSION_PATHS[0],
        headers={**PRIVATE_HEADERS, "Content-Type": "text/plain"},
        content=b"{}",
    )
    assert not_json.status_code == 415
    invalid = client.post(
        VOICE_SESSION_PATHS[0],
        headers=PRIVATE_HEADERS,
        json={"capability": "TRANSCRIPTION", "incident_id": "not-an-incident"},
    )
    assert invalid.status_code == 400


def _private_app() -> Any:
    from fastapi import FastAPI
    from objective_recovery_agent.voice_api import router

    app = FastAPI()
    app.include_router(router)
    return app


# --------------------------------------------------------------------------------------
# 2-3. Session credentials are locked to the approved model.
# --------------------------------------------------------------------------------------


def test_transcription_session_is_locked_to_the_approved_transcribe_model() -> None:
    voice, factory = issuer()
    session = voice.transcription_session(GOOGLE_SUBJECT, "req-1")
    constraints = factory.configs[0].live_connect_constraints
    assert constraints is not None
    assert constraints.model == TRANSCRIPTION_MODEL == "gemini-3.5-transcribe-live"
    assert session.model in APPROVED_TRANSCRIPTION_MODELS
    assert session.max_session_seconds == TRANSCRIPTION_SESSION_SECONDS == 600
    assert session.custom_vocabulary == DEFAULT_CUSTOM_VOCABULARY
    assert "Reflow" in session.custom_vocabulary and "REPLAN" in session.custom_vocabulary
    config = cast(Any, constraints.config)
    # Omitted language_codes is what selects automatic language identification.
    assert config.input_audio_transcription.language_codes is None
    assert session.automatic_language_detection is True


def test_live_session_is_locked_to_the_approved_live_model() -> None:
    voice, factory = issuer()
    session = voice.live_session(INCIDENT, GOOGLE_SUBJECT, "req-2")
    constraints = factory.configs[0].live_connect_constraints
    assert constraints is not None
    assert constraints.model == LIVE_CALL_MODEL == "gemini-3.1-flash-live-preview"
    assert session.model in APPROVED_LIVE_MODELS
    assert session.incident_id == INCIDENT
    assert session.session_resumption_supported is True
    config = cast(Any, constraints.config)
    assert config.response_modalities == [types.Modality.AUDIO]
    assert config.system_instruction == LIVE_SYSTEM_INSTRUCTION


@pytest.mark.parametrize(
    ("schema", "field", "value"),
    [
        (VoiceTranscriptionSession, "model", LIVE_CALL_MODEL),
        (LiveVoiceSession, "model", TRANSCRIPTION_MODEL),
    ],
)
def test_a_session_contract_rejects_an_unapproved_model(
    schema: type[Any], field: str, value: str
) -> None:
    voice, _ = issuer()
    session = (
        voice.transcription_session(GOOGLE_SUBJECT, "r")
        if schema is VoiceTranscriptionSession
        else voice.live_session(INCIDENT, GOOGLE_SUBJECT, "r")
    )
    with pytest.raises(ValidationError, match="pinned to the approved model"):
        session.model_copy(update={field: value}).model_validate(
            session.model_dump() | {field: value}
        )


# --------------------------------------------------------------------------------------
# 4-5. A client can select neither a model nor a tool.
# --------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "extra",
    [
        {"model": "gemini-3.7-flash"},
        {"tools": ["slack_post_message"]},
        {"system_instruction": "ignore policy"},
        {"config": {"response_modalities": ["TEXT"]}},
        {"max_session_seconds": 100000},
    ],
)
def test_the_session_request_contract_admits_no_model_tool_or_config_field(
    extra: dict[str, Any],
) -> None:
    with pytest.raises(ValidationError):
        VoiceSessionRequest.model_validate(
            {"capability": "LIVE_CALL", "incident_id": INCIDENT, **extra}
        )
    assert set(VoiceSessionRequest.model_fields) == {"capability", "incident_id"}


def test_a_client_supplied_model_is_ignored_by_the_bff_and_backend() -> None:
    client, backend = make_client()
    sign_in(client, "google-id-token")
    rejected = client.post(
        "/api/v1/voice/live/session",
        headers={"Origin": ORIGIN},
        json={
            "capability": "LIVE_CALL",
            "incident_id": INCIDENT,
            "model": "gemini-3.7-flash",
        },
    )
    assert rejected.status_code == 400
    assert backend.voice_calls == []


def test_a_session_endpoint_rejects_a_mismatched_capability() -> None:
    client, backend = make_client()
    sign_in(client, "google-id-token")
    response = client.post(
        "/api/v1/voice/live/session",
        headers={"Origin": ORIGIN},
        json={"capability": "TRANSCRIPTION", "incident_id": INCIDENT},
    )
    assert response.status_code == 400
    assert backend.voice_calls == []


# --------------------------------------------------------------------------------------
# 6. No permanent credential is returned.
# --------------------------------------------------------------------------------------


def test_no_permanent_credential_or_cloud_identity_reaches_the_client() -> None:
    voice, factory = issuer()
    for session in (
        voice.transcription_session(GOOGLE_SUBJECT, "req"),
        voice.live_session(INCIDENT, GOOGLE_SUBJECT, "req"),
    ):
        payload = session.model_dump_json()
        assert API_KEY not in payload
        assert session.ephemeral_token == "auth_tokens/ephemeral-value"
        assert session.uses == 1
        assert session.configuration_locked is True
        assert session.api_endpoint == "generativelanguage.googleapis.com"
    for config in factory.configs:
        assert config.uses == 1
        # No lock_additional_fields means the whole constrained config is locked.
        assert config.lock_additional_fields is None
        assert config.expire_time is not None and config.new_session_expire_time is not None
        window = (config.expire_time - datetime.now(UTC)).total_seconds()
        assert 0 < window <= LIVE_SESSION_SECONDS
        opening = (config.new_session_expire_time - datetime.now(UTC)).total_seconds()
        assert 0 < opening <= NEW_SESSION_SECONDS


def test_session_identifiers_are_opaque_and_never_repeat() -> None:
    voice, _ = issuer()
    ids = {voice.transcription_session(GOOGLE_SUBJECT, "r").session_id for _ in range(5)}
    assert len(ids) == 5
    assert all(INCIDENT not in value and GOOGLE_SUBJECT not in value for value in ids)


def test_issuance_logs_metadata_only_and_never_the_credential(
    capsys: pytest.CaptureFixture[str],
) -> None:
    voice, _ = issuer()
    session = voice.live_session(INCIDENT, GOOGLE_SUBJECT, "req-9")
    emitted = capsys.readouterr().out
    assert session.ephemeral_token not in emitted
    assert API_KEY not in emitted
    event = json.loads(emitted.strip().splitlines()[-1])
    assert event["operational_event"] == "VOICE_SESSION_ISSUED"
    assert event["model"] == LIVE_CALL_MODEL
    assert event["authenticated_subject_hash"] == GOOGLE_SUBJECT
    assert not ({"ephemeral_token", "api_key", "audio", "transcript"} & set(event))


def test_voice_is_unavailable_rather_than_partly_configured() -> None:
    with pytest.raises(VoiceUnavailableError):
        VoiceSettings(api_key="")
    with pytest.raises(VoiceUnavailableError, match="transcription model"):
        VoiceSettings(api_key=API_KEY, transcription_model="gemini-3.7-flash")
    with pytest.raises(VoiceUnavailableError, match="live-call model"):
        VoiceSettings(api_key=API_KEY, live_model="gemini-3.7-flash")
    with pytest.raises(VoiceUnavailableError, match="transcription session bound"):
        VoiceSettings(api_key=API_KEY, transcription_session_seconds=6000)
    with pytest.raises(VoiceUnavailableError, match="live session bound"):
        VoiceSettings(api_key=API_KEY, live_session_seconds=0)


def test_a_credential_failure_is_a_category_and_carries_no_cause_text() -> None:
    voice, _ = issuer(RuntimeError("api key AIzaSECRET rejected by upstream"))
    with pytest.raises(VoiceCredentialError) as raised:
        voice.transcription_session(GOOGLE_SUBJECT, "r")
    assert str(raised.value) == "RuntimeError"
    empty, _ = issuer(types.AuthToken())
    with pytest.raises(VoiceCredentialError, match="empty_token"):
        empty.live_session(INCIDENT, GOOGLE_SUBJECT, "r")


# --------------------------------------------------------------------------------------
# 7. The Live layer holds no direct business tool.
# --------------------------------------------------------------------------------------


def test_the_token_client_ignores_the_ambient_vertex_configuration(monkeypatch: Any) -> None:
    # The backend runs with GOOGLE_GENAI_USE_VERTEXAI=true for the eight reasoning agents.
    # The SDK reads that variable whenever vertexai is left unset, and a Vertex-mode client
    # refuses to mint an auth token, so voice must pin the Developer API explicitly.
    monkeypatch.setenv("GOOGLE_GENAI_USE_VERTEXAI", "true")
    assert developer_api_client(settings()).vertexai is False


def test_the_default_token_factory_keeps_one_live_client(monkeypatch: Any) -> None:
    # Constructing the client inline per call leaves it a temporary, and the SDK finalizer
    # closes its HTTP client mid-request. One client, held for the factory's lifetime.
    from objective_recovery_agent import voice_sessions

    built: list[object] = []

    class Client:
        def __init__(self) -> None:
            built.append(self)
            self.auth_tokens = self

        def create(self, *, config: Any) -> types.AuthToken:
            return fake_token()

    monkeypatch.setattr(voice_sessions, "developer_api_client", lambda _: Client())
    factory = voice_sessions._default_token_factory(settings())
    assert len(built) == 1
    for _ in range(3):
        assert factory(types.CreateAuthTokenConfig(uses=1)).name
    assert len(built) == 1


def test_the_live_session_holds_exactly_one_handoff_capability() -> None:
    voice, _ = issuer()
    session = voice.live_session(INCIDENT, GOOGLE_SUBJECT, "r")
    assert session.business_tools == ()
    assert session.operator_handoff_tool.name == OPERATOR_HANDOFF_TOOL
    assert [item.name for item in session.operator_handoff_tool.parameters] == ["spoken_request"]
    assert live_configuration_names(settings()) == (OPERATOR_HANDOFF_TOOL,)


def test_no_business_adapter_name_appears_anywhere_in_the_live_configuration() -> None:
    serialized = live_call_constraints(settings()).model_dump_json().casefold()
    for system in BUSINESS_SYSTEMS:
        assert f"{system}_" not in serialized
        assert f"_{system}" not in serialized
    for forbidden in ("post_message", "create_issue", "send_email", "insert_event", "execute"):
        assert forbidden not in serialized
    tools = json.dumps(
        json.loads(live_call_constraints(settings()).model_dump_json())["config"]["tools"]
    )
    # Exactly one declared capability, and every built-in Google tool left unset.
    assert tools.count(OPERATOR_HANDOFF_TOOL) == 1
    assert live_configuration_names(settings()) == (OPERATOR_HANDOFF_TOOL,)


def test_the_live_session_cannot_be_given_a_second_tool() -> None:
    voice, _ = issuer()
    session = voice.live_session(INCIDENT, GOOGLE_SUBJECT, "r")
    with pytest.raises(ValidationError):
        LiveVoiceSession.model_validate(
            session.model_dump() | {"business_tools": ["slack_post_message"]}
        )


def test_function_calling_is_declared_synchronous() -> None:
    # Gemini 3.1 Flash Live function calling is synchronous. Nothing may declare a
    # non-blocking behavior that would let the model answer before the Operator result.
    assert declared_tool_behaviors(settings()) == (None,)
    voice, _ = issuer()
    assert voice.live_session(INCIDENT, GOOGLE_SUBJECT, "r").operator_handoff_tool.synchronous


def test_the_live_instruction_forbids_a_completion_claim_before_the_result() -> None:
    lowered = " ".join(LIVE_SYSTEM_INSTRUCTION.casefold().split())
    assert "never say done, changed, verified, recovered, fixed" in lowered
    assert "synchronous" in lowered
    assert "a verified action is not the same as the objective being recovered" in lowered
    assert "hold no credential" in lowered
    for system in ("slack", "jira", "calendar", "gmail", "github"):
        # Named only as systems the voice layer explicitly cannot reach.
        assert system in lowered


def test_live_pre_tool_speech_cannot_echo_the_operational_request() -> None:
    lowered = " ".join(LIVE_SYSTEM_INSTRUCTION.casefold().split())
    assert 'either call silently or say exactly "i\'ll check that with reflow."' in lowered
    assert "do not repeat, quote, summarize, paraphrase" in lowered
    tool = operator_handoff_tool()
    assert "do not repeat, quote, summarize, or paraphrase" in tool.description.casefold()
    assert "do not speak this parameter value back" in tool.parameters[0].description.casefold()


def test_transcription_constraints_carry_no_tool_at_all() -> None:
    config = cast(Any, transcription_constraints(settings()).config)
    assert config.tools is None
    assert config.system_instruction is None


# --------------------------------------------------------------------------------------
# 8, 10, 13. The handoff enters the existing Operator pipeline unchanged.
# --------------------------------------------------------------------------------------


def handoff(client: TestClient, **changes: Any) -> Any:
    body: dict[str, Any] = {
        "voice_session_id": SESSION_ID,
        "incident_id": INCIDENT,
        "spoken_request": SPOKEN,
    }
    body.update(changes)
    return client.post("/api/v1/voice/operator/handoff", headers={"Origin": ORIGIN}, json=body)


def test_the_handoff_preserves_the_original_utterance_as_operator_input() -> None:
    client, backend = make_client()
    sign_in(client, "google-id-token")
    spoken = 'Tell the release channel "CI is red on candidate B" right now.'
    response = handoff(client, spoken_request=spoken)
    assert response.status_code == 200
    assert response.json()["original_request"] == spoken
    payload, subject, request_id, role = backend.operator_calls[0]
    query = OperatorQuery.model_validate_json(payload)
    assert query.message == spoken
    assert query.incident_id == INCIDENT
    assert subject == GOOGLE_SUBJECT
    assert role == "VIEWER"
    assert response.headers["X-Reflow-Request-Id"] == request_id


def test_the_handoff_uses_the_single_admitted_operator_post_and_nothing_else() -> None:
    client, backend = make_client()
    sign_in(client, "google-id-token")
    assert handoff(client).status_code == 200
    assert len(backend.operator_calls) == 1
    assert backend.voice_calls == []
    assert backend.calls == []  # No presentation read, no second path.


def test_the_handoff_preserves_existing_idempotency_semantics() -> None:
    client, backend = make_client()
    sign_in(client, "google-id-token")
    key = "voice-handoff-0001"
    assert handoff(client, idempotency_key=key).status_code == 200
    forwarded = OperatorQuery.model_validate_json(backend.operator_calls[0][0])
    assert forwarded.idempotency_key == key
    assert handoff(client, idempotency_key="short").status_code == 400
    assert len(backend.operator_calls) == 1


def test_the_handoff_forwards_one_bounded_clarification_context() -> None:
    client, backend = make_client()
    sign_in(client, "google-id-token")
    context = ConversationContext(
        mode="CLARIFY",
        user_goal="Create a hackathon Calendar event tomorrow at 5 PM",
        normalized_request=("Create a calendar event tomorrow at 5 PM for hackathon submission."),
        human_summary="Please specify the duration or end time.",
    )

    assert (
        handoff(
            client,
            spoken_request="Ends at 6 PM.",
            conversation_context=context.model_dump(mode="json"),
        ).status_code
        == 200
    )

    forwarded = OperatorQuery.model_validate_json(backend.operator_calls[0][0])
    assert forwarded.message == "Ends at 6 PM."
    assert forwarded.conversation_context == context


def test_the_handoff_rejects_a_request_outside_the_bounded_contract() -> None:
    client, backend = make_client()
    sign_in(client, "google-id-token")
    assert handoff(client, incident_id="../etc/passwd").status_code == 400
    assert handoff(client, spoken_request="a").status_code == 400
    assert handoff(client, voice_session_id="short").status_code == 400
    oversized = client.post(
        "/api/v1/voice/operator/handoff",
        headers={"Origin": ORIGIN, "Content-Type": "application/json"},
        content=b"{" + b"a" * 5000 + b"}",
    )
    assert oversized.status_code == 413
    not_json = client.post(
        "/api/v1/voice/operator/handoff",
        headers={"Origin": ORIGIN, "Content-Type": "text/plain"},
        content=b"hello",
    )
    assert not_json.status_code == 415
    assert backend.operator_calls == []


def test_voice_context_is_one_pending_clarification_and_bounded_in_size() -> None:
    base = {
        "voice_session_id": SESSION_ID,
        "incident_id": INCIDENT,
        "spoken_request": "Ends at 6 PM.",
    }
    with pytest.raises(ValidationError, match="pending clarification"):
        VoiceOperatorHandoff.model_validate(
            base
            | {
                "conversation_context": {
                    "mode": "TASK",
                    "user_goal": "Create an event",
                    "normalized_request": "Create an event tomorrow.",
                    "human_summary": "Pending.",
                }
            }
        )
    with pytest.raises(ValidationError, match="pending clarification"):
        VoiceOperatorHandoff.model_validate(
            base
            | {
                "conversation_context": {
                    "mode": "CLARIFY",
                    "user_goal": "g" * 700,
                    "normalized_request": "r" * 700,
                    "human_summary": "s" * 700,
                }
            }
        )


def test_a_mismatched_operator_response_never_becomes_a_voice_result() -> None:
    client, backend = make_client()
    sign_in(client, "google-id-token")
    body = operator_response(request_id="00000000-0000-0000-0000-000000000000")
    backend.operator_response = BackendResponse(200, body.model_dump_json().encode(), {})
    result = handoff(client).json()
    assert result["outcome"] == "HANDOFF_FAILED"
    assert result["failure"] == "OPERATOR_HANDOFF_FAILED"
    assert result["action_verified"] is False


def test_a_verified_calendar_creation_survives_the_bff_voice_contract() -> None:
    client, backend = make_client()
    sign_in(client, "google-id-token")
    backend.operator_response_factory = lambda request_id: operator_response(
        situation="SUCCESS",
        action_view=verified_calendar_create_action(request_id),
        external_effects=True,
        request_id=request_id,
    )

    result = handoff(client).json()

    assert result["outcome"] == "ACTION_VERIFIED"
    assert result["action_verified"] is True
    assert result["external_effects_executed"] is True
    assert result["operator_action_lifecycle"] == "VERIFIED"
    assert result["failure"] is None


# --------------------------------------------------------------------------------------
# 9. A conversational handoff mutates nothing.
# --------------------------------------------------------------------------------------


def test_a_conversational_result_reports_no_external_effect() -> None:
    result = result_for(operator_response())
    assert result.outcome == "CONVERSATIONAL"
    assert result.external_effects_executed is False
    assert result.action_verified is False
    assert result.objective_recovered is False
    assert result.operator_action_lifecycle is None
    assert result.spoken_result.startswith(VOICE_RESULT_LEAD["CONVERSATIONAL"])


def test_objective_recovery_is_only_the_operators_own_human_first_judgement() -> None:
    restored = result_for(operator_response(situation="OBJECTIVE_RESTORED"))
    assert restored.objective_recovered is True
    unrestored = result_for(operator_response(situation="SUCCESS"))
    assert unrestored.objective_recovered is False


# --------------------------------------------------------------------------------------
# 11-12. Denied, unsupported, and unverified results stay exactly that.
# --------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("response", "outcome", "failure"),
    [
        (
            operator_response(disposition="UNSUPPORTED", situation="UNSUPPORTED"),
            "UNSUPPORTED",
            "OPERATOR_HANDOFF_UNSUPPORTED",
        ),
        (
            operator_response(
                situation="DENIED",
                action_view=action("DENIED", authorization="DENIED"),
            ),
            "DENIED",
            "OPERATOR_HANDOFF_DENIED",
        ),
        (
            operator_response(
                disposition="CLARIFICATION_REQUIRED", situation="NEEDS_CLARIFICATION"
            ),
            "CLARIFICATION_REQUIRED",
            None,
        ),
    ],
)
def test_a_refused_operator_result_stays_refused_in_the_voice_contract(
    response: OperatorResponse, outcome: str, failure: str | None
) -> None:
    result = result_for(response)
    assert result.outcome == outcome
    assert result.failure == failure
    assert result.action_verified is False
    assert result.external_effects_executed is False
    assert result.objective_recovered is False
    assert result.spoken_result.startswith(VOICE_RESULT_LEAD[outcome])


def test_only_a_pending_clarification_returns_bounded_context() -> None:
    clarification = result_for(
        operator_response(
            disposition="CLARIFICATION_REQUIRED",
            situation="NEEDS_CLARIFICATION",
        )
    )
    assert clarification.conversation_context == ConversationContext(
        mode="CLARIFY",
        user_goal="Post the release status",
        normalized_request=SPOKEN,
        human_summary="Reflow reports the current state of that request.",
    )

    resolved = result_for(operator_response())
    assert resolved.conversation_context is None
    with pytest.raises(ValidationError, match="pending clarification"):
        VoiceOperatorHandoffResult.model_validate(
            resolved.model_dump() | {"conversation_context": clarification.conversation_context}
        )
    with pytest.raises(ValidationError, match="bounded pending clarification"):
        VoiceOperatorHandoffResult.model_validate(
            clarification.model_dump()
            | {
                "conversation_context": {
                    "mode": "TASK",
                    "user_goal": "Create an event",
                    "normalized_request": "Create an event tomorrow.",
                    "human_summary": "Pending.",
                }
            }
        )


@pytest.mark.parametrize(
    "lifecycle", ["EXECUTED", "READ_BACK", "VERIFICATION_FAILED", "FAILED", "EXECUTING"]
)
def test_an_acknowledged_but_unverified_action_cannot_become_a_success(lifecycle: str) -> None:
    response = operator_response(
        situation="UNCERTAIN",
        action_view=action(lifecycle),
        external_effects=True,
    )
    result = result_for(response)
    assert result.outcome == "ACTION_UNVERIFIED"
    assert result.action_verified is False
    assert result.external_effects_executed is True
    assert result.objective_recovered is False
    assert "not verified" in result.spoken_result
    with pytest.raises(ValidationError, match="verified Operator action"):
        VoiceOperatorHandoffResult.model_validate(result.model_dump() | {"action_verified": True})


def test_a_verified_action_is_still_not_the_objective_being_recovered() -> None:
    response = operator_response(
        situation="SUCCESS",
        action_view=action("VERIFIED", verification="PASSED"),
        external_effects=True,
    )
    result = result_for(response)
    assert result.outcome == "ACTION_VERIFIED"
    assert result.action_verified is True
    assert result.objective_recovered is False
    assert "not the same as the objective being recovered" in result.spoken_result


def test_an_approval_required_action_speaks_as_pending_and_carries_its_identifier() -> None:
    response = operator_response(
        situation="UNCERTAIN",
        action_view=action("APPROVAL_REQUIRED", authorization="APPROVAL_REQUIRED"),
    )
    result = result_for(response)
    assert result.outcome == "APPROVAL_REQUIRED"
    assert result.approval_required_action_id == "a" * 64
    assert result.external_effects_executed is False
    with pytest.raises(ValidationError, match="approval identifier"):
        VoiceOperatorHandoffResult.model_validate(
            result.model_dump() | {"approval_required_action_id": None}
        )


def test_only_the_verified_lead_sentence_makes_a_completion_claim() -> None:
    assert set(VOICE_RESULT_LEAD) <= VOICE_TRUTH_STATES
    for outcome, lead in VOICE_RESULT_LEAD.items():
        assert makes_completion_claim(lead) is False, outcome
    assert "verified it" in VOICE_RESULT_LEAD["ACTION_VERIFIED"]
    assert "not verified" in VOICE_RESULT_LEAD["ACTION_UNVERIFIED"]


def test_a_spoken_result_must_open_with_the_server_owned_state_sentence() -> None:
    result = result_for(operator_response())
    with pytest.raises(ValidationError, match="server-owned state sentence"):
        VoiceOperatorHandoffResult.model_validate(
            result.model_dump() | {"spoken_result": "Done, I changed it for you."}
        )


def test_every_required_backend_truth_state_exists() -> None:
    required = {
        "VOICE_UNAVAILABLE",
        "SESSION_CREDENTIAL_FAILED",
        "TRANSCRIPTION_SESSION_EXPIRED",
        "LIVE_SESSION_EXPIRED",
        "OPERATOR_HANDOFF_DENIED",
        "OPERATOR_HANDOFF_UNSUPPORTED",
        "OPERATOR_HANDOFF_FAILED",
        "ACTION_UNVERIFIED",
        "ACTION_VERIFIED",
        "OBJECTIVE_NOT_RECOVERED",
    }
    assert required <= VOICE_TRUTH_STATES


def test_a_failed_handoff_reports_no_attempt_rather_than_a_result() -> None:
    result = failed_handoff_result(
        voice_session_id=SESSION_ID,
        request_id="12345678-1234-1234-1234-123456789abc",
        incident_id=INCIDENT,
        spoken_request=SPOKEN,
        detail="Reflow's Operator did not answer. Nothing was attempted.",
    )
    assert result.outcome == "HANDOFF_FAILED"
    assert result.failure == "OPERATOR_HANDOFF_FAILED"
    assert makes_completion_claim(result.spoken_result) is False


@pytest.mark.parametrize(
    "failure", [BackendResponse(429, b"", {}), BackendResponse(503, b"", {}), None]
)
def test_an_operator_transport_failure_speaks_as_a_failed_handoff(
    failure: BackendResponse | None,
) -> None:
    import requests

    client, backend = make_client()
    sign_in(client, "google-id-token")
    backend.operator_response = failure or requests.ConnectionError("upstream")
    body = handoff(client).json()
    assert body["outcome"] == "HANDOFF_FAILED"
    assert body["action_verified"] is False
    assert body["external_effects_executed"] is False


# --------------------------------------------------------------------------------------
# BFF session issuance, availability, and contract validation.
# --------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("path", "capability"),
    [(VOICE_SESSION_PATHS[0], "TRANSCRIPTION"), (VOICE_SESSION_PATHS[1], "LIVE_CALL")],
)
def test_an_authenticated_session_is_issued_through_the_fixed_backend_path(
    path: str, capability: str
) -> None:
    client, backend = make_client()
    sign_in(client, "google-id-token")
    response = client.post(
        path,
        headers={"Origin": ORIGIN},
        json={"capability": capability, "incident_id": INCIDENT},
    )
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    body = response.json()
    assert body["capability"] == capability
    assert body["api_version"] == "v1alpha"
    assert API_KEY not in response.text
    recorded_capability, payload, subject, _ = backend.voice_calls[0]
    assert recorded_capability == capability
    assert subject == GOOGLE_SUBJECT
    assert VoiceSessionRequest.model_validate_json(payload).capability == capability


@pytest.mark.parametrize(
    ("upstream", "code"),
    [
        (BackendResponse(503, b"", {}), "VOICE_UNAVAILABLE"),
        (BackendResponse(500, b"", {}), "SESSION_CREDENTIAL_FAILED"),
        (BackendResponse(200, b"{}", {}), "SESSION_CREDENTIAL_FAILED"),
    ],
)
def test_an_unavailable_voice_backend_returns_a_named_failure(
    upstream: BackendResponse, code: str
) -> None:
    client, backend = make_client()
    sign_in(client, "google-id-token")
    backend.voice_response = upstream
    response = client.post(
        VOICE_SESSION_PATHS[0],
        headers={"Origin": ORIGIN},
        json={"capability": "TRANSCRIPTION", "incident_id": INCIDENT},
    )
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == code


def test_a_transport_failure_during_issuance_is_a_credential_failure() -> None:
    import requests

    client, backend = make_client()
    sign_in(client, "google-id-token")
    backend.voice_response = requests.ConnectionError("upstream")
    response = client.post(
        VOICE_SESSION_PATHS[1],
        headers={"Origin": ORIGIN},
        json={"capability": "LIVE_CALL", "incident_id": INCIDENT},
    )
    assert response.json()["detail"]["code"] == "SESSION_CREDENTIAL_FAILED"


def test_a_session_request_body_is_bounded() -> None:
    client, backend = make_client()
    sign_in(client, "google-id-token")
    oversized = client.post(
        VOICE_SESSION_PATHS[0],
        headers={"Origin": ORIGIN, "Content-Type": "application/json"},
        content=b"{" + b"a" * 2000 + b"}",
    )
    assert oversized.status_code == 413
    not_json = client.post(
        VOICE_SESSION_PATHS[0],
        headers={"Origin": ORIGIN, "Content-Type": "text/plain"},
        content=b"{}",
    )
    assert not_json.status_code == 415
    assert backend.voice_calls == []


def test_the_backend_gateway_admits_only_the_two_fixed_voice_paths() -> None:
    gateway = GoogleIdentityBackendGateway("https://private-backend.test")
    with pytest.raises(ValueError, match="Unknown voice capability"):
        gateway.create_voice_session("ARBITRARY", b"{}", GOOGLE_SUBJECT, "r")


# --------------------------------------------------------------------------------------
# 14-15. The agent roster and the canonical fixture are untouched.
# --------------------------------------------------------------------------------------


def test_exactly_eight_reflow_reasoning_agents_remain() -> None:
    agents = tuple(item.value for item in AgentId) + OPERATOR_AGENT_NAMES
    assert agents == (
        "disruption_interpreter",
        "impact_analyst",
        "recovery_planner",
        "risk_critic",
        "recovery_analyst",
        "conversation_understanding_agent",
        "operator_intent_interpreter",
        "simulation_agent",
    )
    assert len(agents) == len(set(agents)) == 8


def test_the_voice_layer_declares_no_reflow_reasoning_agent() -> None:
    root = Path(__file__).parents[1] / "objective_recovery_agent"
    for name in ("voice_api", "voice_handoff", "voice_schemas", "voice_sessions"):
        source = (root / f"{name}.py").read_text(encoding="utf-8")
        assert "google.adk" not in source
        assert "Workflow(" not in source
        assert "Agent(" not in source


def test_the_canonical_recovery_fixture_is_unchanged() -> None:
    fixture = Path(__file__).parents[1] / "docs/ui-fixtures/recovery-restored.json"
    digest = hashlib.sha256(fixture.read_bytes()).hexdigest()
    assert digest == CANONICAL_RECOVERY_DIGEST


def test_no_voice_module_persists_audio_or_a_transcript_before_submission() -> None:
    """Pre-submission only. Submitted text is governed by the Operator rules."""
    root = Path(__file__).parents[1]
    sources: list[str] = [
        (root / "objective_recovery_agent" / f"{name}.py").read_text(encoding="utf-8")
        for name in ("voice_api", "voice_handoff", "voice_schemas", "voice_sessions")
    ]
    sources.append((root / "src/objective_recovery/web_bff/voice.py").read_text(encoding="utf-8"))
    for source in sources:
        for persistence in ("firestore", "Firestore", "bucket", "storage", "open("):
            assert persistence not in source


def test_the_handoff_result_is_a_value_contract_with_no_adapter_surface() -> None:
    fields: Mapping[str, Any] = VoiceOperatorHandoffResult.model_fields
    assert not ({"adapter", "gateway", "token", "credential"} & set(fields))
