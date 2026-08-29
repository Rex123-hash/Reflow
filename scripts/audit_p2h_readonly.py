"""Read-only canonical/runtime/secret-metadata audit. Never reads secret payloads."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import requests
from objective_recovery_agent.agent_runtime import AgentId
from objective_recovery_agent.operator_agents import OPERATOR_AGENT_NAMES
from objective_recovery_agent.ui_store import FirestorePresentationStore

INCIDENT = "incident-0fc3af5b0bd1ad847aea"
FINGERPRINT = "4a1c93385b5b24060c31e995c521455622f1582967c615a2a7a7021e7f13fa8c"


def cloud(*arguments: str) -> Any:
    completed = subprocess.run(
        [shutil.which("gcloud") or "gcloud", *arguments, "--format=json"],
        capture_output=True,
        text=True,
        timeout=45,
    )
    if completed.returncode:
        raise RuntimeError("Cloud metadata read failed; no raw diagnostic retained")
    return json.loads(completed.stdout)


def runtime(project: str, service_name: str) -> dict[str, Any]:
    service = cloud(
        "run", "services", "describe", service_name, "--project", project, "--region", "us-central1"
    )
    revision_name = service["status"]["latestReadyRevisionName"]
    revision = cloud(
        "run",
        "revisions",
        "describe",
        revision_name,
        "--project",
        project,
        "--region",
        "us-central1",
    )
    container = revision["spec"]["containers"][0]
    env = container.get("env", [])
    commit = next((item.get("value") for item in env if item["name"] == "COMMIT_SHA"), None)
    return {
        "service": service_name,
        "revision": revision_name,
        "url": service["status"]["url"],
        "traffic": service["status"]["traffic"],
        "image_digest": revision["status"].get("imageDigest"),
        "configured_commit_sha": commit,
        "configured_commit_exists_locally": bool(commit)
        and subprocess.run(
            ["git", "cat-file", "-e", f"{commit}^{{commit}}"],
            capture_output=True,
        ).returncode
        == 0,
        "ready": any(
            item.get("type") == "Ready" and item.get("status") == "True"
            for item in revision["status"].get("conditions", [])
        ),
        "environment_names": sorted(item["name"] for item in env),
        "secret_references": [
            {"environment": item["name"], **item["valueFrom"]["secretKeyRef"]}
            for item in env
            if "secretKeyRef" in item.get("valueFrom", {})
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", required=True)
    parser.add_argument("--output", default="artifacts/p2h-readonly-audit.json")
    args = parser.parse_args()
    store = FirestorePresentationStore(args.project, transport="rest")
    document = store.load_incident(INCIDENT)
    document.pop("_document_id")  # Presentation decoration is not in the canonical document.
    fingerprint = hashlib.sha256(
        json.dumps(document, sort_keys=True, separators=(",", ":"), default=str).encode()
    ).hexdigest()
    canonical = {
        "incident_id": INCIDENT,
        "revision": document.get("revision"),
        "status": document.get("status"),
        "stage": document.get("stage"),
        "active_plan_revision": document.get("active_plan_revision"),
        "durable_workflow_events": len(store.list_workflow_events(INCIDENT)),
        "document_fingerprint": fingerprint,
    }
    canonical["unchanged"] = (
        canonical["revision"] == 16
        and canonical["status"] == "objective_restored"
        and canonical["stage"] == "RESOLVED"
        and canonical["active_plan_revision"] == 2
        and canonical["durable_workflow_events"] == 28
        and fingerprint == FINGERPRINT
    )
    backend, bff = (
        runtime(args.project, "objective-recovery"),
        runtime(args.project, "reflow-web-bff"),
    )
    identity = subprocess.check_output(
        [shutil.which("gcloud") or "gcloud", "auth", "print-identity-token"], text=True
    ).strip()
    health = requests.get(
        backend["url"] + "/", headers={"Authorization": f"Bearer {identity}"}, timeout=15
    )
    health_payload = health.json()
    secret = "objective-recovery-slack-bot-token"
    versions = cloud("secrets", "versions", "list", secret, "--project", args.project)
    policy = cloud("secrets", "get-iam-policy", secret, "--project", args.project)
    agents = [item.value for item in AgentId] + list(OPERATOR_AGENT_NAMES)
    report = {
        "observed_at": datetime.now(UTC).isoformat(),
        "read_only": True,
        "canonical": canonical,
        "agents": agents,
        "agent_count": len(agents),
        "backend": backend,
        "bff": bff,
        "backend_health": {
            "http_status": health.status_code,
            "status": health_payload.get("status"),
        },
        "slack_setup": {
            "secret_name": secret,
            "version_count": len(versions),
            "bindings": policy.get("bindings", []),
        },
        "backend_slack_environment_names": [
            name for name in backend["environment_names"] if name.startswith("SLACK_")
        ],
        "slack_calls_performed_by_this_audit": 0,
        "cloud_mutations_performed_by_this_audit": 0,
    }
    output = Path(args.output)
    output.parent.mkdir(exist_ok=True, parents=True)
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    if (
        not canonical["unchanged"]
        or len(agents) != 8
        or not backend["ready"]
        or not bff["ready"]
        or health.status_code != 200
        or health_payload.get("status") != "ready"
    ):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
