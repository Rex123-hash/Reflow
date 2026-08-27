from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime
from typing import Any, cast

import pytest
from objective_recovery_agent.github_contract import GitHubRelease, GitHubReleaseIntent
from objective_recovery_agent.github_execution import GitHubP1DPromotionService
from objective_recovery_agent.github_ledger import InMemoryGitHubActionLedger
from objective_recovery_agent.p1d import (
    P1DConfiguration,
    P1DService,
    P1DState,
    evaluate_replan_candidates,
)
from objective_recovery_agent.p1d_store import InMemoryP1DStore
from objective_recovery_agent.schemas import (
    ActionParameter,
    CandidateSet,
    CritiqueBundle,
    CritiqueGeneration,
    FailedRecoveryEffect,
    ObjectiveRecord,
    P1DContinuation,
    PlanCritique,
    PlanRisk,
    ProposedAction,
    RecoveryArtifact,
    RecoveryPlanCandidate,
    ReplanningInput,
    StrategyType,
)

from objective_recovery.application.selection import select_best_valid_plan
from objective_recovery.domain.errors import NoValidPlanError
from objective_recovery.domain.models import Action, ReceiptStatus
from objective_recovery.domain.policy import recovery_effect_fingerprint

A = "5353cf7c664f384d6642b5348c7f190187b06b4c"
B = "7b7881ed1785cc37e038c44193ff2373badf54e7"
C = "c" * 40
REPOSITORY = "Rex123-hash/EXperiments"
PATH = ".github/workflows/release-validation.yml"
CONFIG = P1DConfiguration(REPOSITORY, 343576501, PATH)
NOW = datetime(2026, 8, 27, 12, tzinfo=UTC)


def artifact(sha: str, *, state: str = "AVAILABLE") -> RecoveryArtifact:
    return RecoveryArtifact(
        artifact_id=f"artifact-{sha[:8]}",
        artifact_type="github_commit",
        repository=REPOSITORY,
        candidate_sha=sha,
        parent_sha=A,
        state=state,
        production_diff="production change",
        unchanged_proof={"test": "same", "workflow": "same"},
    )


def candidate(
    plan_id: str,
    sha: str,
    *,
    workflow_id: str = "343576501",
    strategy: StrategyType = StrategyType.RISK_MINIMIZATION_FIRST,
) -> RecoveryPlanCandidate:
    return RecoveryPlanCandidate(
        plan_id=plan_id,
        strategy_type=strategy,
        actions=[
            ProposedAction(
                action_id=f"model-{plan_id}",
                action_type="github_release_validation",
                target=REPOSITORY,
                parameters=[
                    ActionParameter(key="candidate_sha", value=sha),
                    ActionParameter(key="workflow_id", value=workflow_id),
                    ActionParameter(key="workflow_path", value=PATH),
                    ActionParameter(key="invariant_id", value="release-validation-green"),
                ],
            )
        ],
        assignments=[],
        deadline_changes=[],
        assumptions=[],
        unknowns=[],
        expected_objective_effect="Validate an immutable revised release candidate.",
        risks=[PlanRisk(risk_id="risk", summary="External CI can fail.", severity=2)],
        required_evidence=["Exact release, tag, run, jobs, and successful step."],
        initial_risk_score=50,
    )


def context(artifacts: list[RecoveryArtifact]) -> ReplanningInput:
    failed = recovery_effect_fingerprint(
        action_type="github_release_validation",
        repository=REPOSITORY,
        candidate_sha=A,
        workflow_id="343576501",
        workflow_path=PATH,
    )
    return ReplanningInput(
        incident_id="incident-p1d-canonical",
        plan_revision=2,
        objective=ObjectiveRecord(
            objective_id="release-v2",
            label="SHIP RELEASE V2",
            deadline_local="2026-08-28 17:00:00",
            deadline_timezone="Etc/UTC",
            deadline_at_utc="2026-08-28T17:00:00Z",
            objective_version=1,
            protected_commitment=True,
        ),
        objective_invariants=["release-validation-green"],
        objective_graph={},
        resources=[],
        allowed_work_item_ids=[],
        allowed_commitment_ids=[],
        previous_selected_plan={},
        previous_plan_assumptions=[],
        previous_plan_unknowns=[],
        previous_critic_findings=[],
        previous_policy_result=[],
        calendar_action_claim={},
        calendar_receipt={},
        github_action_claim={},
        github_receipt={},
        failed_candidate_sha=A,
        failed_release={"release_id": 1},
        failed_run={"run_id": 2},
        failed_jobs=[],
        failed_invariant_id="release-validation-green",
        verification_timestamps=[NOW.isoformat()],
        exact_external_evidence={},
        failed_recovery_effects=[
            FailedRecoveryEffect(
                action_type="github_release_validation",
                repository=REPOSITORY,
                candidate_sha=A,
                workflow_id=343576501,
                workflow_path=PATH,
                failed_invariant_id="release-validation-green",
                fingerprint=failed,
            )
        ],
        available_recovery_artifacts=artifacts,
        recovery_one_accomplished=["action verified"],
        remaining_broken=["objective unhealthy"],
        unhealthy_reason="CI failed",
        policy_summary=["fail closed"],
    )


