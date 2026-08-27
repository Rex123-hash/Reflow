"""Bounded, resumable P1C execution and deterministic objective verification."""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import UTC, datetime
from enum import StrEnum

from objective_recovery.domain.models import (
    EvidenceKind,
    IncidentStatus,
    InvariantObservation,
    ObjectiveInvariant,
    ReceiptStatus,
    VerificationResult,
)
from objective_recovery.domain.state_machine import Incident
from objective_recovery.domain.verification import DeterministicObjectiveVerifier
from objective_recovery_agent.github_contract import (
    GitHubEvidence,
    GitHubRelease,
    GitHubReleaseIntent,
    GitHubRun,
)
from objective_recovery_agent.github_gateway import (
    GitHubAdapterError,
    GitHubErrorCategory,
    GitHubGateway,
)
from objective_recovery_agent.github_ledger import GitHubActionLedger
from objective_recovery_agent.ledger import WorkflowLedger
from objective_recovery_agent.schemas import IncidentStage, WorkflowEventType


class P1CState(StrEnum):
    WAITING_FOR_RUN = "waiting_for_run"
    WAITING_FOR_COMPLETION = "waiting_for_completion"
    VERIFICATION_FAILED = "verification_failed"
    CI_PASSED = "ci_passed"


class P1CExecutionError(RuntimeError):
    def __init__(self, category: str, *, retryable: bool) -> None:
        super().__init__(category)
        self.category = category
        self.retryable = retryable


@dataclass(frozen=True, slots=True)
class P1CResult:
    state: P1CState
    receipt_status: ReceiptStatus
    run_id: int | None = None
    run_attempt: int | None = None
    verification: VerificationResult | None = None


