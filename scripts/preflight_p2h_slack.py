"""Pinned-secret, backend-identity Slack preflight: four bounded read calls, no writes.

The real adapter/registry is exercised unchanged. Credentials and history text stay
in process memory; only explicitly selected identity/configuration metadata is saved.
"""

from __future__ import annotations

import argparse
import json
import logging
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import google.auth
import requests
from google.auth import impersonated_credentials
from google.cloud import secretmanager
from objective_recovery_agent.operator_actions import CapabilityRegistry, OperatorAdapterError
from objective_recovery_agent.operator_context import safe_text
from objective_recovery_agent.operator_schemas import OperatorTarget
from objective_recovery_agent.slack_operator_adapter import SlackOperatorAdapter
from objective_recovery_agent.slack_operator_policy import SLACK_REQUIRED_SCOPES

PROJECT = "project-f334c42b-7a03-4194-932"
ACCOUNT = f"objective-recovery-app@{PROJECT}.iam.gserviceaccount.com"
SECRET = f"projects/{PROJECT}/secrets/objective-recovery-slack-bot-token/versions/1"
CHANNEL = "C0BTKPVEM25"
CHANNEL_NAME = "reflow-release-demo"


class ReadOnlySession(requests.Session):
    def __init__(self) -> None:
        super().__init__()
        self.trust_env = False
        self.calls: list[dict[str, Any]] = []

    def request(self, method: str, url: str, **kwargs: Any) -> requests.Response:  # type: ignore[override]
        api = url.removeprefix("https://slack.com/api/")
        expected = {
            "auth.test": "POST",
            "conversations.info": "GET",
            "conversations.history": "GET",
        }
        if (
            api not in expected
            or url != f"https://slack.com/api/{api}"
            or method != expected[api]
            or len(self.calls) >= 4
            or kwargs.get("allow_redirects") is not False
            or kwargs.get("timeout") != 4
        ):
            raise RuntimeError("read_only_transport_guard")
        parameters = kwargs.get("params") or {}
        if api == "auth.test":
            if parameters or kwargs.get("json") not in ({}, None):
                raise RuntimeError("read_only_auth_guard")
        elif (
            parameters
            != (
                {"channel": CHANNEL, "limit": 15}
                if api == "conversations.history"
                else {"channel": CHANNEL}
            )
            or kwargs.get("json") is not None
        ):
            raise RuntimeError("read_only_channel_guard")
        event: dict[str, Any] = {"api": api, "http_method": method}
        self.calls.append(event)
        response = super().request(method, url, **kwargs)
        event["http_status"] = response.status_code
        payload = response.json()
        event["ok"] = payload.get("ok") is True if isinstance(payload, dict) else False
        if api == "auth.test":
            scopes = response.headers.get("x-oauth-scopes", "").replace(",", " ").split()
            if len(scopes) > 30 or any(not re.fullmatch(r"[a-z_:.-]{1,60}", s) for s in scopes):
                raise RuntimeError("invalid_scope_metadata")
            event["scopes"] = sorted(set(scopes))
        elif api == "conversations.info" and isinstance(payload, dict):
            channel = payload.get("channel", {})
            flags = (
                "is_channel",
                "is_private",
                "is_member",
                "is_archived",
                "is_shared",
                "is_ext_shared",
                "is_org_shared",
                "is_pending_ext_shared",
                "is_im",
                "is_mpim",
                "is_group",
                "is_read_only",
                "is_thread_only",
                "is_frozen",
            )
            event["channel_flags"] = {
                key: channel[key] for key in flags if isinstance(channel.get(key), bool)
            }
        elif api == "conversations.history" and isinstance(payload, dict):
            messages = payload.get("messages")
            event["message_count_in_window"] = len(messages) if isinstance(messages, list) else None
            event["limit"] = 15
        return response


