from __future__ import annotations

import asyncio
import hashlib
from typing import Any

import pytest
import requests
from fastapi.testclient import TestClient
from objective_recovery_agent import operator_api
from objective_recovery_agent.fast_api_app import app
from objective_recovery_agent.operator_quota import OperatorRateLimited
from objective_recovery_agent.operator_schemas import OperatorActionView, RequestedOperation

from objective_recovery.web_bff.backend import BackendResponse, GoogleIdentityBackendGateway
from test_operator_runtime import INCIDENT, REQUEST, FakeAgents, intent, service
from test_p2d_web_bff import ORIGIN, make_client, sign_in


@pytest.fixture
def private_client() -> Any:
    class Quota:
        calls = 0
        fail = False

        def consume(self, subject: str) -> None:
            self.calls += 1
            if self.fail:
                raise OperatorRateLimited()

    quota = Quota()
    app.dependency_overrides[operator_api.get_operator_service] = lambda: service(
        FakeAgents(intent())
    )
    app.dependency_overrides[operator_api.get_operator_quota] = lambda: quota
    with TestClient(app) as client:
        yield client, quota
    app.dependency_overrides.clear()


def headers() -> dict[str, str]:
    return {"X-Reflow-Operator-Subject": "a" * 64, "X-Reflow-Request-Id": REQUEST}


def test_private_operator_contract_and_request_bounds(private_client: Any) -> None:
    client, quota = private_client
    path = "/api/v1/operator/query"
    body = {"incident_id": INCIDENT, "message": "Explain Recovery 1"}
    assert client.post(path, json=body).status_code == 403
    response = client.post(path, json=body, headers=headers())
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json()["intent"]["intent_type"] == "EXPLAIN"
    assert quota.calls == 1
    assert (
        client.post(path, json={**body, "message": "x" * 1201}, headers=headers()).status_code
        == 400
    )
    assert (
        client.post(
            path, content="x" * 9000, headers={**headers(), "Content-Type": "application/json"}
        ).status_code
        == 413
    )
    assert client.post(path, content="x", headers=headers()).status_code == 415
    quota.fail = True
    assert client.post(path, json=body, headers=headers()).status_code == 429


@pytest.mark.parametrize(
    "error,status",
    [
        (KeyError("secret incident"), 404),
        (ValueError("secret input"), 503),
        (TimeoutError(), 503),
        (RuntimeError("credentials"), 503),
    ],
)
def test_private_safe_failures(private_client: Any, error: Exception, status: int) -> None:
    client, _ = private_client

    class Failing:
        async def query(self, *args: Any, **kwargs: Any) -> Any:
            raise error

    app.dependency_overrides[operator_api.get_operator_service] = lambda: Failing()
    response = client.post(
        "/api/v1/operator/query",
        headers=headers(),
        json={"incident_id": INCIDENT, "message": "Explain recovery"},
    )
    assert response.status_code == status
    assert "secret" not in response.text and "credentials" not in response.text


def test_bff_requires_a_verified_session_and_allowed_origin_before_backend(
    monkeypatch: Any,
) -> None:
    client, _, backend = make_client()
    calls: list[Any] = []

    def post(*args: Any) -> Any:
        calls.append(args)
        raise AssertionError("Must not call backend")

    monkeypatch.setattr(backend, "query_operator", post, raising=False)
    body = {"incident_id": INCIDENT, "message": "Explain recovery"}
    path = "/api/v1/operator/query"
    assert client.post(path, json=body, headers={"Origin": ORIGIN}).status_code == 401
    sign_in(client, "google-id-token")
    assert client.post(path, json=body).status_code == 403
    assert client.post(path, json=body, headers={"Origin": "https://evil.test"}).status_code == 403
    assert (
        client.post(
            path, json={**body, "message": "x" * 1201}, headers={"Origin": ORIGIN}
        ).status_code
        == 400
    )
    assert (
        client.post(
            path, content="x" * 9000, headers={"Origin": ORIGIN, "Content-Type": "application/json"}
        ).status_code
        == 413
    )
    assert client.post(path, content="text", headers={"Origin": ORIGIN}).status_code == 415
    assert calls == []


