"""Read deployment metadata, compare preserved config, optionally perform one Viewer INSPECT.

No deployment operations or Slack token access. HTTP POST is only the read-only
Operator query; no action key is supplied. Only safe proof metadata is retained.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import shutil
import subprocess
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import requests
from objective_recovery_agent.operator_schemas import OperatorResponse
from scripts.audit_p2h_readonly import cloud
from scripts.preflight_p2h_slack import CHANNEL, CHANNEL_NAME, PROJECT

SOURCE = "113a307a7867e29751137b1fef0b61be50c4a562"
TEAM = "T0BT2EP259V"
BUILD = "fe37f168-afd4-45b8-bf67-81c5c4213ca8"
SLACK_NAMES = {"SLACK_BOT_TOKEN", "SLACK_TEAM_ID", "SLACK_DEMO_CHANNEL_ID"}


def digest(value: Any) -> str:
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def deployment(service_name: str) -> dict[str, Any]:
    service = cloud(
        "run", "services", "describe", service_name, "--project", PROJECT, "--region", "us-central1"
    )
    template = service["spec"]["template"]
    spec = json.loads(json.dumps(template["spec"]))
    container = spec["containers"][0]
    env = container.get("env", [])
    excluded = {"COMMIT_SHA"} | (SLACK_NAMES if service_name == "objective-recovery" else set())
    container.pop("image", None)
    container["env"] = sorted(
        (e for e in env if e["name"] not in excluded), key=lambda e: e["name"]
    )
    template_annotations = {
        k: v
        for k, v in template.get("metadata", {}).get("annotations", {}).items()
        if k
        not in {
            "run.googleapis.com/client-name",
            "run.googleapis.com/client-version",
            "run.googleapis.com/operation-id",
        }
    }
    annotations = service["metadata"].get("annotations", {})
    security_annotations = {
        k: annotations.get(k)
        for k in (
            "run.googleapis.com/ingress",
            "run.googleapis.com/invoker-iam-disabled",
            "run.googleapis.com/default-url-disabled",
            "run.googleapis.com/custom-audiences",
        )
    }
    policy = cloud(
        "run",
        "services",
        "get-iam-policy",
        service_name,
        "--project",
        PROJECT,
        "--region",
        "us-central1",
    )
    revision_name = service["status"]["latestReadyRevisionName"]
    revision = cloud(
        "run",
        "revisions",
        "describe",
        revision_name,
        "--project",
        PROJECT,
        "--region",
        "us-central1",
    )
    values = {e["name"]: e.get("value") for e in env}
    capture_mode = values.get("OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT")
    return {
        "service": service_name,
        "revision": revision_name,
        "latest_created_revision": service["status"]["latestCreatedRevisionName"],
        "image_digest": revision["status"].get("imageDigest"),
        "url": service["status"]["url"],
        "traffic": service["status"]["traffic"],
        "service_account": spec.get("serviceAccountName"),
        "preserved_config_sha256": digest(
            {
                "spec": spec,
                "template_annotations": template_annotations,
                "security": security_annotations,
            }
        ),
        "iam_bindings_sha256": digest(policy.get("bindings", [])),
        "environment_names": sorted(e["name"] for e in env),
        "safe_config": {
            k: values[k]
            for k in ("COMMIT_SHA", "SLACK_TEAM_ID", "SLACK_DEMO_CHANNEL_ID")
            if k in values
        },
        "secret_references": [
            {"environment": e["name"], **e["valueFrom"]["secretKeyRef"]}
            for e in env
            if "secretKeyRef" in e.get("valueFrom", {})
        ],
        "telemetry_content_capture": capture_mode
        if capture_mode in {None, "false", "NO_CONTENT", "no_content"}
        else "unexpected_value",
        "ready": any(
            c.get("type") == "Ready" and c.get("status") == "True"
            for c in service["status"].get("conditions", [])
        ),
    }


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


def inspect_deployed(backend: dict[str, Any]) -> dict[str, Any]:
    url = next(t["url"] for t in backend["traffic"] if t.get("tag") == "p2h-prelive")
    if url != "https://p2h-prelive---objective-recovery-2gbnbjfvkq-uc.a.run.app":
        raise RuntimeError("unexpected_deployed_inspect_origin")
    request_id = str(uuid.uuid4())
    with requests.Session() as session:
        session.trust_env = False
        response = session.post(
            url + "/api/v1/operator/query",
            headers={
                "Authorization": f"Bearer {identity_token()}",
                "X-Reflow-Operator-Subject": hashlib.sha256(
                    b"p2h-readonly-deployment-qualification"
                ).hexdigest(),
                "X-Reflow-Operator-Role": "VIEWER",
                "X-Reflow-Request-Id": request_id,
            },
            json={
                "incident_id": "incident-0fc3af5b0bd1ad847aea",
                "message": "Inspect the configured release channel.",
            },
            timeout=75,
            allow_redirects=False,
        )
    result: dict[str, Any] = {
        "request_id": request_id,
        "url": url,
        "http_status": response.status_code,
        "role": "VIEWER",
        "action_key_supplied": False,
    }
    if response.status_code != 200:
        result["passed"] = False
        return result
    parsed = OperatorResponse.model_validate(response.json())
    inspection = parsed.inspection
    state = inspection.observed_state if inspection else {}
    result.update(
        {
            "disposition": parsed.disposition,
            "intent_type": parsed.intent.intent_type,
            "snapshot_fingerprint": parsed.snapshot_fingerprint,
            "revision": parsed.revision,
            "external_effects_executed": parsed.external_effects_executed,
            "action_present": parsed.action is not None,
            "observed_state": {k: v for k, v in state.items() if k != "latest_reflow_message_text"},
            "message_text_persisted": False,
            "agents": [a.model_dump(mode="json") for a in parsed.agents],
            "passed": parsed.disposition == "SUPPORTED"
            and parsed.intent.intent_type == "INSPECT"
            and not parsed.external_effects_executed
            and parsed.action is None
            and state.get("channel_id") == CHANNEL
            and state.get("channel_name") == CHANNEL_NAME
            and state.get("team_id") == TEAM
            and state.get("channel_kind") == "public_unshared"
            and state.get("is_member") == "true",
        }
    )
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--baseline")
    parser.add_argument("--inspect", action="store_true")
    args = parser.parse_args()
    output = Path(args.output)
    if output.exists() or (args.inspect and not args.baseline):
        parser.error("Use a new output; deployed INSPECT requires a config baseline")
    logging.disable(logging.CRITICAL)
    report: dict[str, Any] = {
        "observed_at": datetime.now(UTC).isoformat(),
        "passed": False,
        "source_commit": SOURCE,
    }
    try:
        report["backend"] = deployment("objective-recovery")
        report["bff"] = deployment("reflow-web-bff")
        report["passed"] = report["backend"]["ready"] and report["bff"]["ready"]
        if args.baseline:
            baseline = json.loads(Path(args.baseline).read_text(encoding="utf-8"))
            preserved = all(
                report[k][f] == baseline[k][f]
                for k in ("backend", "bff")
                for f in ("preserved_config_sha256", "iam_bindings_sha256")
            )
            report["unrelated_config_and_iam_preserved"] = preserved
            backend, bff = report["backend"], report["bff"]
            report["pinned_backend_slack_config"] = (
                backend["safe_config"]
                == {"COMMIT_SHA": SOURCE, "SLACK_TEAM_ID": TEAM, "SLACK_DEMO_CHANNEL_ID": CHANNEL}
                and {
                    "environment": "SLACK_BOT_TOKEN",
                    "name": "objective-recovery-slack-bot-token",
                    "key": "1",
                }
                in backend["secret_references"]
            )
            report["bff_has_no_slack_config_or_secrets"] = (
                not set(bff["environment_names"]) & SLACK_NAMES and not bff["secret_references"]
            )
            build = cloud(
                "builds", "describe", BUILD, "--region", "us-central1", "--project", PROJECT
            )
            images = build.get("results", {}).get("images", [])
            expected = {i["name"].split(":")[0] + "@" + i["digest"] for i in images}
            report["build"] = {
                "id": BUILD,
                "status": build["status"],
                "images": images,
                "source": build.get("source"),
                "source_commit": build.get("substitutions", {}).get("COMMIT_SHA"),
            }
            report["truthful_images_and_source"] = (
                build["status"] == "SUCCESS"
                and report["build"]["source_commit"] == SOURCE
                and all(
                    report[k]["image_digest"] in expected
                    and report[k]["safe_config"].get("COMMIT_SHA") == SOURCE
                    for k in ("backend", "bff")
                )
            )
            report["passed"] = all(
                report[k]
                for k in (
                    "passed",
                    "unrelated_config_and_iam_preserved",
                    "pinned_backend_slack_config",
                    "bff_has_no_slack_config_or_secrets",
                    "truthful_images_and_source",
                )
            )
            if args.inspect and report["passed"]:
                report["deployed_inspect"] = inspect_deployed(backend)
                report["passed"] = report["deployed_inspect"]["passed"]
    except Exception as error:
        report["passed"] = False
        report["error_type"] = type(error).__name__
    output.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(report, indent=2) + "\n"
    output.write_text(text, encoding="utf-8")
    print(text)
    if not report["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
