"""Real ADK planning workflows and architecture variants."""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

from google.adk import Agent, Workflow
from google.adk.models import Gemini
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from objective_recovery_agent.schemas import (
    CandidateSet,
    CritiqueBundle,
    PlanningInput,
    PlanningRun,
    RecoveryPlanCandidate,
    StrategySeedSet,
    StrategyType,
)

MODEL_ID = "gemini-3.7-flash"
PLANNER_TIMEOUT_SECONDS = 45.0

_COMMON_PLANNER_INSTRUCTION = """
You are a recovery-planning agent. Return only the requested typed output. Propose
actions but never execute them. Use only IDs present in the input. Respect the protected
deadline, skill requirements, and 100 percent workload ceiling. State unknowns explicitly;
do not invent evidence. Provide concise decision summaries, never hidden reasoning. Every
action must be operationally specific and every required-evidence item must be independently
checkable. The plan must remain at PLAN_SELECTED and must not resolve the incident.
""".strip()

_PERSPECTIVE_INSTRUCTIONS = {
    StrategyType.DEADLINE_FIRST: """
Optimize first for preserving the protected Friday deadline and critical path. Prefer scope
tradeoffs, sequencing, and rapid reassignment. Set strategy_type to deadline-first.
""".strip(),
    StrategyType.RISK_MINIMIZATION_FIRST: """
Optimize first for correctness, reversibility, review coverage, and uncertainty reduction,
even when that leaves less schedule margin. Set strategy_type to risk-minimization-first.
""".strip(),
    StrategyType.RESOURCE_BALANCE_FIRST: """
Optimize first for sustainable workload distribution and skill fit. Avoid concentrating all
critical work on one person. Set strategy_type to resource-balance-first.
""".strip(),
}


@dataclass(frozen=True, slots=True)
class WorkflowResult:
    output: Any
    latency_ms: int
    total_tokens: int
    input_tokens: int
    output_tokens: int


def _model() -> Gemini:
    return Gemini(model=MODEL_ID, retry_options=types.HttpRetryOptions(attempts=2))


def _generation_config(max_output_tokens: int = 4096) -> types.GenerateContentConfig:
    return types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_level=types.ThinkingLevel.LOW),
        max_output_tokens=max_output_tokens,
    )


def create_perspective_workflow(perspective: StrategyType) -> Workflow:
    planner = Agent(
        name=f"{perspective.value.replace('-', '_')}_planner",
        model=_model(),
        mode="single_turn",
        input_schema=PlanningInput,
        output_schema=RecoveryPlanCandidate,
        instruction=f"{_COMMON_PLANNER_INSTRUCTION}\n\n{_PERSPECTIVE_INSTRUCTIONS[perspective]}",
        generate_content_config=_generation_config(),
        timeout=PLANNER_TIMEOUT_SECONDS,
    )
    return Workflow(
        name=f"{planner.name}_workflow",
        input_schema=PlanningInput,
        output_schema=RecoveryPlanCandidate,
        edges=[("START", planner)],
        timeout=PLANNER_TIMEOUT_SECONDS,
    )


def create_bundle_workflow() -> Workflow:
    planner = Agent(
        name="diverse_bundle_planner",
        model=_model(),
        mode="single_turn",
        input_schema=PlanningInput,
        output_schema=CandidateSet,
        instruction=(
            f"{_COMMON_PLANNER_INSTRUCTION}\n\nCreate exactly three materially different plans: "
            "one deadline-first, one risk-minimization-first, and one resource-balance-first. "
            "Differences must change actions, assignments, or tradeoffs, not just wording."
        ),
        generate_content_config=_generation_config(8192),
        timeout=PLANNER_TIMEOUT_SECONDS,
    )
    return Workflow(
        name="diverse_bundle_workflow",
        input_schema=PlanningInput,
        output_schema=CandidateSet,
        edges=[("START", planner)],
        timeout=PLANNER_TIMEOUT_SECONDS,
    )


