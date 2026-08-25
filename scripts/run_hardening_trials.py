"""Run exactly the requested controlled real-Vertex P1A characterization trials."""

from __future__ import annotations

import asyncio
import json
import logging
import statistics
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from objective_recovery_agent.ledger import InMemoryWorkflowLedger
from objective_recovery_agent.orchestrator import RecoveryOrchestrator
from objective_recovery_agent.planning import AdkPlanningService, pairwise_diversity
from objective_recovery_agent.schemas import DisruptionEvent, PlanningRun, StrategyType
from objective_recovery_agent.world import planning_input

TRIAL_COUNT = 3
OUTPUT_PATH = Path("artifacts/p1a-hardening-trials.json")


def _event(trial: int) -> DisruptionEvent:
    return DisruptionEvent(
        event_id=f"p1a-hardening-trial-{trial}",
        event_type="resource-unavailable",
        occurred_at=datetime(2026, 8, 25, 13, 45, tzinfo=UTC).isoformat(),
        source="p1a-hardening-characterization",
        summary="Lead backend engineer is unavailable through the protected release deadline.",
        disrupted_node_ids=["person-backend-lead"],
        evidence_references=["evidence://p1a/hardening/backend-lead-unavailable"],
    )


def _grounding_violations(run: PlanningRun, trial_event: DisruptionEvent) -> list[str]:
    context = planning_input("grounding-check", trial_event)
    allowed_work = set(context.allowed_work_item_ids)
    allowed_people = {resource.person_id for resource in context.resources}
    allowed_commitments = set(context.allowed_commitment_ids)
    allowed_entities = allowed_work | allowed_people | allowed_commitments
    violations: list[str] = []
    for plan in run.candidates.plans:
        for action in plan.actions:
            if action.target not in allowed_work:
                violations.append(f"{plan.plan_id}:action-target:{action.target}")
            for parameter in action.parameters:
                if (
                    parameter.value.startswith(("person-", "work-", "commit-"))
                    and parameter.value not in allowed_entities
                ):
                    violations.append(f"{plan.plan_id}:action-parameter:{parameter.value}")
        for assignment in plan.assignments:
            if assignment.work_item_id not in allowed_work:
                violations.append(f"{plan.plan_id}:work-item:{assignment.work_item_id}")
            if assignment.person_id not in allowed_people:
                violations.append(f"{plan.plan_id}:person:{assignment.person_id}")
        for change in plan.deadline_changes:
            if change.commitment_id not in allowed_commitments:
                violations.append(f"{plan.plan_id}:commitment:{change.commitment_id}")
    return violations


async def _run_trial(trial: int) -> dict[str, Any]:
    trial_event = _event(trial)
    ledger = InMemoryWorkflowLedger()
    orchestrator = RecoveryOrchestrator(ledger, AdkPlanningService())
    started = time.perf_counter()
    try:
        result = await orchestrator.process(trial_event, f"hardening-message-{trial}")
        incident = ledger.incidents[result.incident_id]
        run = PlanningRun.model_validate(incident["planning_run"])
        violations = _grounding_violations(run, trial_event)
        strategies = [plan.strategy_type.value for plan in run.candidates.plans]
        expected_strategies = {strategy.value for strategy in StrategyType}
        selected = next(
            plan for plan in run.candidates.plans if plan.plan_id == result.selected_plan_id
        )
        return {
            "trial": trial,
            "attempted": True,
            "schema_valid": True,
            "candidate_count": len(run.candidates.plans),
            "expected_strategy_types": set(strategies) == expected_strategies,
            "strategies": strategies,
            "grounding_valid": not violations,
            "invalid_references": violations,
            "diversity": pairwise_diversity(run.candidates.plans),
            "planner_latency_ms": run.planner_latency_ms,
            "critic_latency_ms": run.critic_latency_ms,
            "end_to_end_latency_ms": result.end_to_end_latency_ms,
            "wall_clock_latency_ms": int((time.perf_counter() - started) * 1000),
            "tokens": {
                "input": run.input_tokens,
                "output": run.output_tokens,
                "total": run.total_tokens,
            },
            "policy_decisions": incident["policy_decisions"],
            "selected_strategy": selected.strategy_type.value,
            "terminal_stage": result.stage.value,
        }
    except Exception as error:
        return {
            "trial": trial,
            "attempted": True,
            "schema_valid": False,
            "grounding_valid": False,
            "error_type": type(error).__name__,
            "wall_clock_latency_ms": int((time.perf_counter() - started) * 1000),
        }


def _aggregate(results: list[dict[str, Any]]) -> dict[str, Any]:
    successful = [item for item in results if item.get("schema_valid")]
    diversity_values = [
        value for item in successful for value in item.get("diversity", {}).values()
    ]
    selected_distribution = {
        strategy.value: sum(item.get("selected_strategy") == strategy.value for item in successful)
        for strategy in StrategyType
    }

    def median(field: str) -> float | None:
        values = [item[field] for item in successful]
        return statistics.median(values) if values else None

    return {
        "attempted_trials": len(results),
        "schema_success_rate": len(successful) / len(results),
        "grounding_success_rate": sum(bool(item.get("grounding_valid")) for item in results)
        / len(results),
        "median_planner_latency_ms": median("planner_latency_ms"),
        "max_planner_latency_ms": (
            max(item["planner_latency_ms"] for item in successful) if successful else None
        ),
        "median_critic_latency_ms": median("critic_latency_ms"),
        "median_end_to_end_latency_ms": median("end_to_end_latency_ms"),
        "average_pairwise_diversity": (
            round(statistics.mean(diversity_values), 3) if diversity_values else None
        ),
        "minimum_pairwise_diversity": min(diversity_values) if diversity_values else None,
        "selected_strategy_distribution": selected_distribution,
    }


async def main() -> None:
    logging.getLogger().setLevel(logging.WARNING)
    results: list[dict[str, Any]] = []
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    for trial in range(1, TRIAL_COUNT + 1):
        results.append(await _run_trial(trial))
        payload = {"trials": results, "aggregate": _aggregate(results)}
        OUTPUT_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps(payload, sort_keys=True))


if __name__ == "__main__":
    asyncio.run(main())
