"""Deterministic P1C GitHub release identity and normalized evidence contracts."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from objective_recovery.domain.models import Action

_TAG_SAFE = re.compile(r"[^a-z0-9._-]+")


@dataclass(frozen=True, slots=True)
class GitHubReleaseIntent:
    incident_id: str
    plan_id: str
    plan_revision: int
    action: Action
    repository: str
    candidate_sha: str
    workflow_id: int
    workflow_path: str
    invariant_id: str = "release-validation-green"
    tag_prefix: str = "reflow-p1c"
    tag_override: str | None = None

    @property
    def receipt_id(self) -> str:
        return f"github-{self.action.idempotency_key}"

    @property
    def tag(self) -> str:
        if self.tag_override is not None:
            return self.tag_override
        stem = _TAG_SAFE.sub("-", self.action.idempotency_key.lower()).strip("-._")
        return f"{self.tag_prefix}-{stem[:28]}-{self.candidate_sha[:12]}"

    @property
    def display_title(self) -> str:
        return f"Release V2 validation - {self.tag}"


def intent_fingerprint(intent: GitHubReleaseIntent) -> str:
    payload = {
        "action": {
            "action_id": intent.action.action_id,
            "action_type": intent.action.action_type,
            "idempotency_key": intent.action.idempotency_key,
            "parameters": dict(intent.action.parameters),
            "target": intent.action.target,
        },
        "candidate_sha": intent.candidate_sha,
        "incident_id": intent.incident_id,
        "invariant_id": intent.invariant_id,
        "plan_id": intent.plan_id,
        "plan_revision": intent.plan_revision,
        "repository": intent.repository,
        "tag_prefix": intent.tag_prefix,
        "tag_override": intent.tag_override,
        "workflow_id": intent.workflow_id,
        "workflow_path": intent.workflow_path,
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


@dataclass(frozen=True, slots=True)
class GitHubRelease:
    release_id: int
    tag: str
    target_commitish: str
    url: str
    published_at: datetime
    draft: bool
    prerelease: bool


@dataclass(frozen=True, slots=True)
class GitHubRun:
    run_id: int
    run_number: int
    run_attempt: int
    workflow_id: int
    workflow_path: str
    event: str
    display_title: str
    head_branch: str
    head_sha: str
    status: str
    conclusion: str | None
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None
    url: str


@dataclass(frozen=True, slots=True)
class GitHubJob:
    job_id: int
    name: str
    head_sha: str
    status: str
    conclusion: str | None
    started_at: datetime | None
    completed_at: datetime | None
    url: str
    failing_steps: tuple[str, ...]
    steps: tuple[GitHubStep, ...] = ()


@dataclass(frozen=True, slots=True)
class GitHubStep:
    name: str
    status: str
    conclusion: str | None
    number: int


@dataclass(frozen=True, slots=True)
class GitHubEvidence:
    repository: str
    release: GitHubRelease
    tag_sha: str
    run: GitHubRun
    jobs: tuple[GitHubJob, ...]
    read_back_at: datetime

    def normalized(self) -> dict[str, Any]:
        return {
            "repository": self.repository,
            "release_id": self.release.release_id,
            "release_tag": self.release.tag,
            "release_url": self.release.url,
            "published_at": self.release.published_at.isoformat(),
            "tag_sha": self.tag_sha,
            "workflow_id": self.run.workflow_id,
            "workflow_path": self.run.workflow_path,
            "run_id": self.run.run_id,
            "run_number": self.run.run_number,
            "run_attempt": self.run.run_attempt,
            "event": self.run.event,
            "head_sha": self.run.head_sha,
            "status": self.run.status,
            "conclusion": self.run.conclusion,
            "created_at": self.run.created_at.isoformat(),
            "started_at": self.run.started_at.isoformat() if self.run.started_at else None,
            "completed_at": self.run.completed_at.isoformat() if self.run.completed_at else None,
            "run_url": self.run.url,
            "jobs": [
                {
                    "job_id": job.job_id,
                    "name": job.name,
                    "head_sha": job.head_sha,
                    "status": job.status,
                    "conclusion": job.conclusion,
                    "started_at": job.started_at.isoformat() if job.started_at else None,
                    "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                    "url": job.url,
                    "failing_steps": list(job.failing_steps),
                    "steps": [
                        {
                            "name": step.name,
                            "status": step.status,
                            "conclusion": step.conclusion,
                            "number": step.number,
                        }
                        for step in job.steps
                    ],
                }
                for job in self.jobs
            ],
            "read_back_at": self.read_back_at.isoformat(),
        }
