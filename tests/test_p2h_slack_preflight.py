from typing import Any

import pytest
import requests
from scripts import execute_p2h_slack_live, verify_p2h_prelive
from scripts.preflight_p2h_slack import CHANNEL, ReadOnlySession, checked_identity


@pytest.mark.parametrize(
    ("method", "url", "parameters"),
    [
        ("POST", "https://slack.com/api/chat.postMessage", {}),
        ("POST", "https://slack.com/api/chat.delete", {}),
        ("GET", "https://other.example/api/auth.test", {}),
        ("GET", "https://slack.com/api/conversations.history", {"channel": CHANNEL, "limit": 100}),
        ("GET", "https://slack.com/api/conversations.info", {"channel": "C1234567890"}),
        ("GET", "https://slack.com/api/conversations.list", {}),
    ],
)
def test_preflight_blocks_writes_other_targets_and_unbounded_reads(
    monkeypatch: Any, method: str, url: str, parameters: dict[str, Any]
) -> None:
    def forbidden(*args: Any, **kwargs: Any) -> Any:
        pytest.fail("Network transport must not be reached")

    monkeypatch.setattr(requests.Session, "request", forbidden)
    with ReadOnlySession() as session, pytest.raises(RuntimeError):
        session.request(method, url, params=parameters, allow_redirects=False, timeout=4)


def test_preflight_identity_discards_extra_data_and_checks_workspace() -> None:
    payload = {
        "ok": True,
        "team": "Reflow Demo",
        "user": "reflow_operator",
        "team_id": "T1234567890",
        "user_id": "U1234567890",
        "bot_id": "B1234567890",
        "url": "https://reflow-demo.slack.com/",
        "unrelated": "PRIVATE_DATA",
    }
    result = checked_identity(payload)
    assert "PRIVATE_DATA" not in str(result)
    payload["team"] = "Another workspace"
    with pytest.raises(RuntimeError, match="workspace_mismatch"):
        checked_identity(payload)


def test_deployed_inspect_has_viewer_authority_and_no_action_key(monkeypatch: Any) -> None:
    observed: dict[str, Any] = {}

    def post(instance: Any, url: str, **kwargs: Any) -> Any:
        observed.update(kwargs)
        observed["url"] = url
        response = requests.Response()
        response.status_code = 403
        return response

    monkeypatch.setattr(requests.Session, "post", post)
    monkeypatch.setattr(verify_p2h_prelive, "identity_token", lambda: "ephemeral-test-identity")
    result = verify_p2h_prelive.inspect_deployed(
        {
            "traffic": [
                {
                    "tag": "p2h-prelive",
                    "url": "https://p2h-prelive---objective-recovery-2gbnbjfvkq-uc.a.run.app",
                }
            ]
        }
    )
    assert not result["passed"]
    assert observed["headers"]["X-Reflow-Operator-Role"] == "VIEWER"
    assert observed["json"]["message"] == "Inspect the configured release channel."
    assert "idempotency_key" not in observed["json"]
    assert observed["allow_redirects"] is False
    assert "ephemeral-test-identity" not in str(result)


def test_deployed_inspect_rejects_unexpected_origin() -> None:
    with pytest.raises(RuntimeError, match="unexpected_deployed_inspect_origin"):
        verify_p2h_prelive.inspect_deployed(
            {"traffic": [{"tag": "p2h-prelive", "url": "https://other.example"}]}
        )


def test_live_operator_request_is_fixed_to_exact_message_and_same_key(monkeypatch: Any) -> None:
    observed: dict[str, Any] = {}

    def post(instance: Any, url: str, **kwargs: Any) -> Any:
        observed.update(kwargs)
        observed["url"] = url
        response = requests.Response()
        response.status_code = 503
        return response

    monkeypatch.setattr(requests.Session, "post", post)
    monkeypatch.setattr(execute_p2h_slack_live, "identity_token", lambda: "test-cloud-identity")
    status, response = execute_p2h_slack_live.operator_request("a" * 64, "request-id")
    assert status == 503 and response is None
    assert observed["url"] == execute_p2h_slack_live.SERVICE_URL + "/api/v1/operator/query"
    assert observed["json"] == {
        "incident_id": execute_p2h_slack_live.INCIDENT,
        "message": (
            "Post 'Backend engineer unavailable. SCRUM-6 is blocked.' to the release channel."
        ),
        "idempotency_key": "p2h-slack-final-live-qualification-20260829-v1",
    }
    assert observed["allow_redirects"] is False
    assert "test-cloud-identity" not in str(response)


def test_read_only_transport_allows_exact_timestamp_not_unbounded_history(
    monkeypatch: Any,
) -> None:
    def response(instance: Any, method: str, url: str, **kwargs: Any) -> Any:
        result = requests.Response()
        result.status_code = 200
        result._content = b'{"ok":true,"messages":[]}'
        return result

    monkeypatch.setattr(requests.Session, "request", response)
    with ReadOnlySession() as session:
        result = session.request(
            "GET",
            "https://slack.com/api/conversations.history",
            params={
                "channel": CHANNEL,
                "limit": 1,
                "oldest": "1787957000.123456",
                "latest": "1787957000.123456",
                "inclusive": True,
            },
            json=None,
            timeout=4,
            allow_redirects=False,
        )
        assert result.status_code == 200
        with pytest.raises(RuntimeError, match="history_guard"):
            session.request(
                "GET",
                "https://slack.com/api/conversations.history",
                params={"channel": CHANNEL, "limit": 16},
                json=None,
                timeout=4,
                allow_redirects=False,
            )
