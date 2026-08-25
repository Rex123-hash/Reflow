"""Run the approved real-model A/B/C planner experiment."""

from __future__ import annotations

import asyncio
import json
import time
from datetime import UTC, datetime
from typing import Any

from objective_recovery_agent.planning import (
    ParallelAdkPlanningService,
    create_bundle_workflow,
    create_critic_workflow,
    create_hybrid_workflow,
    pairwise_diversity,
    run_workflow,
)
from objective_recovery_agent.schemas import (
    CandidateSet,
    CritiqueBundle,
    DisruptionEvent,
)
from objective_recovery_agent.world import planning_input


def event() -> DisruptionEvent:
    return DisruptionEvent(
        event_id="experiment-backend-lead-unavailable",
        event_type="person_unavailable",
        occurred_at=datetime(2026, 8, 25, 12, tzinfo=UTC).isoformat(),
        source="planner-architecture-experiment",
        summary="Lead backend engineer is unavailable through the protected release deadline.",
        disrupted_node_ids=["person-backend-lead"],
        evidence_references=["experiment:verified-unavailability"],
    )


async def bundle_variant(name: str, workflow: Any, context: Any) -> dict[str, Any]:
    started = time.perf_counter()
    planner_result = await run_workflow(workflow, context)
    candidates = CandidateSet.model_validate(planner_result.output)
    critic_result = await run_workflow(create_critic_workflow(), candidates)
    critiques = CritiqueBundle.model_validate(critic_result.output)
    return {
        "architecture": name,
        "candidate_count": len(candidates.plans),
        "strategies": [plan.strategy_type.value for plan in candidates.plans],
        "plan_ids": [plan.plan_id for plan in candidates.plans],
        "action_signatures": {
            plan.plan_id: sorted(f"{action.action_type}:{action.target}" for action in plan.actions)
            for plan in candidates.plans
        },
        "pairwise_diversity": pairwise_diversity(candidates.plans),
        "schema_reliable": len(critiques.critiques) == len(candidates.plans),
        "planner_latency_ms": planner_result.latency_ms,
        "critic_latency_ms": critic_result.latency_ms,
        "end_to_end_latency_ms": int((time.perf_counter() - started) * 1000),
        "input_tokens": planner_result.input_tokens + critic_result.input_tokens,
        "output_tokens": planner_result.output_tokens + critic_result.output_tokens,
        "total_tokens": planner_result.total_tokens + critic_result.total_tokens,
        "plans": candidates.model_dump(mode="json")["plans"],
    }


async def main() -> None:
    context = planning_input("incident-experiment", event())
    started = time.perf_counter()
    parallel = await ParallelAdkPlanningService().generate(context)
    architecture_a = {
        "architecture": "A_parallel_perspective_workflows",
        "candidate_count": len(parallel.candidates.plans),
        "strategies": [plan.strategy_type.value for plan in parallel.candidates.plans],
        "plan_ids": [plan.plan_id for plan in parallel.candidates.plans],
        "action_signatures": {
            plan.plan_id: sorted(f"{action.action_type}:{action.target}" for action in plan.actions)
            for plan in parallel.candidates.plans
        },
        "pairwise_diversity": pairwise_diversity(parallel.candidates.plans),
        "schema_reliable": len(parallel.critiques.critiques) == len(parallel.candidates.plans),
        "planner_latency_ms": parallel.planner_latency_ms,
        "critic_latency_ms": parallel.critic_latency_ms,
        "end_to_end_latency_ms": int((time.perf_counter() - started) * 1000),
        "input_tokens": parallel.input_tokens,
        "output_tokens": parallel.output_tokens,
        "total_tokens": parallel.total_tokens,
        "failed_perspectives": [item.value for item in parallel.failed_perspectives],
        "plans": parallel.candidates.model_dump(mode="json")["plans"],
    }
    architecture_b = await bundle_variant(
        "B_single_diverse_bundle", create_bundle_workflow(), context
    )
    architecture_c = await bundle_variant("C_seed_then_expand", create_hybrid_workflow(), context)
    print(json.dumps([architecture_a, architecture_b, architecture_c], indent=2))


if __name__ == "__main__":
    asyncio.run(main())
