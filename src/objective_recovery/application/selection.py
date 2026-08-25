"""Stable deterministic plan selection."""

from __future__ import annotations

from collections.abc import Iterable

from objective_recovery.domain.errors import NoValidPlanError
from objective_recovery.domain.models import EvaluatedPlan, RecoveryPlan


def select_best_valid_plan(evaluated_plans: Iterable[EvaluatedPlan]) -> RecoveryPlan:
    valid = [item.plan for item in evaluated_plans if item.decision.is_valid]
    if not valid:
        raise NoValidPlanError("all recovery plans failed deterministic validation")
    return min(valid, key=lambda plan: (plan.risk_score, len(plan.actions), plan.plan_id))