def critiques(plans: list[RecoveryPlanCandidate], scores: dict[str, int]) -> CritiqueGeneration:
    return CritiqueGeneration(
        critiques=CritiqueBundle(
            critiques=[
                PlanCritique(
                    plan_id=plan.plan_id,
                    verdict_summary="typed critique",
                    additional_risks=[],
                    contradictions=[],
                    missing_evidence=[],
                    adjusted_risk_score=scores[plan.plan_id],
                )
                for plan in plans
            ]
        ),
        critic_latency_ms=1,
    )


def evaluated(
    plans: list[RecoveryPlanCandidate],
    artifacts: list[RecoveryArtifact],
    scores: dict[str, int],
) -> tuple[list[Any], list[dict[str, Any]]]:
    return evaluate_replan_candidates(
        incident_id="incident-p1d-canonical",
        candidates=CandidateSet(plans=plans),
        critiques=critiques(plans, scores),
        replanning_input=context(artifacts),
        configuration=CONFIG,
    )


def test_available_b_is_not_hard_selected_when_c_has_better_score() -> None:
    plans = [candidate("plan-b", B), candidate("plan-c", C)]
    values, _ = evaluated(plans, [artifact(B), artifact(C)], {"plan-b": 30, "plan-c": 10})
    assert select_best_valid_plan(values).plan_id == "plan-c"


def test_available_b_is_rejected_when_it_violates_hard_policy() -> None:
    invalid_b = candidate("plan-b", B, workflow_id="999")
    values, decisions = evaluated([invalid_b], [artifact(B)], {"plan-b": 1})
    assert not values[0].decision.is_valid
    assert any("workflow ID" in item["message"] for item in decisions[0]["violations"])
    with pytest.raises(NoValidPlanError):
        select_best_valid_plan(values)


def test_lower_risk_a_is_rejected_as_exact_failed_repeat() -> None:
    plans = [candidate("plan-a", A), candidate("plan-b", B)]
    values, decisions = evaluated(plans, [artifact(A), artifact(B)], {"plan-a": 1, "plan-b": 20})
    assert select_best_valid_plan(values).plan_id == "plan-b"
    a_decision = next(item for item in decisions if item["plan_id"] == "plan-a")
    assert any(
        item["rule_id"] == "failed_recovery_exact_repeat"
        and "release-validation-green" in item["message"]
        for item in a_decision["violations"]
    )


def test_no_valid_b_future_does_not_inject_b_or_authorize_mutation() -> None:
    plans = [candidate("repeat-a", A)]
    values, _ = evaluated(plans, [artifact(B)], {"repeat-a": 1})
    with pytest.raises(NoValidPlanError):
        select_best_valid_plan(values)
    assert {dict(item.plan.actions[0].parameters)["candidate_sha"] for item in values} == {A}


def test_two_valid_b_plans_use_normal_stable_tie_break() -> None:
    plans = [candidate("z-plan", B), candidate("a-plan", B)]
    values, _ = evaluated(plans, [artifact(B)], {"z-plan": 10, "a-plan": 10})
    assert select_best_valid_plan(values).plan_id == "a-plan"


def test_assignment_proposal_actions_are_retained_but_not_executable() -> None:
    plan = candidate("plan-b", B)
    plan.actions.append(
        ProposedAction(
            action_id="proposal-assign-backend",
            action_type="reassign_task",
            target="work-api-migration",
            parameters=[
                ActionParameter(key="person_id", value="person-backend-lead"),
                ActionParameter(key="proposal_only", value="true"),
            ],
        )
    )
    values, decisions = evaluated([plan], [artifact(B)], {"plan-b": 10})
    selected = select_best_valid_plan(values)
    assert decisions[0]["is_valid"] is True
    assert [action.action_type for action in selected.actions] == [
        "github_release_validation",
        "reassign_task",
    ]
    assert (
        sum(action.action_type == "github_release_validation" for action in selected.actions) == 1
    )


