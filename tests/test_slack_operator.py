from __future__ import annotations

import asyncio
import hashlib
import json
from copy import deepcopy
from typing import Any

import pytest
import requests
from objective_recovery_agent.operator_actions import (
    ActionAuthorizationPolicy,
    CapabilityRegistry,
    InMemoryOperatorActionStore,
    OperatorActionCoordinator,
    OperatorAdapterError,
)
from objective_recovery_agent.operator_context import safe_text
from objective_recovery_agent.operator_schemas import (
    OperatorIntent,
    OperatorQuery,
    OperatorTarget,
    RequestedOperation,
)
from objective_recovery_agent.operator_service import OperatorService, validate_intent
from objective_recovery_agent.slack_operator_adapter import SlackOperatorAdapter
from objective_recovery_agent.slack_operator_policy import (
    SLACK_DEMO_RESOURCE,
    SLACK_MESSAGE_LIMIT,
    SLACK_REQUIRED_SCOPES,
    decode_slack_text,
    encode_slack_text,
    slack_message_denial,
)
from pydantic import ValidationError

from test_operator_runtime import INCIDENT, REQUEST, FakeAgents, snapshot

CHANNEL = "C123ABC456"
TEAM = "T123ABC456"
USER = "U123ABC456"
BOT = "B123ABC456"
TS = "1788000000.000123"
TEXT = "Backend engineer unavailable. SCRUM-6 is blocked."
TOKEN = "xoxb-" + "fake-test-only-not-a-credential"


class Response:
    def __init__(self, payload: Any, status: int = 200, /, **headers: str) -> None:
        self.payload = payload
        self.status_code = status
        self.headers = {"x-oauth-scopes": ",".join(sorted(SLACK_REQUIRED_SCOPES)), **headers}

    def json(self) -> Any:
        if isinstance(self.payload, Exception):
            raise self.payload
        return deepcopy(self.payload)


class SlackSession:
    def __init__(self) -> None:
        self.headers: dict[str, str] = {}
        self.calls: list[tuple[str, dict[str, Any]]] = []
        self.messages: list[dict[str, Any]] = []
        self.errors: dict[str, Any] = {}
        self.lost_ack = False
        self.read_mismatch = False
        self.channel: dict[str, Any] = {
            "id": CHANNEL,
            "name": "reflow-release-demo",
            "is_channel": True,
            "is_private": False,
            "is_member": True,
            "is_archived": False,
            "is_shared": False,
        }

    def request(self, verb: str, url: str, **kwargs: Any) -> Response:
        method = url.removeprefix("https://slack.com/api/")
        assert url == f"https://slack.com/api/{method}"
        assert kwargs["allow_redirects"] is False and kwargs["timeout"] == 4
        assert verb == ("POST" if method in {"auth.test", "chat.postMessage"} else "GET")
        parameters = kwargs.get("json") or kwargs.get("params") or {}
        self.calls.append((method, deepcopy(parameters)))
        failure = self.errors.get(method)
        if isinstance(failure, Exception):
            raise failure
        if isinstance(failure, Response):
            return failure
        if method == "auth.test":
            return Response({"ok": True, "team_id": TEAM, "user_id": USER, "bot_id": BOT})
        if method == "conversations.info":
            return Response({"ok": True, "channel": self.channel})
        if method == "chat.postMessage":
            self.messages.insert(
                0,
                {
                    "type": "message",
                    "ts": TS,
                    "text": parameters["text"],
                    "user": USER,
                    "bot_id": BOT,
                },
            )
            if self.lost_ack:
                raise requests.Timeout(f"Authorization: Bearer {TOKEN}")
            return Response(
                {
                    "ok": True,
                    "channel": CHANNEL,
                    "ts": TS,
                    "message": {"text": "ACK text is NOT verification evidence"},
                }
            )
        assert method == "conversations.history"
        messages = deepcopy(self.messages[: parameters["limit"]])
        if self.read_mismatch and parameters["limit"] == 1 and messages:
            messages[0]["text"] = "mismatched independent state"
        return Response({"ok": True, "messages": messages, "has_more": False})


