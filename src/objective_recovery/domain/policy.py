"""Hard, deterministic recovery-plan policy gates."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from datetime import datetime
from decimal import Decimal
from typing import Protocol

from objective_recovery.domain.models import (
    AssumptionStatus,
    PolicyDecision,
    PolicyViolation,
    RecoveryPlan,
)


class PlanPolicy(Protocol):
    rule_id: str

    def evaluate(self, plan: RecoveryPlan) -> Iterable[PolicyViolation]: ...


class MaxWorkloadPolicy:
    rule_id = "max_workload"

    def __init__(self, maximum_percent: Decimal = Decimal("100")) -> None:
        self._maximum = maximum_percent

    def evaluate(self, plan: RecoveryPlan) -> Iterable[PolicyViolation]:
        for assignment in plan.assignments:
            if assignment.projected_load_percent > self._maximum:
                yield PolicyViolation(
                    self.rule_id,
                    f"{assignment.person_id} would reach "
                    f"{assignment.projected_load_percent}% workload",
                )


class RequiredSkillsPolicy:
    rule_id = "required_skills"

    def __init__(self, skills_by_person: Mapping[str, frozenset[str]]) -> None:
        self._skills_by_person = skills_by_person

    def evaluate(self, plan: RecoveryPlan) -> Iterable[PolicyViolation]:
        for assignment in plan.assignments:
            available = self._skills_by_person.get(assignment.person_id, frozenset())
            missing = sorted(assignment.required_skills.difference(available))
            if missing:
                yield PolicyViolation(
                    self.rule_id,
                    f"{assignment.person_id} lacks skills: {', '.join(missing)}",
                )


class ProtectedDeadlinePolicy:
    rule_id = "protected_deadline"

    def __init__(self, latest_by_commitment: Mapping[str, datetime]) -> None:
        self._latest_by_commitment = latest_by_commitment

    def evaluate(self, plan: RecoveryPlan) -> Iterable[PolicyViolation]:
        for change in plan.deadline_changes:
            latest = self._latest_by_commitment.get(change.commitment_id)
            if latest is not None and change.proposed_deadline > latest:
                yield PolicyViolation(
                    self.rule_id,
                    f"{change.commitment_id} would move beyond its protected deadline",
                )


class PolicyEngine:
    def __init__(self, policies: Iterable[PlanPolicy]) -> None:
        self._policies = tuple(policies)

    def evaluate(self, plan: RecoveryPlan) -> PolicyDecision:
        violations = sorted(
            (violation for policy in self._policies for violation in policy.evaluate(plan)),
            key=lambda item: (item.rule_id, item.message),
        )
        blocking_unknowns = sorted(
            assumption.assumption_id
            for assumption in plan.assumptions
            if assumption.status is AssumptionStatus.UNKNOWN and assumption.blocks_execution
        )
        return PolicyDecision(plan.plan_id, tuple(violations), tuple(blocking_unknowns))