def promotion_intent() -> GitHubReleaseIntent:
    action = Action(
        "promote",
        "github_release_promotion",
        REPOSITORY,
        (("candidate_sha", B), ("make_latest", "true"), ("release_id", "101")),
        "promotion-key",
    )
    return GitHubReleaseIntent(
        "incident-p1d-canonical",
        "plan-b",
        2,
        action,
        REPOSITORY,
        B,
        343576501,
        PATH,
        tag_prefix="reflow-p1d",
        tag_override="reflow-p1d-validation-b",
    )


class PromotionGateway:
    def __init__(self, value: GitHubReleaseIntent, *, already_full: bool = False) -> None:
        self.value = value
        self.release = GitHubRelease(
            101, value.tag, B, "https://release", NOW, False, not already_full
        )
        self.calls: list[str] = []

    def create_release(self, value: GitHubReleaseIntent) -> GitHubRelease:
        raise AssertionError(value)

    def get_release(self, value: GitHubReleaseIntent) -> GitHubRelease | None:
        self.calls.append("get_release")
        return self.release

    def get_release_by_id(self, value: GitHubReleaseIntent, release_id: int) -> GitHubRelease:
        self.calls.append("get_release_by_id")
        return self.release

    def get_latest_release(self, value: GitHubReleaseIntent) -> GitHubRelease:
        self.calls.append("get_latest_release")
        return self.release

    def promote_release(self, value: GitHubReleaseIntent, release_id: int) -> GitHubRelease:
        self.calls.append("promote_release")
        self.release = replace(self.release, prerelease=False)
        return self.release

    def get_tag_sha(self, value: GitHubReleaseIntent) -> str:
        self.calls.append("get_tag_sha")
        return B

    def list_workflow_runs(self, value: GitHubReleaseIntent) -> tuple[()]:
        raise AssertionError(value)

    def get_run_attempt(self, value: GitHubReleaseIntent, run_id: int, attempt: int) -> Any:
        raise AssertionError(value)

    def get_jobs(self, value: GitHubReleaseIntent, run_id: int, attempt: int) -> tuple[()]:
        raise AssertionError(value)


def test_promotion_is_separately_receipted_and_replay_has_zero_github_calls() -> None:
    intent = promotion_intent()
    ledger = InMemoryGitHubActionLedger()
    gateway = PromotionGateway(intent)
    service = GitHubP1DPromotionService(
        ledger=ledger,
        gateway=cast(Any, gateway),
    )
    first = service.advance(intent, release_id=101, now=NOW)
    assert first.receipt_status is ReceiptStatus.VERIFIED
    assert first.evidence["latest_release_id"] == 101
    assert gateway.calls.count("promote_release") == 1
    calls = list(gateway.calls)
    second = service.advance(intent, release_id=101, now=NOW)
    assert second == first
    assert gateway.calls == calls


def test_promotion_retry_adopts_already_full_release_without_second_patch() -> None:
    intent = promotion_intent()
    gateway = PromotionGateway(intent, already_full=True)
    service = GitHubP1DPromotionService(
        ledger=InMemoryGitHubActionLedger(),
        gateway=cast(Any, gateway),
    )
    assert service.advance(intent, release_id=101, now=NOW).receipt_status is ReceiptStatus.VERIFIED
    assert "promote_release" not in gateway.calls


@pytest.mark.asyncio
async def test_post_resolved_handoff_is_exact_noop_before_all_dependencies() -> None:
    store = InMemoryP1DStore()
    store.incidents["incident-p1d-canonical"] = {
        "incident_id": "incident-p1d-canonical",
        "stage": "RESOLVED",
        "status": "objective_restored",
        "revision": 50,
    }

    class Forbidden:
        def __getattr__(self, name: str) -> Any:
            raise AssertionError(f"post-resolved dependency called: {name}")

    service = P1DService(
        store=store,
        workflow=cast(Any, Forbidden()),
        objective_store=cast(Any, Forbidden()),
        planner=cast(Any, Forbidden()),
        github_validation=cast(Any, Forbidden()),
        github_promotion=cast(Any, Forbidden()),
        github_ledger=cast(Any, Forbidden()),
        calendar=cast(Any, Forbidden()),
        configuration=CONFIG,
    )
    result = await service.advance(
        P1DContinuation(
            handoff_id="a" * 64,
            incident_id="incident-p1d-canonical",
            failed_verification_fingerprint="b" * 64,
            source_revision=44,
            event_type="OBJECTIVE_RECOVERY_NEEDED",
        )
    )
    assert result.state is P1DState.RESOLVED
    assert store.incidents["incident-p1d-canonical"]["revision"] == 50