@pytest.mark.parametrize(
    ("token", "uid", "expected_role", "workspace"),
    [
        ("google-id-token", b"google-user", "VIEWER", "live"),
        ("guest-id-token", b"guest-user", "DEMO", "guest"),
    ],
)
def test_bff_private_backend_chain_with_exact_response_and_correlation(
    monkeypatch: Any,
    private_client: Any,
    token: str,
    uid: bytes,
    expected_role: str,
    workspace: str,
) -> None:
    private, _ = private_client
    client, _, backend = make_client()
    captured: list[Any] = []

    def post(payload: bytes, subject: str, request_id: str, role: str) -> BackendResponse:
        captured.append((payload, subject, request_id, role))
        response = private.post(
            "/api/v1/operator/query",
            content=payload,
            headers={
                "Content-Type": "application/json",
                "X-Reflow-Operator-Subject": subject,
                "X-Reflow-Request-Id": request_id,
                "X-Reflow-Operator-Role": role,
            },
        )
        return BackendResponse(response.status_code, response.content, response.headers)

    monkeypatch.setattr(backend, "query_operator", post, raising=False)
    sign_in(client, token)
    result = client.post(
        "/api/v1/operator/query",
        headers={"Origin": ORIGIN, "X-Reflow-Operator-Subject": "forged"},
        json={"incident_id": INCIDENT, "message": "Explain Recovery 1"},
    )
    assert result.status_code == 200
    assert result.headers["cache-control"] == "no-store"
    assert captured[0][1] == hashlib.sha256(uid).hexdigest()
    assert captured[0][3] == expected_role
    assert result.headers["x-reflow-workspace"] == workspace
    assert result.json()["request_id"] == captured[0][2]
    assert "Authorization" not in result.text and "access_token" not in result.text


def test_guest_operator_cannot_select_an_arbitrary_incident(monkeypatch: Any) -> None:
    client, _, backend = make_client()
    calls: list[Any] = []
    monkeypatch.setattr(backend, "query_operator", lambda *args: calls.append(args), raising=False)
    sign_in(client, "guest-id-token")
    response = client.post(
        "/api/v1/operator/query",
        headers={"Origin": ORIGIN},
        json={"incident_id": "incident-private-arbitrary", "message": "Explain recovery"},
    )
    assert response.status_code == 404
    assert calls == []


def test_guest_direct_approval_is_denied_before_backend(monkeypatch: Any) -> None:
    client, _, backend = make_client()
    calls: list[Any] = []
    monkeypatch.setattr(
        backend, "approve_operator", lambda *args: calls.append(args), raising=False
    )
    sign_in(client, "guest-id-token")
    response = client.post(
        f"/api/v1/operator/actions/{'b' * 64}/approve",
        headers={"Origin": ORIGIN},
        json={},
    )
    assert response.status_code == 403
    assert calls == []


@pytest.mark.parametrize(
    "outcome,status",
    [
        (requests.Timeout(), 503),
        (ValueError("secret"), 503),
        (BackendResponse(429, b"secret", {}), 429),
        (BackendResponse(500, b"secret", {}), 502),
        (BackendResponse(200, b"not json", {}), 502),
        (BackendResponse(503, b"secret", {}), 503),
    ],
)
def test_bff_safe_upstream_failures(monkeypatch: Any, outcome: Any, status: int) -> None:
    client, _, backend = make_client()

    def post(*args: Any) -> Any:
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    monkeypatch.setattr(backend, "query_operator", post, raising=False)
    sign_in(client, "google-id-token")
    result = client.post(
        "/api/v1/operator/query",
        headers={"Origin": ORIGIN},
        json={"incident_id": INCIDENT, "message": "Explain recovery"},
    )
    assert result.status_code == status and "secret" not in result.text


def test_bff_rejects_mismatched_response(monkeypatch: Any) -> None:
    client, _, backend = make_client()
    value = asyncio.run(
        service(FakeAgents(intent())).query(
            __import__(
                "objective_recovery_agent.operator_schemas", fromlist=["OperatorQuery"]
            ).OperatorQuery(incident_id=INCIDENT, message="Explain recovery"),
            REQUEST,
        )
    )
    monkeypatch.setattr(
        backend,
        "query_operator",
        lambda *args: BackendResponse(200, value.model_dump_json().encode(), {}),
        raising=False,
    )
    sign_in(client, "google-id-token")
    assert (
        client.post(
            "/api/v1/operator/query",
            headers={"Origin": ORIGIN},
            json={"incident_id": INCIDENT, "message": "Explain recovery"},
        ).status_code
        == 502
    )


def test_fixed_post_gateway_mints_private_audience_identity(monkeypatch: Any) -> None:
    calls: list[Any] = []
    monkeypatch.setattr(
        "objective_recovery.web_bff.backend.id_token.fetch_id_token",
        lambda request, audience: "server-id-token",
    )

    class Http:
        def post(self, url: str, **kwargs: Any) -> Any:
            from types import SimpleNamespace

            calls.append((url, kwargs))
            return SimpleNamespace(status_code=200, content=b"{}", headers={})

    gateway = GoogleIdentityBackendGateway("https://private.test")
    monkeypatch.setattr(gateway, "_session", Http())
    gateway.query_operator(b"{}", "a" * 64, REQUEST)
    url, options = calls[0]
    assert url == "https://private.test/api/v1/operator/query"
    assert options["allow_redirects"] is False
    assert options["timeout"] == (3.05, 85)
    assert options["headers"]["Authorization"] == "Bearer server-id-token"
    assert options["headers"]["X-Reflow-Operator-Role"] == "VIEWER"


