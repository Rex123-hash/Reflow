from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime, timedelta
from typing import Any, cast

import pytest
import requests
from objective_recovery_agent.github_contract import (
    GitHubJob,
    GitHubRelease,
    GitHubReleaseIntent,
    GitHubRun,
    intent_fingerprint,
)
from objective_recovery_agent.github_execution import (
    GitHubP1CService,
    P1CExecutionError,
    P1CState,
)
from objective_recovery_agent.github_gateway import (
    GitHubAdapterError,
    GitHubErrorCategory,
    RequestsGitHubGateway,
)
from objective_recovery_agent.github_ledger import InMemoryGitHubActionLedger
from objective_recovery_agent.ledger import InMemoryWorkflowLedger
from objective_recovery_agent.p1c import (
    P1CAuthorizationError,
    P1CConfiguration,
    authorize_p1c_intent,
)

from objective_recovery.domain.errors import DuplicateIdempotencyKeyError
from objective_recovery.domain.models import Action, EvidenceKind, ReceiptStatus

NOW = datetime(2026, 8, 27, 8, 30, tzinfo=UTC)
SHA = "5353cf7c664f384d6642b5348c7f190187b06b4c"
PATH = ".github/workflows/release-validation.yml"


def intent(*, sha: str = SHA, workflow_path: str = PATH) -> GitHubReleaseIntent:
    action = Action(
        "validate-release-v2",
        "github_release_validation",
        "Rex123-hash/EXperiments",
        (("candidate_sha", sha),),
        "stable-p1c-key",
    )
    return GitHubReleaseIntent(
        "incident-canonical",
        "plan-resource-balance-first",
        1,
        action,
        "Rex123-hash/EXperiments",
        sha,
        343576501,
        workflow_path,
    )


def release(value: GitHubReleaseIntent) -> GitHubRelease:
    return GitHubRelease(101, value.tag, value.candidate_sha, "https://release", NOW, False, True)


def run(
    value: GitHubReleaseIntent,
    *,
    status: str = "completed",
    conclusion: str | None = "failure",
    path: str | None = None,
    event: str = "release",
    sha: str | None = None,
    title: str | None = None,
    created_at: datetime | None = None,
    completed_at: datetime | None = None,
) -> GitHubRun:
    return GitHubRun(
        202,
        7,
        1,
        value.workflow_id,
        path or value.workflow_path,
        event,
        title or value.display_title,
        value.tag,
        sha or value.candidate_sha,
        status,
        conclusion,
        created_at or NOW + timedelta(seconds=2),
        NOW + timedelta(seconds=3),
        completed_at or NOW + timedelta(seconds=8),
        "https://run",
    )


def job(value: GitHubReleaseIntent) -> GitHubJob:
    return GitHubJob(
        303,
        "release-validation",
        value.candidate_sha,
        "completed",
        "failure",
        NOW + timedelta(seconds=3),
        NOW + timedelta(seconds=8),
        "https://job",
        ("Validate release compatibility",),
    )


class FakeGateway:
    def __init__(self, value: GitHubReleaseIntent) -> None:
        self.release: GitHubRelease | None = None
        self.runs: tuple[GitHubRun, ...] = (run(value),)
        self.pinned = run(value)
        self.jobs = (job(value),)
        self.calls: list[str] = []
        self.create_error: GitHubAdapterError | None = None

    def create_release(self, value: GitHubReleaseIntent) -> GitHubRelease:
        self.calls.append("create_release")
        if self.create_error:
            raise self.create_error
        self.release = release(value)
        return self.release

    def get_release(self, value: GitHubReleaseIntent) -> GitHubRelease | None:
        self.calls.append("get_release")
        return self.release

    def get_tag_sha(self, value: GitHubReleaseIntent) -> str:
        self.calls.append("get_tag_sha")
        return value.candidate_sha

    def list_workflow_runs(self, value: GitHubReleaseIntent) -> tuple[GitHubRun, ...]:
        self.calls.append("list_workflow_runs")
        return self.runs

    def get_run_attempt(self, value: GitHubReleaseIntent, run_id: int, attempt: int) -> GitHubRun:
        self.calls.append(f"get_run_attempt:{run_id}:{attempt}")
        return self.pinned

    def get_jobs(
        self, value: GitHubReleaseIntent, run_id: int, attempt: int
    ) -> tuple[GitHubJob, ...]:
        self.calls.append(f"get_jobs:{run_id}:{attempt}")
        return self.jobs


