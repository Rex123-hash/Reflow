"""Construction and authorization boundary for the canonical P1C continuation."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from objective_recovery.domain.actions import derive_idempotency_key
from objective_recovery.domain.models import Action
from objective_recovery_agent.github_contract import GitHubReleaseIntent


class P1CAuthorizationError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class P1CConfiguration:
    repository: str
    candidate_sha: str
    workflow_id: int
    workflow_path: str


def authorize_p1c_intent(
    incident: dict[str, Any], configuration: P1CConfiguration
) -> GitHubReleaseIntent:
    incident_id = str(incident.get("incident_id", ""))
    selected_plan_id = str(incident.get("selected_plan_id", ""))
    if not incident_id or not selected_plan_id:
        raise P1CAuthorizationError("persisted selected plan is required")
    if incident.get("stage") != "VERIFYING":
        raise P1CAuthorizationError("incident must be in VERIFYING")
    if incident.get("action_receipt_status") != "verified":
        raise P1CAuthorizationError("P1B Calendar receipt must already be VERIFIED")
    action_id = "validate-release-v2"
    desired_state = (
        f"{configuration.repository}|{configuration.candidate_sha}|"
        f"{configuration.workflow_id}|{configuration.workflow_path}"
    )
    key = derive_idempotency_key(
        incident_id=incident_id,
        revision=1,
        action_type="github_release_validation",
        target=configuration.repository,
        desired_state=desired_state,
    )
    action = Action(
        action_id=action_id,
        action_type="github_release_validation",
        target=configuration.repository,
        parameters=(
            ("candidate_sha", configuration.candidate_sha),
            ("workflow_id", str(configuration.workflow_id)),
            ("workflow_path", configuration.workflow_path),
        ),
        idempotency_key=key,
    )
    return GitHubReleaseIntent(
        incident_id=incident_id,
        plan_id=selected_plan_id,
        plan_revision=1,
        action=action,
        repository=configuration.repository,
        candidate_sha=configuration.candidate_sha,
        workflow_id=configuration.workflow_id,
        workflow_path=configuration.workflow_path,
    )
