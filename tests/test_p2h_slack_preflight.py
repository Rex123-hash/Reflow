from typing import Any

import pytest
import requests
from scripts import verify_p2h_prelive
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