class GitHubP1CService:
    def __init__(
        self,
        *,
        ledger: GitHubActionLedger,
        workflow_ledger: WorkflowLedger,
        gateway: GitHubGateway,
        evidence_max_age_seconds: int = 900,
    ) -> None:
        self._ledger = ledger
        self._workflow = workflow_ledger
        self._gateway = gateway
        self._max_age = evidence_max_age_seconds

    @staticmethod
    def _validate_release(intent: GitHubReleaseIntent, release: GitHubRelease) -> None:
        if (
            release.tag != intent.tag
            or release.target_commitish != intent.candidate_sha
            or release.draft
            or not release.prerelease
        ):
            raise P1CExecutionError("release_identity_mismatch", retryable=False)

    @staticmethod
    def _matches(intent: GitHubReleaseIntent, release: GitHubRelease, run: GitHubRun) -> bool:
        return (
            run.workflow_id == intent.workflow_id
            and run.workflow_path == intent.workflow_path
            and run.event == "release"
            and run.head_sha == intent.candidate_sha
            and run.head_branch == intent.tag
            and run.display_title == intent.display_title
            and run.created_at >= release.published_at
        )

    def _create_or_adopt(self, intent: GitHubReleaseIntent) -> GitHubRelease:
        existing = self._gateway.get_release(intent)
        if existing is not None:
            self._validate_release(intent, existing)
            return existing
        try:
            created = self._gateway.create_release(intent)
        except GitHubAdapterError as error:
            if error.category is not GitHubErrorCategory.CONFLICT:
                raise
            adopted = self._gateway.get_release(intent)
            if adopted is None:
                raise P1CExecutionError(
                    "release_conflict_without_match", retryable=False
                ) from error
            self._validate_release(intent, adopted)
            return adopted
        self._validate_release(intent, created)
        return created

    def _authoritative_readback(
        self,
        intent: GitHubReleaseIntent,
        *,
        run_id: int,
        run_attempt: int,
        now: datetime,
    ) -> GitHubEvidence:
        release = self._gateway.get_release(intent)
        if release is None:
            raise P1CExecutionError("release_readback_missing", retryable=True)
        self._validate_release(intent, release)
        tag_sha = self._gateway.get_tag_sha(intent)
        run = self._gateway.get_run_attempt(intent, run_id, run_attempt)
        jobs = self._gateway.get_jobs(intent, run_id, run_attempt)
        if tag_sha != intent.candidate_sha:
            raise P1CExecutionError("tag_sha_mismatch", retryable=False)
        if not self._matches(intent, release, run):
            raise P1CExecutionError("pinned_run_provenance_mismatch", retryable=False)
        if run.run_id != run_id or run.run_attempt != run_attempt:
            raise P1CExecutionError("pinned_run_attempt_mismatch", retryable=False)
        if not jobs or any(job.head_sha != intent.candidate_sha for job in jobs):
            raise P1CExecutionError("jobs_provenance_mismatch", retryable=False)
        if run.completed_at is None:
            raise P1CExecutionError("completed_run_missing_timestamp", retryable=False)
        age = (now - run.completed_at).total_seconds()
        if age < 0 or age > self._max_age:
            raise P1CExecutionError("stale_evidence", retryable=False)
        return GitHubEvidence(intent.repository, release, tag_sha, run, jobs, now)

    def advance(self, intent: GitHubReleaseIntent, *, now: datetime | None = None) -> P1CResult:
        observed_at = (now or datetime.now(UTC)).astimezone(UTC)
        claim = self._ledger.claim(intent)
        progress = dict(claim.progress)
        receipt = claim.receipt
        if receipt.status is ReceiptStatus.VERIFIED and progress.get("terminal_state"):
            return P1CResult(
                P1CState(str(progress["terminal_state"])),
                receipt.status,
                int(progress["run_id"]),
                int(progress["run_attempt"]),
            )

        if "release_id" not in progress:
            try:
                release = self._create_or_adopt(intent)
            except GitHubAdapterError as error:
                raise P1CExecutionError(error.category.value, retryable=error.retryable) from error
            progress.update(
                {
                    "release_id": release.release_id,
                    "release_tag": release.tag,
                    "release_url": release.url,
                    "published_at": release.published_at.isoformat(),
                }
            )
            self._ledger.save_progress(intent, progress)
            if receipt.status is ReceiptStatus.PENDING:
                receipt = replace(
                    receipt,
                    status=ReceiptStatus.WRITE_ACKNOWLEDGED,
                    evidence_kind=EvidenceKind.EXTERNAL,
                    external_reference=release.url,
                    write_acknowledged_at=observed_at,
                    observed_at=observed_at,
                )
                self._ledger.record_receipt(receipt)
            self._workflow.record_event(
                intent.incident_id,
                WorkflowEventType.GITHUB_RELEASE_ACKNOWLEDGED,
                intent.tag,
                {"release_id": release.release_id, "tag": release.tag},
            )
        else:
            release = GitHubRelease(
                int(progress["release_id"]),
                str(progress["release_tag"]),
                intent.candidate_sha,
                str(progress["release_url"]),
                datetime.fromisoformat(str(progress["published_at"])),
                False,
                True,
            )

        if "run_id" not in progress:
            try:
                candidates = tuple(
                    run
                    for run in self._gateway.list_workflow_runs(intent)
                    if self._matches(intent, release, run)
                )
            except GitHubAdapterError as error:
                raise P1CExecutionError(error.category.value, retryable=error.retryable) from error
            if not candidates:
                if (observed_at - release.published_at).total_seconds() > self._max_age:
                    raise P1CExecutionError("workflow_visibility_timeout", retryable=False)
                return P1CResult(P1CState.WAITING_FOR_RUN, receipt.status)
            if len(candidates) != 1:
                progress["correlation_error"] = "multiple_exact_candidates"
                self._ledger.save_progress(intent, progress)
                raise P1CExecutionError("correlation_ambiguous", retryable=False)
            pinned = candidates[0]
            progress.update({"run_id": pinned.run_id, "run_attempt": pinned.run_attempt})
            self._ledger.save_progress(intent, progress)
            self._workflow.record_event(
                intent.incident_id,
                WorkflowEventType.GITHUB_RUN_PINNED,
                f"{pinned.run_id}:{pinned.run_attempt}",
                {"run_id": pinned.run_id, "run_attempt": pinned.run_attempt},
            )

        run_id = int(progress["run_id"])
        run_attempt = int(progress["run_attempt"])
        try:
            pinned_run = self._gateway.get_run_attempt(intent, run_id, run_attempt)
        except GitHubAdapterError as error:
            raise P1CExecutionError(error.category.value, retryable=error.retryable) from error
        if pinned_run.status in {"queued", "in_progress", "waiting", "pending", "requested"}:
            return P1CResult(P1CState.WAITING_FOR_COMPLETION, receipt.status, run_id, run_attempt)
        if pinned_run.status != "completed":
            raise P1CExecutionError("malformed_run_status", retryable=False)
        if pinned_run.conclusion not in {"success", "failure"}:
            raise P1CExecutionError("inconclusive_run_conclusion", retryable=False)

        evidence = self._authoritative_readback(
            intent,
            run_id=run_id,
            run_attempt=run_attempt,
            now=observed_at,
        )
        progress["evidence"] = evidence.normalized()
        self._ledger.save_progress(intent, progress)
        if receipt.status is ReceiptStatus.WRITE_ACKNOWLEDGED:
            receipt = replace(
                receipt,
                status=ReceiptStatus.VERIFIED,
                evidence_kind=EvidenceKind.EXTERNAL,
                external_reference=evidence.run.url,
                read_back_at=observed_at,
                observed_at=observed_at,
            )
            self._ledger.record_receipt(receipt)

        if evidence.run.conclusion == "success":
            progress["terminal_state"] = P1CState.CI_PASSED.value
            self._ledger.save_progress(intent, progress)
            return P1CResult(P1CState.CI_PASSED, receipt.status, run_id, run_attempt)

        observation = InvariantObservation(
            invariant_id=intent.invariant_id,
            passed=False,
            evidence_kind=EvidenceKind.EXTERNAL,
            observed_at=observed_at,
            source_reference=evidence.run.url,
        )
        verification = DeterministicObjectiveVerifier().verify(
            objective_id="release-v2",
            invariants=(
                ObjectiveInvariant(
                    intent.invariant_id,
                    "The release validation workflow must complete successfully.",
                    self._max_age,
                ),
            ),
            observations={intent.invariant_id: observation},
            now=observed_at,
        )
        incident = Incident(
            incident_id=intent.incident_id,
            objective_id="release-v2",
            status=IncidentStatus.VERIFYING,
            history=[IncidentStatus.VERIFYING],
        )
        incident.apply_verification(verification)
        if incident.status is not IncidentStatus.VERIFICATION_FAILED:
            raise AssertionError("P1C failure must use the legal verification transition")
        progress["terminal_state"] = P1CState.VERIFICATION_FAILED.value
        progress["verification"] = {
            "objective_id": verification.objective_id,
            "passed": verification.passed,
            "observed_at": verification.observed_at.isoformat(),
            "checks": [
                {
                    "invariant_id": check.invariant_id,
                    "passed": check.passed,
                    "reason": check.reason,
                    "evidence_kind": check.evidence_kind.value,
                    "source_reference": check.source_reference,
                }
                for check in verification.checks
            ],
        }
        self._ledger.save_progress(intent, progress)
        self._workflow.save_checkpoint(
            intent.incident_id,
            IncidentStage.VERIFICATION_FAILED,
            {
                "status": "recovery_incomplete",
                "github_action_receipt_id": receipt.receipt_id,
                "github_action_receipt_status": receipt.status.value,
                "github_verification": progress["verification"],
                "github_evidence": progress["evidence"],
            },
        )
        self._workflow.record_event(
            intent.incident_id,
            WorkflowEventType.OBJECTIVE_VERIFICATION_FAILED,
            intent.invariant_id,
            {"invariant_id": intent.invariant_id, "passed": False},
        )
        return P1CResult(
            P1CState.VERIFICATION_FAILED,
            receipt.status,
            run_id,
            run_attempt,
            verification,
        )
