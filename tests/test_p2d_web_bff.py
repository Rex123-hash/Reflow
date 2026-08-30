from __future__ import annotations

import importlib
import json
import shutil
from collections.abc import Mapping
from datetime import timedelta
from pathlib import Path
from typing import Any, cast

import pytest
import requests
from fastapi.testclient import TestClient
from objective_recovery_agent.ui_schemas import ObjectiveFilter

from objective_recovery.web_bff.app import create_app
from objective_recovery.web_bff.auth import (
    FirebaseSessionGateway,
    InvalidSessionError,
    principal_from_claims,
)
from objective_recovery.web_bff.backend import (
    BackendResponse,
    GoogleIdentityBackendGateway,
)
from objective_recovery.web_bff.config import BffSettings
from objective_recovery.web_bff.demo import CANONICAL_INCIDENT_ID, DemoStore

ORIGIN = "https://reflow.test"


class FakeSessions:
    def __init__(self) -> None:
        self.id_tokens: dict[str, Mapping[str, Any]] = {
            "google-id-token": {
                "uid": "google-user",
                "auth_time": 1_000,
                "email": "user@example.test",
                "name": "Reflow User",
                "firebase": {"sign_in_provider": "google.com"},
            },
            "guest-id-token": {
                "uid": "guest-user",
                "auth_time": 1_000,
                "firebase": {"sign_in_provider": "anonymous"},
            },
        }
        self.cookies: dict[str, Mapping[str, Any]] = {}
        self.created_with: list[tuple[str, timedelta]] = []

    def verify_id_token(self, token: str) -> Mapping[str, Any]:
        try:
            return self.id_tokens[token]
        except KeyError as error:
            raise InvalidSessionError("invalid") from error

    def create_session_cookie(self, token: str, expires_in: timedelta) -> str:
        cookie = f"session-for-{token}"
        self.cookies[cookie] = self.id_tokens[token]
        self.created_with.append((token, expires_in))
        return cookie

    def verify_session_cookie(self, cookie: str) -> Mapping[str, Any]:
        try:
            return self.cookies[cookie]
        except KeyError as error:
            raise InvalidSessionError("invalid") from error


class FakeBackend:
    def __init__(self, fixture_root: Path) -> None:
        self.calls: list[tuple[str, Mapping[str, str | int], str | None]] = []
        self.fixture_root = fixture_root
        self.override: BackendResponse | Exception | None = None

    def get(
        self,
        path: str,
        query: Mapping[str, str | int],
        if_none_match: str | None,
    ) -> BackendResponse:
        self.calls.append((path, query, if_none_match))
        if isinstance(self.override, Exception):
            raise self.override
        if self.override is not None:
            return self.override
        if if_none_match == 'W/"16"':
            return BackendResponse(304, b"", {"ETag": 'W/"16"'})
        if path == "/api/v1/ui/overview":
            fixture = "overview.json"
        elif path == "/api/v1/ui/objectives":
            fixture = "objectives.json"
        elif path.startswith("/api/v1/ui/evidence/"):
            fixture = "evidence.json"
        elif path.endswith("/events"):
            fixture = "events.json"
        elif path == "/api/v1/ui/operator/context":
            fixture = "operator-context.json"
        else:
            fixture = "recovery-restored.json"
        return BackendResponse(
            200,
            (self.fixture_root / fixture).read_bytes(),
            {"ETag": 'W/"16"', "Cache-Control": "private, no-cache"},
        )


def fixture_root() -> Path:
    return Path(__file__).parents[1] / "docs" / "ui-fixtures"


def make_client() -> tuple[TestClient, FakeSessions, FakeBackend]:
    root = fixture_root()
    sessions = FakeSessions()
    backend = FakeBackend(root)
    settings = BffSettings(
        project_id="test-project",
        backend_base_url="https://private-backend.test",
        allowed_origins=frozenset({ORIGIN}),
        demo_data_dir=root,
    )
    app = create_app(settings, sessions, backend, DemoStore(root), clock=lambda: 1_050)
    return TestClient(app, base_url=ORIGIN), sessions, backend


def sign_in(client: TestClient, token: str) -> dict[str, Any]:
    response = client.post(
        "/api/auth/session",
        headers={"Origin": ORIGIN},
        json={"id_token": token},
    )
    assert response.status_code == 200
    return cast(dict[str, Any], response.json())