def service(
    value: GitHubReleaseIntent,
) -> tuple[GitHubP1CService, InMemoryGitHubActionLedger, InMemoryWorkflowLedger, FakeGateway]:
    ledger = InMemoryGitHubActionLedger()
    workflow = InMemoryWorkflowLedger()
    workflow.incidents[value.incident_id] = {
        "incident_id": value.incident_id,
        "stage": "VERIFYING",
        "status": "action_receipt_verified",
        "revision": 0,
    }
    gateway = FakeGateway(value)
    return (
        GitHubP1CService(ledger=ledger, workflow_ledger=workflow, gateway=gateway),
        ledger,
        workflow,
        gateway,
    )


def test_deterministic_release_identity_and_fingerprint() -> None:
    first = intent()
    second = intent()
    assert first.tag == second.tag
    assert SHA[:12] in first.tag
    assert intent_fingerprint(first) == intent_fingerprint(second)


def test_same_key_different_intent_fails_closed() -> None:
    ledger = InMemoryGitHubActionLedger()
    ledger.claim(intent())
    with pytest.raises(DuplicateIdempotencyKeyError):
        ledger.claim(intent(sha="a" * 40))


def test_exact_release_is_adopted_without_duplicate() -> None:
    value = intent()
    runner, _, _, gateway = service(value)
    gateway.release = release(value)
    result = runner.advance(value, now=NOW + timedelta(seconds=9))
    assert result.state is P1CState.VERIFICATION_FAILED
    assert "create_release" not in gateway.calls


def test_conflicting_create_adopts_only_exact_identity() -> None:
    value = intent()
    runner, _, _, gateway = service(value)
    exact = release(value)
    calls = 0

    def get_release(_: GitHubReleaseIntent) -> GitHubRelease | None:
        nonlocal calls
        calls += 1
        return None if calls == 1 else exact

    gateway.get_release = get_release  # type: ignore[assignment]
    gateway.create_error = GitHubAdapterError(
        GitHubErrorCategory.CONFLICT, retryable=False, status_code=422
    )
    assert (
        runner.advance(value, now=NOW + timedelta(seconds=9)).receipt_status
        is ReceiptStatus.VERIFIED
    )


def test_conflicting_create_with_wrong_identity_fails_closed() -> None:
    value = intent()
    runner, _, _, gateway = service(value)
    wrong = replace(release(value), target_commitish="b" * 40)
    calls = 0

    def get_release(_: GitHubReleaseIntent) -> GitHubRelease | None:
        nonlocal calls
        calls += 1
        return None if calls == 1 else wrong

    gateway.get_release = get_release  # type: ignore[assignment]
    gateway.create_error = GitHubAdapterError(
        GitHubErrorCategory.CONFLICT, retryable=False, status_code=422
    )
    with pytest.raises(P1CExecutionError, match="release_identity_mismatch"):
        runner.advance(value, now=NOW + timedelta(seconds=9))


@pytest.mark.parametrize(
    ("changed", "expected_state"),
    [
        ({"path": "wrong.yml"}, P1CState.WAITING_FOR_RUN),
        ({"event": "push"}, P1CState.WAITING_FOR_RUN),
        ({"sha": "c" * 40}, P1CState.WAITING_FOR_RUN),
        ({"title": "wrong release"}, P1CState.WAITING_FOR_RUN),
    ],
)
def test_wrong_correlation_predicates_are_rejected(
    changed: dict[str, Any], expected_state: P1CState
) -> None:
    value = intent()
    runner, _, _, gateway = service(value)
    gateway.runs = (run(value, **changed),)
    assert runner.advance(value, now=NOW + timedelta(seconds=9)).state is expected_state