def target(identifier: str = SLACK_DEMO_RESOURCE) -> OperatorTarget:
    return OperatorTarget(
        authority="SLACK", resource_type="CHANNEL", resource_identifier=identifier
    )


def operation(text: str = TEXT) -> RequestedOperation:
    return RequestedOperation(operation="SLACK_POST_MESSAGE", value=text)


def adapter(session: SlackSession | None = None, /, **changes: Any) -> SlackOperatorAdapter:
    return SlackOperatorAdapter(
        **{
            "bot_token": TOKEN,
            "demo_channel_id": CHANNEL,
            "team_id": TEAM,
            "session": session or SlackSession(),
            **changes,
        }
    )


def intent(kind: str = "ACT", **changes: Any) -> OperatorIntent:
    return OperatorIntent.model_validate(
        {
            "disposition": "SUPPORTED",
            "intent_type": kind,
            "subject": "SLACK",
            "incident_id": INCIDENT,
            "question": "Slack request",
            "hypothetical_changes": [],
            "constraints": [],
            "fact_ids": [],
            "target": target().model_dump(),
            "requested_operations": [operation().model_dump()] if kind == "ACT" else [],
            **changes,
        }
    )


def coordinator(session: SlackSession) -> OperatorActionCoordinator:
    return OperatorActionCoordinator(
        CapabilityRegistry((adapter(session),)), InMemoryOperatorActionStore()
    )


def request(control: OperatorActionCoordinator, **changes: Any) -> Any:
    return control.request(
        **{
            "request_id": REQUEST,
            "idempotency_key": "slack-test-same-key",
            "subject_hash": "a" * 64,
            "role": "OPERATOR",
            "target": target(),
            "operations": (operation(),),
            **changes,
        }
    )


@pytest.mark.parametrize("kind", ["INSPECT", "ACT"])
def test_typed_slack_intent_and_server_owned_semantic_target(kind: str) -> None:
    selected = intent(kind)
    registry = CapabilityRegistry((adapter(),))
    validate_intent(selected, snapshot(), registry)
    capability = next(c for c in registry.capabilities() if c.authority == "SLACK")
    assert capability.resource_identifiers == (SLACK_DEMO_RESOURCE,)
    assert set(capability.operations) == {"SLACK_INSPECT_CHANNEL", "SLACK_POST_MESSAGE"}
    assert CHANNEL not in capability.model_dump_json() and TOKEN not in capability.model_dump_json()
    with pytest.raises(ValidationError):
        OperatorTarget(authority="SLACK", resource_type="ISSUE", resource_identifier=CHANNEL)
    with pytest.raises(ValidationError):
        intent("INSPECT", target=None)
    with pytest.raises(ValidationError):
        intent("INSPECT", fact_ids=["objective"])
    with pytest.raises(ValidationError):
        RequestedOperation(operation="SLACK_INSPECT_CHANNEL", value="mutate")


@pytest.mark.parametrize(
    "identifier", [CHANNEL, "C999ABC456", "D123ABC456", "U123ABC456", "general", "admin"]
)
def test_raw_channel_unknown_dm_member_admin_targets_denied(identifier: str) -> None:
    session = SlackSession()
    result = request(coordinator(session), target=target(identifier))
    assert result.lifecycle == "DENIED" and session.calls == []
    with pytest.raises(OperatorAdapterError):
        adapter(session).inspect(target(identifier))


@pytest.mark.parametrize("role", ["VIEWER", "GUEST", "ADMIN", "operator", ""])
def test_non_operator_roles_cannot_post(role: str) -> None:
    session = SlackSession()
    assert request(coordinator(session), role=role).lifecycle == "DENIED"
    assert session.calls == []