def test_firebase_token_creates_secure_httponly_product_session() -> None:
    client, sessions, _ = make_client()
    body = sign_in(client, "google-id-token")
    assert body == {
        "mode": "live",
        "workspace_label": "Live workspace",
        "email": "user@example.test",
        "display_name": "Reflow User",
        "read_only": False,
    }
    cookie = client.cookies.get("__session")
    assert cookie == "session-for-google-id-token"
    set_cookie = client.post(
        "/api/auth/session",
        headers={"Origin": ORIGIN},
        json={"id_token": "google-id-token"},
    ).headers["set-cookie"]
    assert "HttpOnly" in set_cookie
    assert "Secure" in set_cookie
    assert "SameSite=lax" in set_cookie
    assert sessions.created_with[-1][1] == timedelta(minutes=55)


def test_cross_origin_invalid_expired_and_unsupported_auth_are_rejected() -> None:
    client, sessions, _ = make_client()
    assert client.post("/api/auth/session", json={"id_token": "google-id-token"}).status_code == 403
    assert (
        client.post(
            "/api/auth/session",
            headers={"Origin": ORIGIN},
            json={"id_token": "invalid"},
        ).status_code
        == 401
    )
    sessions.id_tokens["expired"] = {
        "uid": "expired",
        "auth_time": 1,
        "firebase": {"sign_in_provider": "google.com"},
    }
    sessions.id_tokens["password"] = {
        "uid": "password",
        "auth_time": 1_000,
        "firebase": {"sign_in_provider": "password"},
    }
    for token in ("expired", "password"):
        response = client.post(
            "/api/auth/session",
            headers={"Origin": ORIGIN},
            json={"id_token": token},
        )
        assert response.status_code == 401


def test_anonymous_request_without_session_is_rejected() -> None:
    client, _, _ = make_client()
    response = client.get("/api/v1/ui/overview")
    assert response.status_code == 401
    assert response.headers["x-frame-options"] == "DENY"


def test_health_and_invalid_session_cookie_behavior() -> None:
    client, _, _ = make_client()
    assert client.get("/healthz").json() == {
        "status": "ready",
        "boundary": "p2d-web-access",
    }
    client.cookies.set("__session", "expired")
    assert client.get("/api/auth/session").status_code == 401


def test_guest_gets_bounded_safe_demo_presentation_without_invoking_backend() -> None:
    client, _, backend = make_client()
    body = sign_in(client, "guest-id-token")
    assert body["workspace_label"] == "Demo workspace · Safe mode"
    overview = client.get("/api/v1/ui/overview")
    assert overview.status_code == 200
    assert overview.headers["x-reflow-workspace"] == "guest"
    assert overview.json()["current_priority"]["incident_id"] == CANONICAL_INCIDENT_ID
    assert backend.calls == []
    missing = client.get("/api/v1/ui/recoveries/incident-private-arbitrary")
    assert missing.status_code == 404
    assert backend.calls == []
    assert client.post("/api/v1/ui/overview").status_code == 405


def test_guest_etag_and_events_pagination_are_preserved() -> None:
    client, _, _ = make_client()
    sign_in(client, "guest-id-token")
    first = client.get(f"/api/v1/ui/recoveries/{CANONICAL_INCIDENT_ID}/events?after=0&limit=2")
    assert first.status_code == 200
    assert len(first.json()["events"]) == 2
    etag = first.headers["etag"]
    cached = client.get(
        f"/api/v1/ui/recoveries/{CANONICAL_INCIDENT_ID}/events?after=0&limit=2",
        headers={"If-None-Match": etag},
    )
    assert cached.status_code == 304
    assert cached.content == b""


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/ui/objectives?status=restored",
        f"/api/v1/ui/recoveries/{CANONICAL_INCIDENT_ID}",
        f"/api/v1/ui/evidence/{CANONICAL_INCIDENT_ID}",
        f"/api/v1/ui/recoveries/{CANONICAL_INCIDENT_ID}/events?after=0&limit=5",
        f"/api/v1/ui/operator/context?incident_id={CANONICAL_INCIDENT_ID}",
    ],
)
@pytest.mark.parametrize("token", ["guest-id-token", "google-id-token"])
def test_all_presentation_resources_validate_for_both_workspaces(path: str, token: str) -> None:
    client, _, _ = make_client()
    sign_in(client, token)
    response = client.get(path)
    assert response.status_code == 200
    assert response.headers["etag"].startswith('W/"')


def test_google_session_proxies_allowlisted_resource_without_browser_token() -> None:
    client, _, backend = make_client()
    sign_in(client, "google-id-token")
    response = client.get("/api/v1/ui/overview")
    assert response.status_code == 200
    assert response.headers["x-reflow-workspace"] == "live"
    assert response.headers["etag"] == 'W/"16"'
    assert backend.calls == [("/api/v1/ui/overview", {}, None)]
    serialized_call = json.dumps(backend.calls)
    assert "google-id-token" not in serialized_call
    assert "session-for-google-id-token" not in serialized_call


