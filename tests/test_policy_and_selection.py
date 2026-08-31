from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from objective_recovery_agent.world import build_policy_engine

from objective_recovery.application.selection import select_best_valid_plan
from objective_recovery.domain.errors import NoValidPlanError
from objective_recovery.domain.models import (
    Action,
    Assignment,
    AssumptionStatus,
    DeadlineChange,
    EvaluatedPlan,
    PlanAssumption,
    PolicyDecision,
    RecoveryPlan,
)
from objective_recovery.domain.policy import (
    MaxWorkloadPolicy,
    PolicyEngine,
    ProtectedDeadlinePolicy,
    RequiredSkillsPolicy,
)

NOW = datetime(2026, 8, 25, 12, tzinfo=UTC)


def action(action_id: str) -> Action:
    return Action(action_id, "calendar.update", "event:1", (), f"key:{action_id}")


def plan(
    plan_id: str,
    *,
    risk: str = "1",
    actions: tuple[Action, ...] = (),
    assignments: tuple[Assignment, ...] = (),
    assumptions: tuple[PlanAssumption, ...] = (),
    deadlines: tuple[DeadlineChange, ...] = (),
) -> RecoveryPlan:
    return RecoveryPlan(
        plan_id=plan_id,
        strategy=plan_id,
        risk_score=Decimal(risk),
        actions=actions,
        assignments=assignments,
        assumptions=assumptions,
        deadline_changes=deadlines,
    )


def test_hard_policies_reject_workload_skill_and_protected_deadline() -> None:
    candidate = plan(
        "unsafe",
        assignments=(
            Assignment("migration", "engineer-a", frozenset({"python", "sql"}), Decimal("124")),
        ),
        deadlines=(DeadlineChange("customer-release", NOW + timedelta(hours=2)),),
    )
    engine = PolicyEngine(
        [
            MaxWorkloadPolicy(),
            RequiredSkillsPolicy({"engineer-a": frozenset({"python"})}),
            ProtectedDeadlinePolicy({"customer-release": NOW}),
        ]
    )

    decision = engine.evaluate(candidate)
    assert not decision.is_valid
    assert [violation.rule_id for violation in decision.violations] == [
        "max_workload",
        "protected_deadline",
        "required_skills",
    ]


def test_blocking_unknown_rejects_but_confirmed_and_nonblocking_unknown_do_not() -> None:
    candidate = plan(
        "unknowns",
        assumptions=(
            PlanAssumption("permission", "Can write calendar", AssumptionStatus.UNKNOWN),
            PlanAssumption(
                "preference",
                "Reviewer preference",
                AssumptionStatus.UNKNOWN,
                blocks_execution=False,
            ),
            PlanAssumption("skill", "Skill confirmed", AssumptionStatus.CONFIRMED),
        ),
    )
    decision = PolicyEngine([]).evaluate(candidate)
    assert decision.blocking_unknowns == ("permission",)
    assert not decision.is_valid


def test_valid_policy_path_allows_missing_unprotected_deadline_mapping() -> None:
    candidate = plan(
        "valid",
        assignments=(Assignment("migration", "engineer-b", frozenset(), Decimal("100")),),
        deadlines=(DeadlineChange("internal-checkpoint", NOW + timedelta(days=1)),),
    )
    decision = PolicyEngine(
        [
            MaxWorkloadPolicy(),
            RequiredSkillsPolicy({}),
            ProtectedDeadlinePolicy({}),
        ]
    ).evaluate(candidate)
    assert decision.is_valid


def test_runtime_policy_uses_fresh_protected_deadline() -> None:
    fresh_deadline = datetime(2026, 9, 1, 18, tzinfo=UTC)
    before_fresh = plan(
        "fresh-deadline",
        deadlines=(DeadlineChange("commit-release", fresh_deadline - timedelta(minutes=1)),),
    )
    after_fresh = plan(
        "late",
        deadlines=(DeadlineChange("commit-release", fresh_deadline + timedelta(minutes=1)),),
    )

    assert build_policy_engine(fresh_deadline).evaluate(before_fresh).is_valid
    assert not build_policy_engine(fresh_deadline).evaluate(after_fresh).is_valid


def test_plan_selection_is_stable_across_input_order() -> None:
    alpha = plan("alpha", risk="2", actions=(action("a1"),))
    beta = plan("beta", risk="1", actions=(action("b1"), action("b2")))
    gamma = plan("gamma", risk="1", actions=(action("g1"),))
    evaluated = [
        EvaluatedPlan(alpha, PolicyDecision("alpha")),
        EvaluatedPlan(beta, PolicyDecision("beta")),
        EvaluatedPlan(gamma, PolicyDecision("gamma")),
    ]

    assert select_best_valid_plan(evaluated).plan_id == "gamma"
    assert select_best_valid_plan(reversed(evaluated)).plan_id == "gamma"


def test_plan_selection_uses_plan_id_as_final_stable_tie_breaker() -> None:
    alpha = plan("alpha", actions=(action("a1"),))
    beta = plan("beta", actions=(action("b1"),))
    assert (
        select_best_valid_plan(
            [
                EvaluatedPlan(beta, PolicyDecision("beta")),
                EvaluatedPlan(alpha, PolicyDecision("alpha")),
            ]
        ).plan_id
        == "alpha"
    )


def test_no_valid_plan_is_explicit() -> None:
    unsafe = plan("unsafe")
    evaluated = EvaluatedPlan(
        unsafe,
        PolicyDecision("unsafe", blocking_unknowns=("permission",)),
    )
    with pytest.raises(NoValidPlanError):
        select_best_valid_plan([evaluated])


def test_policy_decision_must_belong_to_its_plan() -> None:
    with pytest.raises(ValueError, match="does not belong"):
        EvaluatedPlan(plan("alpha"), PolicyDecision("beta"))