@pytest.mark.parametrize(
    "text,reason",
    [
        (None, "slack_empty_message"),
        ("", "slack_empty_message"),
        (" \n\t", "slack_empty_message"),
        ("x" * 501, "slack_message_too_long"),
        ("@channel blocked", "slack_mentions_denied"),
        ("@HERE", "slack_mentions_denied"),
        ("@everyone!", "slack_mentions_denied"),
        ("<!channel>", "slack_mentions_denied"),
        ("<!subteam^S123|ops>", "slack_mentions_denied"),
        ("<@U123ABC456>", "slack_mentions_denied"),
        ("<#C123ABC456>", "slack_mentions_denied"),
        ("@he\u200bre", "slack_control_characters"),
        ("bad\x7f", "slack_control_characters"),
        (TOKEN, "slack_credentials_denied"),
    ],
)
def test_deterministic_message_policy(text: str | None, reason: str) -> None:
    assert slack_message_denial(text) == reason
    # Defense even for an injected implementation that bypasses Pydantic constructors.
    invalid = RequestedOperation.model_construct(operation="SLACK_POST_MESSAGE", value=text)
    verdict = ActionAuthorizationPolicy().decide(
        "OPERATOR", target(), (invalid,), CapabilityRegistry((adapter(),))
    )
    assert verdict == ("DENIED", reason)


def test_message_bounds_and_no_arbitrary_payload() -> None:
    assert slack_message_denial("x" * SLACK_MESSAGE_LIMIT) is None
    for text in ("", " \n\t", TOKEN):
        with pytest.raises(ValidationError):
            operation(text)
    with pytest.raises(ValidationError):
        RequestedOperation.model_validate(
            {"operation": "SLACK_POST_MESSAGE", "value": TEXT, "blocks": []}
        )
    session = SlackSession()
    assert (
        request(coordinator(session), operations=(operation("@here blocked"),)).lifecycle
        == "DENIED"
    )
    assert request(coordinator(session), operations=(operation("x" * 501),)).lifecycle == "DENIED"
    assert session.calls == []
    assert (
        request(
            coordinator(session),
            operations=(RequestedOperation(operation="SLACK_INSPECT_CHANNEL"),),
        ).lifecycle
        == "DENIED"
    )


def test_one_post_separate_read_back_exact_verification_and_replay(capsys: Any) -> None:
    session = SlackSession()
    control = coordinator(session)
    result = request(control)
    assert result.lifecycle == "VERIFIED" and result.verification_result == "PASSED"
    assert result.execution_acknowledgement == {
        "channel_id": CHANNEL,
        "message_ts": TS,
        "slack_ok": "true",
    }
    assert result.expected_state["text"] == result.observed_state["text"] == TEXT
    methods = [name for name, _ in session.calls]
    assert methods.count("chat.postMessage") == 1
    assert methods[-2:] == ["chat.postMessage", "conversations.history"]
    assert session.calls[-1][1] == {
        "channel": CHANNEL,
        "limit": 1,
        "oldest": TS,
        "latest": TS,
        "inclusive": True,
    }
    post = next(params for name, params in session.calls if name == "chat.postMessage")
    assert post == {
        "channel": CHANNEL,
        "text": TEXT,
        "mrkdwn": False,
        "parse": "none",
        "link_names": False,
        "unfurl_links": False,
        "unfurl_media": False,
    }
    calls = len(session.calls)
    assert request(control) == result and len(session.calls) == calls
    assert len(session.messages) == 1 and result.external_effects_possible
    assert TOKEN not in result.model_dump_json() + capsys.readouterr().out


def test_inspection_is_read_only_bounded_and_sanitized() -> None:
    session = SlackSession()
    session.messages = [
        {"type": "message", "user": "U999ABC456", "text": "unrelated private user data", "ts": TS},
        {"type": "message", "user": USER, "bot_id": BOT, "text": TEXT, "ts": TS},
    ]
    result = adapter(session).inspect(target())
    assert result["latest_reflow_message_text"] == TEXT
    assert "unrelated" not in json.dumps(result)
    assert session.calls[-1] == ("conversations.history", {"channel": CHANNEL, "limit": 15})
    assert "chat.postMessage" not in [m for m, _ in session.calls]
    session.messages[1]["text"] = TOKEN
    assert adapter(session).inspect(target())["latest_reflow_message_text"] is None