def test_live_etag_304_is_forwarded() -> None:
    client, _, backend = make_client()
    sign_in(client, "google-id-token")
    response = client.get(
        "/api/v1/ui/overview",
        headers={"If-None-Match": 'W/"16"'},
    )
    assert response.status_code == 304
    assert response.content == b""
    assert backend.calls[-1] == ("/api/v1/ui/overview", {}, 'W/"16"')


def test_live_transport_contract_and_upstream_errors_are_bounded() -> None:
    client, _, backend = make_client()
    sign_in(client, "google-id-token")
    backend.override = requests.ConnectionError("private details")
    response = client.get("/api/v1/ui/overview")
    assert response.status_code == 503
    assert "private details" not in response.text

    backend.override = BackendResponse(200, b'{"revision":16}', {})
    assert client.get("/api/v1/ui/overview").status_code == 502

    backend.override = BackendResponse(
        404,
        b'{"detail":{"code":"resource_not_found","message":"missing"}}',
        {},
    )
    assert client.get("/api/v1/ui/overview").json()["detail"]["code"] == "resource_not_found"

    backend.override = BackendResponse(503, b"not-json", {})
    response = client.get("/api/v1/ui/overview")
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "backend_infrastructure_unavailable"


def test_sign_out_clears_session_and_requires_same_origin() -> None:
    client, _, _ = make_client()
    sign_in(client, "google-id-token")
    assert client.delete("/api/auth/session").status_code == 403
    response = client.delete("/api/auth/session", headers={"Origin": ORIGIN})
    assert response.status_code == 204
    assert client.get("/api/auth/session").status_code == 401


def test_demo_contains_canonical_truth_without_unsupported_assignment_claim() -> None:
    demo = DemoStore(fixture_root())
    _, payload = demo.get("recovery", incident_id=CANONICAL_INCIDENT_ID)
    text = payload.decode("utf-8")
    assert "required_work_assigned" not in text
    recovery = json.loads(text)
    assert [attempt["status"] for attempt in recovery["attempts"]] == ["FAILED", "COMPLETED"]
    assert recovery["verifications"][0]["invariants"][0]["observed"] == "false"
    assert len(recovery["verifications"][1]["invariants"]) == 6
    assert {item["source_system"] for item in recovery["evidence"]} >= {
        "gmail",
        "google_calendar",
        "github_actions",
        "reflow_verifier",
    }


def test_demo_filters_objectives_rejects_bad_cursor_and_unknown_resource() -> None:
    demo = DemoStore(fixture_root())
    for selected_filter, expected in (
        (ObjectiveFilter.RESTORED, 1),
        (ObjectiveFilter.ACTIVE, 0),
    ):
        _, payload = demo.get(
            "objectives",
            selected_filter=selected_filter,
        )
        assert len(json.loads(payload)["items"]) == expected
    with pytest.raises(ValueError, match="Cursor"):
        demo.get("events", incident_id=CANONICAL_INCIDENT_ID, after=-1)
    with pytest.raises(KeyError):
        demo.get("unknown")


def test_demo_rejects_a_fixture_set_for_another_incident(tmp_path: Path) -> None:
    for source in fixture_root().glob("*.json"):
        shutil.copy2(source, tmp_path / source.name)
    events_path = tmp_path / "events.json"
    events = json.loads(events_path.read_text(encoding="utf-8"))
    events["incident_id"] = "incident-other"
    events_path.write_text(json.dumps(events), encoding="utf-8")
    with pytest.raises(RuntimeError, match="canonical incident"):
        DemoStore(tmp_path)


def test_settings_load_and_fail_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    from objective_recovery.web_bff.config import BffSettings

    for name in (
        "GOOGLE_CLOUD_PROJECT",
        "RECOVERY_BACKEND_URL",
        "ALLOWED_WEB_ORIGINS",
        "FIREBASE_WEB_API_KEY",
    ):
        monkeypatch.delenv(name, raising=False)
    with pytest.raises(RuntimeError, match="Missing BFF configuration"):
        BffSettings.from_environment()
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "project")
    monkeypatch.setenv("RECOVERY_BACKEND_URL", "https://backend.test/")
    monkeypatch.setenv("ALLOWED_WEB_ORIGINS", "https://one.test/, https://two.test")
    monkeypatch.setenv("FIREBASE_WEB_API_KEY", "public-web-key")
    monkeypatch.setenv("SECURE_SESSION_COOKIE", "false")
    settings = BffSettings.from_environment()
    assert settings.backend_base_url == "https://backend.test"
    assert settings.voice_backend_base_url == "https://backend.test"
    assert settings.voice_backend_audience == "https://backend.test"
    assert settings.allowed_origins == frozenset({"https://one.test", "https://two.test"})
    assert settings.secure_cookies is False