def checked_identity(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict) or payload.get("ok") is not True:
        raise RuntimeError("slack_auth_failed")
    result: dict[str, Any] = {"ok": True}
    for key, pattern in {
        "team_id": r"T[A-Z0-9]{8,20}",
        "user_id": r"[UW][A-Z0-9]{8,20}",
        "bot_id": r"B[A-Z0-9]{8,20}",
    }.items():
        value = payload.get(key)
        if not isinstance(value, str) or not re.fullmatch(pattern, value):
            raise RuntimeError("slack_identity_invalid")
        result[key] = value
    for key in ("team", "user"):
        value = payload.get(key)
        if not isinstance(value, str) or not value or safe_text(value, 100) != value:
            raise RuntimeError("slack_identity_label_invalid")
        result[key] = value
    if result["team"] != "Reflow Demo":
        raise RuntimeError("slack_workspace_mismatch")
    url = payload.get("url")
    if isinstance(url, str) and re.fullmatch(r"https://[a-z0-9-]+\.slack\.com/", url):
        result["url"] = url
    return result


def preflight(report: dict[str, Any]) -> None:
    report["stage"] = "backend_identity_secret_access"
    source, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    credentials = impersonated_credentials.Credentials(  # type: ignore[no-untyped-call]
        source_credentials=source,
        target_principal=ACCOUNT,
        target_scopes=["https://www.googleapis.com/auth/cloud-platform"],
        lifetime=300,
    )
    client = secretmanager.SecretManagerServiceClient(credentials=credentials, transport="rest")
    token = client.access_secret_version(
        request={"name": SECRET}, retry=None, timeout=20
    ).payload.data.decode()
    if not token.startswith("xoxb-") or any(c.isspace() for c in token):
        raise RuntimeError("slack_bot_token_shape_invalid")
    with ReadOnlySession() as session:
        report["calls"] = session.calls
        session.headers.update({"Authorization": f"Bearer {token}", "Accept": "application/json"})
        report["stage"] = "auth_test"
        response = session.request(
            "POST",
            "https://slack.com/api/auth.test",
            json={},
            timeout=4,
            allow_redirects=False,
        )
        identity = checked_identity(response.json())
        report["identity"] = identity
        if not set(session.calls[0]["scopes"]) >= SLACK_REQUIRED_SCOPES:
            raise RuntimeError("slack_required_scopes_missing")
        report["stage"] = "actual_adapter_registry_inspect"
        adapter = SlackOperatorAdapter(
            bot_token=token,
            demo_channel_id=CHANNEL,
            team_id=identity["team_id"],
            session=session,
        )
        registry = CapabilityRegistry((adapter,))
        target = OperatorTarget(
            authority="SLACK",
            resource_type="CHANNEL",
            resource_identifier="configured-release-channel",
        )
        inspected = registry.inspect(target)
        state = inspected.observed_state
        if state.get("channel_name") != CHANNEL_NAME:
            raise RuntimeError("slack_channel_name_mismatch")
        report["inspection"] = {
            "authority": inspected.authority,
            "resource_identifier": inspected.resource_identifier,
            "observed_at": inspected.observed_at,
            "observed_state": {k: v for k, v in state.items() if k != "latest_reflow_message_text"},
            "latest_reflow_message_present": state.get("latest_reflow_message_ts") is not None,
            "message_text_persisted": False,
        }
        report["registry"] = [
            c.model_dump(mode="json") for c in registry.capabilities() if c.authority == "SLACK"
        ]
        report["required_scopes_sufficient"] = True
        report["passed"] = True
        report["stage"] = "complete"
        if token in json.dumps(report):
            report.clear()
            raise RuntimeError("credential_reflection_guard")
        session.headers.clear()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    output = Path(args.output)
    if output.exists():
        parser.error("Preserve existing proof; choose a new output path")
    logging.disable(logging.CRITICAL)
    report: dict[str, Any] = {
        "observed_at": datetime.now(UTC).isoformat(),
        "read_only": True,
        "passed": False,
        "credential_identity": ACCOUNT,
        "secret_reference": SECRET,
        "slack_message_writes": 0,
        "secret_payload_persisted": False,
    }
    try:
        preflight(report)
    except Exception as error:
        report["passed"] = False
        report["error_type"] = type(error).__name__
        # Exception bodies, response objects, headers and tracebacks are never emitted.
        if isinstance(error, OperatorAdapterError):
            report["adapter_error_category"] = safe_text(error.category, 100)
    output.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(report, indent=2) + "\n"
    output.write_text(text, encoding="utf-8")
    print(text)
    if not report.get("passed"):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