@pytest.mark.parametrize(
    "field,value",
    [
        ("is_member", False),
        ("is_private", True),
        ("is_archived", True),
        ("is_shared", True),
        ("is_im", True),
        ("is_mpim", True),
        ("is_pending_ext_shared", True),
        ("is_thread_only", True),
        ("id", "C999ABC456"),
        ("is_channel", None),
    ],
)
def test_channel_membership_public_unshared_prewrite_gate(field: str, value: Any) -> None:
    session = SlackSession()
    session.channel[field] = value
    result = request(coordinator(session))
    assert result.lifecycle == "FAILED" and not result.external_effects_possible
    assert "chat.postMessage" not in [m for m, _ in session.calls]


def test_authentication_identity_and_scope_prewrite_gate() -> None:
    for payload, headers, category in (
        (
            {"ok": True, "team_id": "T999ABC456", "user_id": USER, "bot_id": BOT},
            {},
            "slack_identity_mismatch",
        ),
        ({"ok": True, "team_id": TEAM, "user_id": USER}, {}, "slack_identity_mismatch"),
        ({"ok": True}, {"x-oauth-scopes": "chat:write"}, "slack_required_scopes_unconfirmed"),
    ):
        session = SlackSession()
        session.errors["auth.test"] = Response(payload, **headers)
        result = request(coordinator(session))
        assert result.error_category == category and not result.external_effects_possible
        assert "chat.postMessage" not in [m for m, _ in session.calls]


@pytest.mark.parametrize(
    "status,payload,category",
    [
        (200, {"ok": False, "error": "invalid_auth"}, "slack_authentication"),
        (401, {"ok": False, "error": "invalid_auth"}, "slack_authentication"),
        (403, {"ok": False, "error": "missing_scope"}, "slack_permission"),
        (404, {"ok": False, "error": "channel_not_found"}, "slack_not_found"),
        (429, {"ok": False, "error": "ratelimited"}, "slack_rate_limit"),
        (200, {"ok": False, "error": "is_archived"}, "slack_channel_unavailable"),
        (503, {"ok": False, "error": "internal_error"}, "slack_server"),
        (200, {"ok": False, "error": "arbitrary_" + TOKEN}, "slack_provider_error"),
        (302, {}, "slack_provider_error"),
        (200, ValueError(TOKEN), "slack_malformed_response"),
        (200, [], "slack_malformed_response"),
        (200, {"ok": "true"}, "slack_malformed_response"),
    ],
)
def test_provider_errors_safe_diagnostics_no_retry(
    status: int, payload: Any, category: str
) -> None:
    session = SlackSession()
    session.errors["chat.postMessage"] = Response(
        payload,
        status,
        **{
            "Retry-After": "60",
            "x-slack-req-id": TOKEN,
            "Authorization": TOKEN,
            "Set-Cookie": TOKEN,
        },
    )
    result = request(coordinator(session))
    assert result.lifecycle == "FAILED" and result.error_category == category
    assert result.adapter_proof["slack_http_status"] == str(status)
    assert result.adapter_proof["slack_retry_after_seconds"] == "60"
    assert TOKEN not in result.model_dump_json()
    assert [m for m, _ in session.calls].count("chat.postMessage") == 1


def test_readback_mismatch_missing_and_secret_never_verify() -> None:
    session = SlackSession()
    session.read_mismatch = True
    assert request(coordinator(session)).lifecycle == "VERIFICATION_FAILED"
    instance = adapter(session)
    for message in ({}, {"type": "message", "ts": TS, "text": TOKEN, "user": USER, "bot_id": BOT}):
        session.read_mismatch = False
        session.messages = [message] if message else []
        observed = instance.read_back(target(), {"channel_id": CHANNEL, "message_ts": TS})
        assert TOKEN not in json.dumps(observed)
        assert not instance.verify({"text": TEXT}, observed)[0]