def create_hybrid_workflow() -> Workflow:
    seeder = Agent(
        name="strategy_seeder",
        model=_model(),
        mode="single_turn",
        input_schema=PlanningInput,
        output_schema=StrategySeedSet,
        instruction=(
            "Return three distinct strategy seeds: deadline-first, risk-minimization-first, "
            "and resource-balance-first. Give one concrete differentiator and tradeoff each."
        ),
        generate_content_config=_generation_config(1024),
        timeout=PLANNER_TIMEOUT_SECONDS,
    )
    expander = Agent(
        name="seeded_plan_expander",
        model=_model(),
        mode="single_turn",
        input_schema=StrategySeedSet,
        output_schema=CandidateSet,
        instruction=(
            f"{_COMMON_PLANNER_INSTRUCTION}\n\nExpand the three supplied seeds into exactly "
            "three typed plans. Preserve each seed's strategy type and meaningful tradeoff."
        ),
        generate_content_config=_generation_config(8192),
        timeout=PLANNER_TIMEOUT_SECONDS,
    )
    return Workflow(
        name="hybrid_seeded_workflow",
        input_schema=PlanningInput,
        output_schema=CandidateSet,
        edges=[("START", seeder), (seeder, expander)],
        timeout=PLANNER_TIMEOUT_SECONDS * 2,
    )


def create_critic_workflow() -> Workflow:
    critic = Agent(
        name="risk_critic",
        model=_model(),
        mode="single_turn",
        input_schema=CandidateSet,
        output_schema=CritiqueBundle,
        instruction="""
Attack every supplied plan. Identify contradictions, ungrounded assumptions, missing evidence,
single points of failure, deadline risk, overload, and skill mismatch. Return exactly one critique
per plan using the unchanged plan_id. Adjust risk scores but do not approve, reject, rewrite, or
execute a plan. Give concise evidence-based summaries and never hidden reasoning.
""".strip(),
        generate_content_config=_generation_config(4096),
        timeout=PLANNER_TIMEOUT_SECONDS,
    )
    return Workflow(
        name="risk_critic_workflow",
        input_schema=CandidateSet,
        output_schema=CritiqueBundle,
        edges=[("START", critic)],
        timeout=PLANNER_TIMEOUT_SECONDS,
    )


async def run_workflow(workflow: Workflow, payload: PlanningInput | CandidateSet) -> WorkflowResult:
    session_service = InMemorySessionService()
    user_id = "objective-recovery"
    session_id = str(uuid.uuid4())
    await session_service.create_session(
        app_name=workflow.name, user_id=user_id, session_id=session_id
    )
    runner = Runner(node=workflow, app_name=workflow.name, session_service=session_service)
    message = types.Content(
        role="user", parts=[types.Part.from_text(text=payload.model_dump_json())]
    )
    started = time.perf_counter()
    output: Any = None
    output_text: str | None = None
    total_tokens = 0
    input_tokens = 0
    output_tokens = 0
    async for event in runner.run_async(
        user_id=user_id, session_id=session_id, new_message=message
    ):
        if event.output is not None:
            output = event.output
        if event.content and event.content.parts:
            text_parts = [part.text for part in event.content.parts if part.text]
            if text_parts:
                output_text = "".join(text_parts)
        if event.usage_metadata and event.usage_metadata.total_token_count:
            total_tokens += event.usage_metadata.total_token_count
            input_tokens += event.usage_metadata.prompt_token_count or 0
            output_tokens += (event.usage_metadata.candidates_token_count or 0) + (
                event.usage_metadata.thoughts_token_count or 0
            )
    if output is None and output_text is not None:
        output = json.loads(output_text)
    if output is None:
        raise ValueError(f"ADK workflow {workflow.name} produced no typed output")
    return WorkflowResult(
        output,
        int((time.perf_counter() - started) * 1000),
        total_tokens,
        input_tokens,
        output_tokens,
    )


def _validate_perspective(output: Any, expected: StrategyType) -> RecoveryPlanCandidate:
    candidate = RecoveryPlanCandidate.model_validate(output)
    if candidate.strategy_type is not expected:
        raise ValueError(f"{expected.value} planner returned {candidate.strategy_type.value}")
    return candidate


def _validate_critique_ids(candidates: CandidateSet, critiques: CritiqueBundle) -> None:
    candidate_ids = {plan.plan_id for plan in candidates.plans}
    critique_ids = {critique.plan_id for critique in critiques.critiques}
    if candidate_ids != critique_ids or len(critique_ids) != len(critiques.critiques):
        raise ValueError("risk critic must return exactly one critique for every candidate")