def test_zero_candidates_retries_and_multiple_candidates_fail_closed() -> None:
    value = intent()
    runner, _, _, gateway = service(value)
    gateway.runs = ()
    assert runner.advance(value, now=NOW + timedelta(seconds=9)).state is P1CState.WAITING_FOR_RUN
    gateway.runs = (run(value), run(value))
    with pytest.raises(P1CExecutionError, match="correlation_ambiguous"):
        runner.advance(value, now=NOW + timedelta(seconds=10))


@pytest.mark.parametrize("status", ["queued", "in_progress"])
def test_nonterminal_run_resumes_from_pinned_attempt(status: str) -> None:
    value = intent()
    runner, ledger, _, gateway = service(value)
    gateway.pinned = run(value, status=status, conclusion=None)
    first = runner.advance(value, now=NOW + timedelta(seconds=5))
    assert first.state is P1CState.WAITING_FOR_COMPLETION
    assert ledger.load(value).progress["run_id"] == 202
    gateway.runs = ()
    gateway.pinned = run(value)
    second = runner.advance(value, now=NOW + timedelta(seconds=9))
    assert second.state is P1CState.VERIFICATION_FAILED
    assert gateway.calls.count("list_workflow_runs") == 1


def test_failure_verifies_action_but_fails_objective() -> None:
    value = intent()
    runner, ledger, workflow, gateway = service(value)
    result = runner.advance(value, now=NOW + timedelta(seconds=9))
    assert result.state is P1CState.VERIFICATION_FAILED
    assert result.receipt_status is ReceiptStatus.VERIFIED
    assert result.verification is not None and not result.verification.passed
    assert ledger.load(value).receipt.evidence_kind is EvidenceKind.EXTERNAL
    incident = workflow.incidents[value.incident_id]
    assert incident["stage"] == "VERIFICATION_FAILED"
    assert incident["status"] == "recovery_incomplete"
    assert gateway.calls[-4:] == [
        "get_release",
        "get_tag_sha",
        "get_run_attempt:202:1",
        "get_jobs:202:1",
    ]


def test_failure_preserves_fresh_incident_objective_identity() -> None:
    value = intent()
    runner, _, workflow, _ = service(value)
    workflow.incidents[value.incident_id].update(
        {"objective_id": "release-qualification-fresh", "objective_version": 1}
    )

    result = runner.advance(value, now=NOW + timedelta(seconds=9))

    assert result.verification is not None
    assert result.verification.objective_id == "release-qualification-fresh"
    assert workflow.incidents[value.incident_id]["objective_id"] == ("release-qualification-fresh")


def test_exact_terminal_replay_has_no_mutation_or_revision_churn() -> None:
    value = intent()
    runner, _, workflow, gateway = service(value)
    first = runner.advance(value, now=NOW + timedelta(seconds=9))
    calls = list(gateway.calls)
    revision = workflow.incidents[value.incident_id]["revision"]
    second = runner.advance(value, now=NOW + timedelta(seconds=20))
    assert second == replace(first, verification=None)
    assert gateway.calls == calls
    assert workflow.incidents[value.incident_id]["revision"] == revision


def test_success_does_not_resolve_or_replan() -> None:
    value = intent()
    runner, ledger, workflow, gateway = service(value)
    gateway.pinned = run(value, conclusion="success")
    gateway.jobs = (replace(job(value), conclusion="success", failing_steps=()),)
    result = runner.advance(value, now=NOW + timedelta(seconds=9))
    assert result.state is P1CState.CI_PASSED
    assert ledger.load(value).receipt.status is ReceiptStatus.VERIFIED
    assert workflow.incidents[value.incident_id]["stage"] == "VERIFYING"


@pytest.mark.parametrize("conclusion", ["cancelled", "skipped", "neutral", None])
def test_inconclusive_conclusions_do_not_become_objective_failure(
    conclusion: str | None,
) -> None:
    value = intent()
    runner, ledger, workflow, gateway = service(value)
    gateway.pinned = run(value, conclusion=conclusion)
    with pytest.raises(P1CExecutionError, match="inconclusive_run_conclusion"):
        runner.advance(value, now=NOW + timedelta(seconds=9))
    assert ledger.load(value).receipt.status is ReceiptStatus.WRITE_ACKNOWLEDGED
    assert workflow.incidents[value.incident_id]["stage"] == "VERIFYING"