def test_verify_checks_all_identity_fields_and_exact_text() -> None:
    instance = adapter()
    expected: dict[str, str | None] = {
        "channel_id": CHANNEL,
        "message_ts": TS,
        "text": TEXT,
        "bot_user_id": USER,
        "bot_id": BOT,
    }
    assert instance.verify(expected, expected)[0]
    for key in expected:
        assert not instance.verify(expected, {**expected, key: "different"})[0]
    assert not instance.verify(expected, {**expected, "text": TEXT + " "})[0]
    assert not instance.verify({}, {})[0]


@pytest.mark.parametrize(
    "text", ["a & b < c > d", "literal &amp; &lt;", "line one\nline two", " padded "]
)
def test_plain_text_escape_roundtrip_and_exact_readback(text: str) -> None:
    assert decode_slack_text(encode_slack_text(text)) == text
    session = SlackSession()
    result = request(coordinator(session), operations=(operation(text),))
    assert result.lifecycle == "VERIFIED" and result.observed_state["text"] == text


@pytest.mark.parametrize("candidate", [True, False])
def test_lost_ack_never_reposts_or_fabricates_verified(candidate: bool) -> None:
    session = SlackSession()
    session.lost_ack = candidate
    if not candidate:
        session.errors["chat.postMessage"] = requests.ConnectionError(TOKEN)
    control = coordinator(session)
    result = request(control)
    assert result.lifecycle == "FAILED" and result.external_effects_possible
    assert result.execution_acknowledgement == {} and result.verification_result == "NOT_RUN"
    assert result.adapter_proof["slack_write_outcome"] == "uncertain"
    assert result.adapter_proof["slack_candidate_count_in_window"] == str(int(candidate))
    assert session.calls[-1][1]["limit"] == 15 and "oldest" in session.calls[-1][1]
    calls = len(session.calls)
    assert request(control) == result and len(session.calls) == calls
    assert [m for m, _ in session.calls].count("chat.postMessage") == 1
    assert len(session.messages) == int(candidate)


@pytest.mark.parametrize(
    "ack",
    [
        {"ok": True, "channel": "C999ABC456", "ts": TS},
        {"ok": True, "channel": CHANNEL, "ts": float(TS)},
        {"ok": True, "channel": CHANNEL},
    ],
)
def test_invalid_ack_remains_uncertain(ack: dict[str, Any]) -> None:
    session = SlackSession()
    session.errors["chat.postMessage"] = Response(ack)
    result = request(coordinator(session))
    assert result.error_category == "slack_invalid_acknowledgement"
    assert result.external_effects_possible and not result.execution_acknowledgement


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", ["INSPECT", "ACT"])
async def test_service_uses_existing_plane_and_replay_bypasses_agent6(kind: str) -> None:
    session = SlackSession()
    agents = FakeAgents(intent(kind))

    async def read(_: str) -> Any:
        return snapshot()

    async def calendar(_: str) -> Any:
        raise AssertionError("Slack must not invoke canonical Calendar")

    service = OperatorService(read, calendar, agents, coordinator(session))
    query = OperatorQuery(incident_id=INCIDENT, message=TEXT, idempotency_key="slack-service-key")
    response = await service.query(query, REQUEST, "a" * 64, "OPERATOR")
    assert response.intent is not None
    assert response.intent.subject == "SLACK" and response.simulation is None
    assert TOKEN not in response.model_dump_json() + str(agents.inputs)
    if kind == "ACT":
        assert response.action is not None and response.action.lifecycle == "VERIFIED"
        replay = await service.query(query, REQUEST, "a" * 64, "OPERATOR")
        assert replay.action == response.action and replay.agents == ()
        assert replay.intent is not None
        assert replay.intent.subject == "SLACK" and len(agents.inputs) == 1
        assert [m for m, _ in session.calls].count("chat.postMessage") == 1
    else:
        assert response.inspection is not None and response.action is None
        assert response.external_effects_executed is False
        assert "chat.postMessage" not in [m for m, _ in session.calls]