def action_view() -> OperatorActionView:
    return OperatorActionView(
        operator_action_id="b" * 64,
        request_id=REQUEST,
        authenticated_subject_hash="a" * 64,
        authority="JIRA",
        resource_type="ISSUE",
        resource_identifier="API-42",
        operations=(RequestedOperation(operation="JIRA_ASSIGN", value="Srishti"),),
        authorization_result="APPROVAL_REQUIRED",
        lifecycle="APPROVAL_REQUIRED",
        created_at="2026-08-28T12:00:00+00:00",
        updated_at="2026-08-28T12:00:00+00:00",
    )


def test_private_approval_requires_operator_role_and_bounded_body(
    private_client: Any, monkeypatch: Any
) -> None:
    monkeypatch.setenv("OPERATOR_ALLOWED_SUBJECT_HASHES", "a" * 64)
    client, _ = private_client

    class ApprovalService:
        async def approve_action(self, action_id: str, subject: str, role: str) -> Any:
            assert action_id == "b" * 64 and subject == "a" * 64 and role == "OPERATOR"
            return action_view().model_copy(
                update={
                    "lifecycle": "VERIFIED",
                    "verification_result": "PASSED",
                    "expected_state": {"assignee_account_id": "1"},
                    "observed_state": {"assignee_account_id": "1"},
                    "execution_acknowledgement": {"assignee": "accepted"},
                }
            )

    app.dependency_overrides[operator_api.get_operator_service] = lambda: ApprovalService()
    path = f"/api/v1/operator/actions/{'b' * 64}/approve"
    assert client.post(path, json={}, headers=headers()).status_code == 403
    operator_headers = {**headers(), "X-Reflow-Operator-Role": "OPERATOR"}
    assert client.post(path, content="text", headers=operator_headers).status_code == 415
    assert client.post(path, json={"unexpected": True}, headers=operator_headers).status_code == 400
    response = client.post(path, json={}, headers=operator_headers)
    assert response.status_code == 200 and response.json()["lifecycle"] == "VERIFIED"


def test_bff_operator_allowlist_and_approval_path_are_server_derived(
    monkeypatch: Any,
) -> None:
    monkeypatch.setenv(
        "OPERATOR_ALLOWED_SUBJECT_HASHES", hashlib.sha256(b"google-user").hexdigest()
    )
    client, _, backend = make_client()
    calls: list[Any] = []

    def approve(action_id: str, subject: str, request_id: str, role: str) -> BackendResponse:
        calls.append((action_id, subject, request_id, role))
        value = action_view().model_copy(
            update={
                "request_id": request_id,
                "authenticated_subject_hash": subject,
                "lifecycle": "VERIFIED",
                "verification_result": "PASSED",
                "expected_state": {"assignee_account_id": "1"},
                "observed_state": {"assignee_account_id": "1"},
                "execution_acknowledgement": {"assignee": "accepted"},
            }
        )
        return BackendResponse(200, value.model_dump_json().encode(), {})

    monkeypatch.setattr(backend, "approve_operator", approve, raising=False)
    sign_in(client, "google-id-token")
    path = f"/api/v1/operator/actions/{'b' * 64}/approve"
    response = client.post(path, json={}, headers={"Origin": ORIGIN})
    assert response.status_code == 200
    assert calls[0][0] == "b" * 64 and calls[0][3] == "OPERATOR"
    assert calls[0][1] == hashlib.sha256(b"google-user").hexdigest()
    assert client.post(path, json={}).status_code == 403


def test_backend_downgrades_forged_operator_header_without_allowlist(monkeypatch: Any) -> None:
    monkeypatch.delenv("OPERATOR_ALLOWED_SUBJECT_HASHES", raising=False)
    assert operator_api.authorized_role("a" * 64, "OPERATOR") == "VIEWER"
    monkeypatch.setenv("OPERATOR_ALLOWED_SUBJECT_HASHES", "b" * 64)
    assert operator_api.authorized_role("a" * 64, "OPERATOR") == "VIEWER"
    assert operator_api.authorized_role("b" * 64, "OPERATOR") == "OPERATOR"
    assert operator_api.authorized_role("b" * 64, "VIEWER") == "VIEWER"