def test_stale_evidence_and_visibility_timeout_are_infrastructure_failures() -> None:
    value = intent()
    runner, ledger, workflow, gateway = service(value)
    gateway.pinned = run(value, completed_at=NOW - timedelta(hours=1))
    with pytest.raises(P1CExecutionError, match="stale_evidence"):
        runner.advance(value, now=NOW + timedelta(seconds=9))
    assert ledger.load(value).receipt.status is ReceiptStatus.WRITE_ACKNOWLEDGED
    assert workflow.incidents[value.incident_id]["stage"] == "VERIFYING"


def test_authorization_requires_verified_p1b_checkpoint() -> None:
    config = P1CConfiguration("Rex123-hash/EXperiments", SHA, 343576501, PATH)
    valid = {
        "incident_id": "incident-canonical",
        "selected_plan_id": "plan-one",
        "stage": "VERIFYING",
        "action_receipt_status": "verified",
    }
    assert authorize_p1c_intent(valid, config).repository == config.repository
    completed = {
        **valid,
        "stage": "VERIFICATION_FAILED",
        "status": "recovery_incomplete",
    }
    assert authorize_p1c_intent(completed, config).repository == config.repository
    with pytest.raises(P1CAuthorizationError):
        authorize_p1c_intent({**valid, "stage": "PLAN_SELECTED"}, config)
    with pytest.raises(P1CAuthorizationError):
        authorize_p1c_intent({**valid, "action_receipt_status": "failed"}, config)
    with pytest.raises(P1CAuthorizationError):
        authorize_p1c_intent(
            {**completed, "status": "resolved"},
            config,
        )


class FakeResponse:
    def __init__(
        self,
        status_code: int,
        data: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        self.status_code = status_code
        self._data = data or {}
        self.headers = headers or {}

    def json(self) -> dict[str, Any]:
        return self._data


class FakeSession:
    def __init__(self, outcomes: list[FakeResponse | Exception]) -> None:
        self.outcomes = outcomes
        self.calls = 0

    def request(self, *_: Any, **__: Any) -> FakeResponse:
        outcome = self.outcomes[self.calls]
        self.calls += 1
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


@pytest.mark.parametrize("status", [429, 502, 503, 504])
def test_gateway_retries_transient_http_failures(status: int) -> None:
    session = FakeSession([FakeResponse(status, headers={"Retry-After": "0"})] * 4)
    gateway = RequestsGitHubGateway(
        "secret", session=cast(requests.Session, session), sleep=lambda _: None
    )
    with pytest.raises(GitHubAdapterError) as captured:
        gateway.get_release(intent())
    assert captured.value.retryable
    assert session.calls == 4


def test_gateway_retries_transport_timeout() -> None:
    session = FakeSession([requests.Timeout()] * 4)
    gateway = RequestsGitHubGateway(
        "secret", session=cast(requests.Session, session), sleep=lambda _: None
    )
    with pytest.raises(GitHubAdapterError) as captured:
        gateway.get_release(intent())
    assert captured.value.category is GitHubErrorCategory.TRANSPORT
    assert captured.value.retryable


def test_gateway_404_is_absent_and_422_is_conflict() -> None:
    absent = RequestsGitHubGateway(
        "secret",
        session=cast(requests.Session, FakeSession([FakeResponse(404)])),
        sleep=lambda _: None,
    )
    assert absent.get_release(intent()) is None
    conflict = RequestsGitHubGateway(
        "secret",
        session=cast(requests.Session, FakeSession([FakeResponse(422)])),
        sleep=lambda _: None,
    )
    with pytest.raises(GitHubAdapterError) as captured:
        conflict.create_release(intent())
    assert captured.value.category is GitHubErrorCategory.CONFLICT