def test_redaction_configuration_and_method_bounds() -> None:
    assert safe_text(TOKEN) == "[redacted]"
    for change in (
        {"demo_channel_id": "D123ABC456"},
        {"team_id": "unknown"},
        {"bot_token": "xoxp-user-token"},
    ):
        with pytest.raises(ValueError):
            adapter(**change)
    instance = adapter()
    with pytest.raises(OperatorAdapterError):
        instance._request("conversations.list")
    with pytest.raises(OperatorAdapterError):
        instance._request("chat.postMessage", channel="D123ABC456")
    with pytest.raises(OperatorAdapterError):
        instance.read_back(target(), {"channel_id": "C999ABC456", "message_ts": TS})


@pytest.mark.parametrize("approved", [True, False])
@pytest.mark.parametrize("kind", ["INSPECT", "ACT"])
def test_bff_to_private_backend_contract_and_forged_role_cannot_elevate(
    monkeypatch: Any,
    approved: bool,
    kind: str,
) -> None:
    from objective_recovery_agent.operator_api import authorized_role

    from objective_recovery.web_bff.backend import BackendResponse
    from test_p2d_web_bff import ORIGIN, make_client, sign_in

    client, _, backend = make_client()
    session = SlackSession()
    agents = FakeAgents(intent(kind))
    uid_hash = hashlib.sha256(b"google-user").hexdigest()
    monkeypatch.setenv("OPERATOR_ALLOWED_SUBJECT_HASHES", uid_hash if approved else "b" * 64)

    async def read(_: str) -> Any:
        return snapshot()

    async def calendar(_: str) -> Any:
        raise AssertionError("No canonical Calendar calls")

    service = OperatorService(read, calendar, agents, coordinator(session))
    roles: list[str] = []

    def post(payload: bytes, subject: str, request_id: str, role: str) -> BackendResponse:
        assert subject == uid_hash
        roles.append(role)
        response = asyncio.run(
            service.query(
                OperatorQuery.model_validate_json(payload),
                request_id,
                subject,
                authorized_role(subject, role),
            )
        )
        return BackendResponse(200, response.model_dump_json().encode(), {})

    monkeypatch.setattr(backend, "query_operator", post, raising=False)
    sign_in(client, "google-id-token")
    response = client.post(
        "/api/v1/operator/query",
        headers={
            "Origin": ORIGIN,
            "X-Reflow-Operator-Role": "OPERATOR",
            "X-Reflow-Operator-Subject": "b" * 64,
        },
        json={"incident_id": INCIDENT, "message": TEXT, "idempotency_key": "bff-slack-key"},
    )
    assert response.status_code == 200 and TOKEN not in response.text
    assert roles == ["OPERATOR" if approved else "VIEWER"]
    if kind == "ACT":
        assert response.json()["action"]["lifecycle"] == ("VERIFIED" if approved else "DENIED")
        assert len(session.messages) == int(approved)
    else:
        assert response.json()["inspection"]["authority"] == "SLACK" and not session.messages
    assert authorized_role("c" * 64, "OPERATOR") == "VIEWER"


def test_guest_slack_request_stops_before_backend(monkeypatch: Any) -> None:
    from test_p2d_web_bff import ORIGIN, make_client, sign_in

    client, _, backend = make_client()
    calls: list[Any] = []
    monkeypatch.setattr(backend, "query_operator", lambda *args: calls.append(args), raising=False)
    sign_in(client, "guest-id-token")
    response = client.post(
        "/api/v1/operator/query",
        headers={"Origin": ORIGIN},
        json={
            "incident_id": INCIDENT,
            "message": TEXT,
            "idempotency_key": "guest-slack-key",
        },
    )
    assert response.status_code == 403 and calls == []


