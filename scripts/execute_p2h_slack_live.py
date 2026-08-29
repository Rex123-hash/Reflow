"""One authorized P2H Slack action, one durable replay, then read-only audit.

The mutation is performed only by the deployed Reflow Operator endpoint. This
local harness cannot issue a Slack write request. It journals safe metadata at
each boundary and refuses reuse after an action already exists.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import re
import shutil
import subprocess
import time
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import google.auth
import requests
from google.auth import impersonated_credentials
from google.cloud import secretmanager
from objective_recovery_agent.operator_actions import FirestoreOperatorActionStore
from objective_recovery_agent.operator_schemas import OperatorActionView, OperatorResponse
from objective_recovery_agent.slack_operator_policy import SLACK_REQUIRED_SCOPES
from scripts.audit_p2h_readonly import cloud
from scripts.preflight_p2h_slack import ACCOUNT, CHANNEL, CHANNEL_NAME, PROJECT, ReadOnlySession

INCIDENT = "incident-0fc3af5b0bd1ad847aea"
TEAM = "T0BT2EP259V"
BOT_USER = "U0BTDNEQBBP"
BOT_ID = "B0BTFTQFW22"
MESSAGE = "Backend engineer unavailable. SCRUM-6 is blocked."
PROMPT = f"Post '{MESSAGE}' to the release channel."
IDEMPOTENCY_KEY = "p2h-slack-final-live-qualification-20260829-v1"
SOURCE = "113a307a7867e29751137b1fef0b61be50c4a562"
REVISION = "objective-recovery-00027-jah"
DIGEST = "sha256:f2c237d84c2806a893fc56f16d2497b14e0dd93589d93e8367cbd8bc97234459"
SERVICE = "objective-recovery"
SERVICE_URL = "https://objective-recovery-2gbnbjfvkq-uc.a.run.app"
SECRET = f"projects/{PROJECT}/secrets/objective-recovery-slack-bot-token/versions/1"


def save(path: Path, report: dict[str, Any]) -> None:
    path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


def identity_token() -> str:
    process = subprocess.run(
        [shutil.which("gcloud") or "gcloud", "auth", "print-identity-token"],
        capture_output=True,
        text=True,
        timeout=30,
    )
    if process.returncode:
        raise RuntimeError("cloud_identity_unavailable")
    return process.stdout.strip()


def deployed_operator_subject() -> tuple[str, dict[str, Any]]:
    service = cloud(
        "run", "services", "describe", SERVICE, "--project", PROJECT, "--region", "us-central1"
    )
    if (
        service["status"]["latestReadyRevisionName"] != REVISION
        or service["status"]["latestCreatedRevisionName"] != REVISION
        or service["status"]["url"] != SERVICE_URL
        or service["status"]["traffic"]
        != [
            {
                "percent": 100,
                "revisionName": REVISION,
                "tag": "p2h-prelive",
                "url": "https://p2h-prelive---objective-recovery-2gbnbjfvkq-uc.a.run.app",
            }
        ]
    ):
        raise RuntimeError("qualified_backend_not_exclusive")
    revision = cloud(
        "run", "revisions", "describe", REVISION, "--project", PROJECT, "--region", "us-central1"
    )
    container = revision["spec"]["containers"][0]
    expected_image = f"us-central1-docker.pkg.dev/{PROJECT}/objective-recovery/app@{DIGEST}"
    if revision["status"].get("imageDigest") != expected_image:
        raise RuntimeError("qualified_backend_digest_mismatch")
    env = {item["name"]: item for item in container.get("env", [])}
    if (
        env.get("COMMIT_SHA", {}).get("value") != SOURCE
        or env.get("SLACK_TEAM_ID", {}).get("value") != TEAM
        or env.get("SLACK_DEMO_CHANNEL_ID", {}).get("value") != CHANNEL
        or env.get("SLACK_BOT_TOKEN", {}).get("valueFrom", {}).get("secretKeyRef")
        != {"key": "1", "name": "objective-recovery-slack-bot-token"}
    ):
        raise RuntimeError("qualified_backend_configuration_mismatch")
    subjects = [
        item.strip()
        for item in env.get("OPERATOR_ALLOWED_SUBJECT_HASHES", {}).get("value", "").split(",")
        if item.strip()
    ]
    if len(subjects) != 1 or not re.fullmatch(r"[a-f0-9]{64}", subjects[0]):
        raise RuntimeError("operator_subject_configuration_invalid")
    return subjects[0], {
        "revision": REVISION,
        "image_digest": revision["status"]["imageDigest"],
        "source_commit": SOURCE,
        "team_id": TEAM,
        "channel_id": CHANNEL,
        "secret_reference": SECRET,
        "traffic_percent": 100,
    }


def safe_action(action: OperatorActionView) -> dict[str, Any]:
    return {
        "operator_action_id": action.operator_action_id,
        "request_id": action.request_id,
        "authority": action.authority,
        "resource_type": action.resource_type,
        "resource_identifier": action.resource_identifier,
        "operations": [item.model_dump(mode="json") for item in action.operations],
        "authorization_result": action.authorization_result,
        "lifecycle": action.lifecycle,
        "execution_acknowledgement": action.execution_acknowledgement,
        "expected_state": action.expected_state,
        "observed_state": action.observed_state,
        "verification_result": action.verification_result,
        "adapter_proof": action.adapter_proof,
        "created_at": action.created_at,
        "updated_at": action.updated_at,
        "error_category": action.error_category,
        "external_effects_possible": action.external_effects_possible,
    }


def validate_response(
    response: OperatorResponse, action_id: str, *, replay: bool
) -> dict[str, Any]:
    action = response.action
    if action is None:
        raise RuntimeError("operator_action_missing")
    ack = action.execution_acknowledgement
    observed = action.observed_state
    expected = action.expected_state
    if (
        action.operator_action_id != action_id
        or action.authority != "SLACK"
        or action.resource_type != "CHANNEL"
        or action.resource_identifier != "configured-release-channel"
        or len(action.operations) != 1
        or action.operations[0].operation != "SLACK_POST_MESSAGE"
        or action.operations[0].value != MESSAGE
        or action.operations[0].comment is not None
        or action.authorization_result != "AUTO_EXECUTABLE"
        or action.lifecycle != "VERIFIED"
        or action.verification_result != "PASSED"
        or action.error_category is not None
        or not action.external_effects_possible
        or ack.get("channel_id") != CHANNEL
        or ack.get("slack_ok") != "true"
        or not re.fullmatch(r"[0-9]{10,16}\.[0-9]{6}", ack.get("message_ts", ""))
        or expected.get("channel_id") != CHANNEL
        or expected.get("message_ts") != ack["message_ts"]
        or expected.get("text") != MESSAGE
        or expected.get("bot_user_id") != BOT_USER
        or expected.get("bot_id") != BOT_ID
        or observed != expected
        or action.adapter_proof.get("attempted_operations") != "1"
        or action.adapter_proof.get("slack_exact_match") != "true"
        or action.adapter_proof.get("slack_verifier") != "independent_history_exact_match"
        or response.external_effects_executed is not True
        or response.provenance != "OPERATOR_ACTION"
        or response.snapshot_fingerprint
        != "912ae928d64e99212cb03f10e4be21db1e08a73fde442fc3bb2d9aa257937402"
        or response.revision != 16
    ):
        raise RuntimeError("operator_verified_contract_mismatch")
    if replay:
        if response.agents or response.intent.question != "Previously recorded Operator request":
            raise RuntimeError("durable_replay_did_not_bypass_agent")
    elif (
        len(response.agents) != 1
        or response.agents[0].agent_id != "operator_intent_interpreter"
        or response.agents[0].validation != "PASSED"
        or response.intent.question == "Previously recorded Operator request"
    ):
        raise RuntimeError("initial_interpretation_contract_mismatch")
    return {
        "request_id": response.request_id,
        "disposition": response.disposition,
        "intent_type": response.intent.intent_type,
        "agent_traces": [trace.model_dump(mode="json") for trace in response.agents],
        "external_effects_executed": response.external_effects_executed,
        "action": safe_action(action),
    }


def operator_request(subject: str, request_id: str) -> tuple[int, OperatorResponse | None]:
    with requests.Session() as session:
        session.trust_env = False
        result = session.post(
            SERVICE_URL + "/api/v1/operator/query",
            headers={
                "Authorization": f"Bearer {identity_token()}",
                "Content-Type": "application/json",
                "X-Reflow-Operator-Subject": subject,
                "X-Reflow-Operator-Role": "OPERATOR",
                "X-Reflow-Request-Id": request_id,
            },
            json={"incident_id": INCIDENT, "message": PROMPT, "idempotency_key": IDEMPOTENCY_KEY},
            timeout=80,
            allow_redirects=False,
        )
    return result.status_code, (
        OperatorResponse.model_validate(result.json()) if result.status_code == 200 else None
    )


def backend_token() -> str:
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
    if not token.startswith("xoxb-") or any(character.isspace() for character in token):
        raise RuntimeError("slack_bot_token_shape_invalid")
    return token


def final_slack_audit(timestamp: str) -> dict[str, Any]:
    token = backend_token()
    with ReadOnlySession() as session:
        session.headers.update({"Authorization": f"Bearer {token}", "Accept": "application/json"})
        auth = session.request(
            "POST", "https://slack.com/api/auth.test", json={}, timeout=4, allow_redirects=False
        )
        identity = auth.json()
        scopes = set(session.calls[-1].get("scopes", []))
        info = session.request(
            "GET",
            "https://slack.com/api/conversations.info",
            params={"channel": CHANNEL},
            json=None,
            timeout=4,
            allow_redirects=False,
        ).json()
        exact = session.request(
            "GET",
            "https://slack.com/api/conversations.history",
            params={
                "channel": CHANNEL,
                "limit": 1,
                "oldest": timestamp,
                "latest": timestamp,
                "inclusive": True,
            },
            json=None,
            timeout=4,
            allow_redirects=False,
        ).json()
        window = session.request(
            "GET",
            "https://slack.com/api/conversations.history",
            params={"channel": CHANNEL, "limit": 15},
            json=None,
            timeout=4,
            allow_redirects=False,
        ).json()
        channel = info.get("channel", {}) if isinstance(info, dict) else {}
        exact_messages = exact.get("messages", []) if isinstance(exact, dict) else []
        window_messages = window.get("messages", []) if isinstance(window, dict) else []
        matching = [
            item
            for item in window_messages
            if isinstance(item, dict)
            and item.get("type") == "message"
            and item.get("ts") == timestamp
            and item.get("text") == MESSAGE
            and item.get("user") == BOT_USER
            and item.get("bot_id") == BOT_ID
        ]
        passed = (
            identity.get("ok") is True
            and identity.get("team_id") == TEAM
            and identity.get("user_id") == BOT_USER
            and identity.get("bot_id") == BOT_ID
            and scopes == SLACK_REQUIRED_SCOPES
            and channel.get("id") == CHANNEL
            and channel.get("name") == CHANNEL_NAME
            and channel.get("is_channel") is True
            and channel.get("is_private") is False
            and channel.get("is_member") is True
            and channel.get("is_archived") is False
            and channel.get("is_shared") is False
            and channel.get("is_ext_shared") is False
            and len(exact_messages) == 1
            and exact_messages[0].get("ts") == timestamp
            and exact_messages[0].get("text") == MESSAGE
            and exact_messages[0].get("user") == BOT_USER
            and exact_messages[0].get("bot_id") == BOT_ID
            and len(matching) == 1
        )
        session.headers.clear()
        if token in json.dumps(session.calls):
            raise RuntimeError("credential_reflection_guard")
        return {
            "passed": passed,
            "team_id": identity.get("team_id"),
            "bot_user_id": identity.get("user_id"),
            "bot_id": identity.get("bot_id"),
            "effective_scopes": sorted(scopes),
            "channel_id": channel.get("id"),
            "channel_name": channel.get("name"),
            "channel_public_unshared_active_member": all(
                (
                    channel.get("is_channel") is True,
                    channel.get("is_private") is False,
                    channel.get("is_shared") is False,
                    channel.get("is_ext_shared") is False,
                    channel.get("is_archived") is False,
                    channel.get("is_member") is True,
                )
            ),
            "message_timestamp": timestamp,
            "exact_timestamp_read_count": len(exact_messages),
            "exact_match_count_in_latest_15": len(matching),
            "message_text_exact_match": bool(exact_messages)
            and exact_messages[0].get("text") == MESSAGE,
            "author_exact_match": bool(exact_messages)
            and exact_messages[0].get("user") == BOT_USER
            and exact_messages[0].get("bot_id") == BOT_ID,
            "message_text_persisted_beyond_authorized_constant": False,
            "slack_write_calls_by_audit": 0,
            "read_calls": [call["api"] for call in session.calls],
        }


def log_evidence(initial_id: str, replay_id: str, action_id: str) -> dict[str, Any]:
    time.sleep(4)
    entries = cloud(
        "logging",
        "read",
        (
            f'resource.type="cloud_run_revision" AND resource.labels.revision_name="{REVISION}" '
            f'AND (jsonPayload.request_id="{initial_id}" OR jsonPayload.request_id="{replay_id}" '
            f'OR jsonPayload.action_id="{action_id}")'
        ),
        "--project",
        PROJECT,
        "--limit",
        "80",
    )
    safe = [
        {
            key: value
            for key, value in (entry.get("jsonPayload") or {}).items()
            if key
            in {
                "operational_event",
                "request_id",
                "action_id",
                "agent_id",
                "model",
                "attempts",
                "validation",
                "authority",
                "operation",
                "target",
                "authorization",
                "lifecycle",
                "verification_result",
                "elapsed_ms",
            }
        }
        for entry in entries
        if isinstance(entry, dict) and isinstance(entry.get("jsonPayload"), dict)
    ]
    return {
        "events": safe,
        "initial_agent_started_count": sum(
            e.get("operational_event") == "OPERATOR_AGENT_STARTED"
            and e.get("request_id") == initial_id
            for e in safe
        ),
        "replay_agent_started_count": sum(
            e.get("operational_event") == "OPERATOR_AGENT_STARTED"
            and e.get("request_id") == replay_id
            for e in safe
        ),
        "action_requested_count": sum(
            e.get("operational_event") == "OPERATOR_ACTION_REQUESTED"
            and e.get("action_id") == action_id
            for e in safe
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--execute-authorized-once", action="store_true")
    args = parser.parse_args()
    output = Path(args.output)
    if not args.execute_authorized_once or output.exists():
        parser.error("Explicit one-shot flag and a new output are required")
    logging.disable(logging.CRITICAL)
    output.parent.mkdir(parents=True, exist_ok=True)
    report: dict[str, Any] = {
        "started_at": datetime.now(UTC).isoformat(),
        "authorization": "one exact Slack creation plus one same-key replay",
        "backend_operator_requests_allowed": 2,
        "direct_slack_write_capability_in_harness": False,
        "idempotency_key": IDEMPOTENCY_KEY,
        "exact_message": MESSAGE,
        "passed": False,
        "stage": "preflight",
    }
    save(output, report)
    try:
        subject, deployment = deployed_operator_subject()
        report["deployment"] = deployment
        action_id = hashlib.sha256(f"{subject}|{IDEMPOTENCY_KEY}".encode()).hexdigest()
        report["operator_action_id"] = action_id
        store = FirestoreOperatorActionStore(PROJECT)
        if store.get(action_id) is not None:
            raise RuntimeError("authorized_action_key_already_exists")
        report["preexisting_action"] = False
        report["stage"] = "initial_request"
        save(output, report)
        initial_id = str(uuid.uuid4())
        status, initial = operator_request(subject, initial_id)
        report["initial_http_status"] = status
        if status != 200 or initial is None:
            raise RuntimeError("initial_operator_request_failed")
        report["initial"] = validate_response(initial, action_id, replay=False)
        durable = store.get(action_id)
        if durable is None or safe_action(durable) != report["initial"]["action"]:
            raise RuntimeError("initial_durable_receipt_mismatch")
        timestamp = durable.execution_acknowledgement["message_ts"]
        report["stage"] = "same_key_replay"
        save(output, report)
        replay_id = str(uuid.uuid4())
        replay_status, replay = operator_request(subject, replay_id)
        report["replay_http_status"] = replay_status
        if replay_status != 200 or replay is None:
            raise RuntimeError("replay_operator_request_failed")
        report["replay"] = validate_response(replay, action_id, replay=True)
        if report["replay"]["action"] != report["initial"]["action"]:
            raise RuntimeError("replay_durable_action_changed")
        report["replay_same_action"] = True
        report["replay_same_timestamp"] = True
        report["replay_agent_trace_count"] = 0
        report["stage"] = "final_slack_audit"
        save(output, report)
        report["final_slack_audit"] = final_slack_audit(timestamp)
        if not report["final_slack_audit"]["passed"]:
            raise RuntimeError("final_slack_audit_failed")
        report["operational_log_evidence"] = log_evidence(initial_id, replay_id, action_id)
        report["no_duplicate_post_proof"] = {
            "direct_outbound_invocation_count_available": False,
            "durable_attempted_operations": durable.adapter_proof.get("attempted_operations"),
            "replay_bypassed_agent6": not replay.agents,
            "replay_returned_identical_action": True,
            "replay_returned_same_timestamp": True,
            "matching_messages_in_latest_15": report["final_slack_audit"][
                "exact_match_count_in_latest_15"
            ],
            "boundary": (
                "The product does not persist per-method Slack HTTP invocation counters. "
                "Evidence combines one durable attempted operation, replay-before-agent/action "
                "bypass, identical timestamp, and one exact external match; it is not a direct "
                "network-level chat.postMessage count."
            ),
        }
        report["slack_creation_calls_expected_and_inferred"] = 1
        report["passed"] = True
        report["stage"] = "complete"
        report["completed_at"] = datetime.now(UTC).isoformat()
    except Exception as error:
        report["passed"] = False
        report["error_type"] = type(error).__name__
        report["failed_at"] = datetime.now(UTC).isoformat()
    save(output, report)
    print(
        json.dumps(
            {
                "passed": report["passed"],
                "stage": report["stage"],
                "operator_action_id": report.get("operator_action_id"),
                "initial_http_status": report.get("initial_http_status"),
                "replay_http_status": report.get("replay_http_status"),
                "error_type": report.get("error_type"),
            },
            indent=2,
        )
    )
    if not report["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