class ParallelAdkPlanningService:
    """Architecture A: isolated perspective workflows run concurrently."""

    async def generate(self, planning_input: PlanningInput) -> PlanningRun:
        perspectives = tuple(StrategyType)
        tasks = [
            asyncio.create_task(
                asyncio.wait_for(
                    run_workflow(create_perspective_workflow(perspective), planning_input),
                    timeout=PLANNER_TIMEOUT_SECONDS + 5,
                )
            )
            for perspective in perspectives
        ]
        started = time.perf_counter()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        candidates: list[RecoveryPlanCandidate] = []
        failures: list[StrategyType] = []
        planner_tokens = 0
        planner_input_tokens = 0
        planner_output_tokens = 0
        for perspective, result in zip(perspectives, results, strict=True):
            if isinstance(result, BaseException):
                failures.append(perspective)
                continue
            typed_result = result
            try:
                candidates.append(_validate_perspective(typed_result.output, perspective))
            except ValueError:
                failures.append(perspective)
                continue
            planner_tokens += typed_result.total_tokens
            planner_input_tokens += typed_result.input_tokens
            planner_output_tokens += typed_result.output_tokens
        planner_latency_ms = int((time.perf_counter() - started) * 1000)
        if not candidates:
            raise RuntimeError("all ADK planners failed or returned invalid output")

        candidate_set = CandidateSet(plans=candidates)
        critic_result = await asyncio.wait_for(
            run_workflow(create_critic_workflow(), candidate_set),
            timeout=PLANNER_TIMEOUT_SECONDS + 5,
        )
        critiques = CritiqueBundle.model_validate(critic_result.output)
        _validate_critique_ids(candidate_set, critiques)
        return PlanningRun(
            candidates=candidate_set,
            critiques=critiques,
            planner_latency_ms=planner_latency_ms,
            critic_latency_ms=critic_result.latency_ms,
            total_tokens=planner_tokens + critic_result.total_tokens,
            input_tokens=planner_input_tokens + critic_result.input_tokens,
            output_tokens=planner_output_tokens + critic_result.output_tokens,
            failed_perspectives=failures,
        )


def ensure_materially_different(candidates: CandidateSet) -> None:
    if {plan.strategy_type for plan in candidates.plans} != set(StrategyType):
        raise ValueError("planner must return all three required strategy perspectives")
    diversity = pairwise_diversity(candidates.plans)
    if not diversity or min(diversity.values()) < 0.25:
        raise ValueError("candidate action sets are not materially different")


class AdkPlanningService:
    """Selected architecture B: one diverse bundle planner plus one critic."""

    async def generate(self, planning_input: PlanningInput) -> PlanningRun:
        planner_result = await asyncio.wait_for(
            run_workflow(create_bundle_workflow(), planning_input),
            timeout=PLANNER_TIMEOUT_SECONDS + 5,
        )
        candidates = CandidateSet.model_validate(planner_result.output)
        ensure_materially_different(candidates)
        critic_result = await asyncio.wait_for(
            run_workflow(create_critic_workflow(), candidates),
            timeout=PLANNER_TIMEOUT_SECONDS + 5,
        )
        critiques = CritiqueBundle.model_validate(critic_result.output)
        _validate_critique_ids(candidates, critiques)
        return PlanningRun(
            candidates=candidates,
            critiques=critiques,
            planner_latency_ms=planner_result.latency_ms,
            critic_latency_ms=critic_result.latency_ms,
            total_tokens=planner_result.total_tokens + critic_result.total_tokens,
            input_tokens=planner_result.input_tokens + critic_result.input_tokens,
            output_tokens=planner_result.output_tokens + critic_result.output_tokens,
            failed_perspectives=[],
        )


def action_signatures(plan: RecoveryPlanCandidate) -> frozenset[str]:
    return frozenset(f"{action.action_type}:{action.target}" for action in plan.actions)


def pairwise_diversity(plans: Iterable[RecoveryPlanCandidate]) -> dict[str, float]:
    plan_list = list(plans)
    scores: dict[str, float] = {}
    for index, left in enumerate(plan_list):
        for right in plan_list[index + 1 :]:
            left_set = action_signatures(left)
            right_set = action_signatures(right)
            union = left_set | right_set
            similarity = len(left_set & right_set) / len(union) if union else 1.0
            scores[f"{left.plan_id}::{right.plan_id}"] = round(1.0 - similarity, 3)
    return scores