def test_malformed_provider_shapes_and_safe_correlation() -> None:
    for method, payload in (
        ("conversations.info", {"ok": True, "channel": None}),
        ("conversations.history", {"ok": True, "messages": "not a list"}),
        ("conversations.history", {"ok": True, "messages": ["not an object"]}),
        ("conversations.history", {"ok": True, "messages": [{}] * 16}),
    ):
        session = SlackSession()
        session.errors[method] = Response(payload)
        assert request(coordinator(session)).error_category == "slack_malformed_response"
    session = SlackSession()
    session.channel["name"] = TOKEN
    assert request(coordinator(session)).error_category == "slack_malformed_response"
    session = SlackSession()
    session.errors["chat.postMessage"] = Response(
        {"ok": False, "error": "missing_scope"},
        403,
        **{"x-slack-req-id": "12345678-abcd-1234-abcd-123456789abc"},
    )
    result = request(coordinator(session))
    assert result.adapter_proof["slack_request_id"] == "12345678-abcd-1234-abcd-123456789abc"
    assert result.adapter_proof["slack_error_code"] == "missing_scope"


def test_adapter_rechecks_policy_and_proposal_before_write() -> None:
    instance = adapter()
    current = instance.inspect(target())
    with pytest.raises(OperatorAdapterError, match="unsupported_slack_mutation"):
        instance.propose(
            target(), (RequestedOperation(operation="SLACK_INSPECT_CHANNEL"),), current
        )
    with pytest.raises(OperatorAdapterError, match="slack_mentions_denied"):
        instance.propose(target(), (operation("@here blocked"),), current)
    with pytest.raises(OperatorAdapterError, match="slack_target_not_permitted"):
        instance.propose(target(), (operation(),), {**current, "team_id": "other"})
    with pytest.raises(OperatorAdapterError, match="slack_proposal_mismatch"):
        instance.execute("action", target(), (operation(),), current, {})
    assert instance._observed_text("x" * 501) is None
    assert instance._observed_text("x" * 3001) is None
    assert instance._observed_text("Bearer something-sensitive") is None


def test_uncertain_reconciliation_failure_stays_failed_without_duplicate() -> None:
    class FailingHistory(SlackSession):
        def request(self, verb: str, url: str, **kwargs: Any) -> Response:
            if url.endswith("conversations.history") and self.messages:
                raise requests.Timeout(TOKEN)
            return super().request(verb, url, **kwargs)

    session = FailingHistory()
    session.lost_ack = True
    control = coordinator(session)
    result = request(control)
    assert result.adapter_proof["slack_reconciliation"] == "read_unavailable"
    assert result.lifecycle == "FAILED" and result.external_effects_possible
    assert request(control) == result and len(session.messages) == 1


def test_acknowledged_read_failure_keeps_ack_but_never_verifies() -> None:
    class FailingReadback(SlackSession):
        def request(self, verb: str, url: str, **kwargs: Any) -> Response:
            if (
                url.endswith("conversations.history")
                and (kwargs.get("params") or {}).get("limit") == 1
            ):
                return Response({"ok": False, "error": "ratelimited"}, 429)
            return super().request(verb, url, **kwargs)

    session = FailingReadback()
    control = coordinator(session)
    result = request(control)
    assert result.lifecycle == "FAILED" and result.error_category == "slack_rate_limit"
    assert result.execution_acknowledgement["message_ts"] == TS
    assert result.verification_result == "NOT_RUN" and result.observed_state == {}
    assert request(control) == result and len(session.messages) == 1


def test_durable_replay_after_coordinator_restart_and_conflict() -> None:
    store = InMemoryOperatorActionStore()
    first_session = SlackSession()
    first = OperatorActionCoordinator(CapabilityRegistry((adapter(first_session),)), store)
    result = request(first)
    new_session = SlackSession()
    restarted = OperatorActionCoordinator(CapabilityRegistry((adapter(new_session),)), store)
    assert request(restarted) == result and new_session.calls == []
    with pytest.raises(OperatorAdapterError, match="idempotency_conflict"):
        request(restarted, operations=(operation("A different message"),))
    assert new_session.calls == [] and len(first_session.messages) == 1