def test_voice_backend_settings_keep_a_tagged_candidate_on_the_service_audience(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "project")
    monkeypatch.setenv("RECOVERY_BACKEND_URL", "https://backend.test")
    monkeypatch.setenv("VOICE_RECOVERY_BACKEND_URL", "https://voice---backend.test/")
    monkeypatch.setenv("VOICE_RECOVERY_BACKEND_AUDIENCE", "https://backend.test/")
    monkeypatch.setenv("ALLOWED_WEB_ORIGINS", "https://one.test")
    monkeypatch.setenv("FIREBASE_WEB_API_KEY", "public-web-key")

    settings = BffSettings.from_environment()

    assert settings.voice_backend_base_url == "https://voice---backend.test"
    assert settings.voice_backend_audience == "https://backend.test"


def test_firebase_adapter_uses_token_bound_revocation_checks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    auth_module = importlib.import_module("objective_recovery.web_bff.auth")

    monkeypatch.setattr(auth_module.firebase_admin, "get_app", lambda: object())

    class FakeResponse:
        status_code = 200

        @staticmethod
        def json() -> dict[str, list[dict[str, str]]]:
            return {"users": [{"localId": "id"}]}

    class FakeHttp:
        def __init__(self) -> None:
            self.calls: list[tuple[str, dict[str, str], dict[str, str]]] = []

        def post(
            self,
            url: str,
            *,
            params: dict[str, str],
            json: dict[str, str],
            timeout: tuple[float, int],
        ) -> FakeResponse:
            del timeout
            self.calls.append((url, params, json))
            return FakeResponse()

    http = FakeHttp()
    gateway = FirebaseSessionGateway("public-web-key", cast(requests.Session, http))
    monkeypatch.setattr(
        auth_module.auth,
        "verify_id_token",
        lambda token, check_revoked: {"uid": token, "revoked": check_revoked},
    )
    assert gateway.verify_id_token("id") == {"uid": "id", "revoked": False}
    assert gateway.create_session_cookie("id", timedelta(minutes=55)) == "id"
    assert gateway.verify_session_cookie("id") == {"uid": "id", "revoked": False}
    assert http.calls[-1][1] == {"key": "public-web-key"}
    monkeypatch.setattr(
        auth_module.auth,
        "verify_id_token",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(ValueError("bad")),
    )
    with pytest.raises(InvalidSessionError):
        gateway.verify_id_token("bad")
    with pytest.raises(InvalidSessionError):
        gateway.create_session_cookie("bad", timedelta(hours=1))
    with pytest.raises(InvalidSessionError, match="no subject"):
        principal_from_claims({"firebase": {"sign_in_provider": "google.com"}})


def test_google_identity_backend_gateway_mints_server_token_only(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    backend_module = importlib.import_module("objective_recovery.web_bff.backend")

    class FakeResponse:
        def __init__(self) -> None:
            self.status_code = 200
            self.content = b"{}"
            self.headers = {"ETag": 'W/"1"'}

    class FakeRequestsSession:
        def __init__(self) -> None:
            self.call: tuple[str, Mapping[str, str | int], Mapping[str, str], Any] | None = None

        def get(
            self,
            url: str,
            *,
            params: Mapping[str, str | int],
            headers: Mapping[str, str],
            timeout: Any,
        ) -> FakeResponse:
            self.call = (url, params, headers, timeout)
            return FakeResponse()

    fake_session = FakeRequestsSession()
    monkeypatch.setattr(backend_module.requests, "Session", lambda: fake_session)
    monkeypatch.setattr(backend_module, "Request", lambda: object())
    monkeypatch.setattr(
        backend_module.id_token,
        "fetch_id_token",
        lambda request, audience: f"audience-token:{audience}",
    )
    gateway = GoogleIdentityBackendGateway(
        "https://voice-candidate---backend.test/", audience="https://backend.test/"
    )
    response = gateway.get("/api/v1/ui/overview", {}, 'W/"1"')
    assert response.status_code == 200
    assert fake_session.call is not None
    assert fake_session.call[0] == "https://voice-candidate---backend.test/api/v1/ui/overview"
    assert fake_session.call[2] == {
        "Authorization": "Bearer audience-token:https://backend.test",
        "If-None-Match": 'W/"1"',
    }
    with pytest.raises(ValueError, match="allowlisted"):
        gateway.get("https://attacker.test/api/v1/ui/overview", {}, None)
