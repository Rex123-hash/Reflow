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
from pydantic import BaseModel, ValidationError

from objective_recovery_agent.agent_runtime import (
    AgentId,
    AgentTraceContext,
    content_fingerprint,
    emit_agent_event,
)
from objective_recovery_agent.observability import OperationalEvent, emit_operational_event
from objective_recovery_agent.schemas import (
    CandidateGeneration,
    CandidateSet,
    CritiqueBundle,
    CritiqueGeneration,
    PlanningInput,
    PlanningRun,
    RecoveryAnalysis,
    RecoveryAnalysisGeneration,
    RecoveryAnalysisInput,
    RecoveryPlanCandidate,
    RecoveryPlanningInput,
    ReplanCriticInput,
    ReplanningInput,
    StrategySeedSet,
    StrategyType,
)

MODEL_ID = "gemini-3.7-flash"
PLANNER_TIMEOUT_SECONDS = 45.0


class PlanningPhaseError(RuntimeError):
    """A safe, categorized failure at a typed model boundary."""

    def __init__(self, category: OperationalEvent, cause: BaseException) -> None:
        super().__init__(f"{category.value}: {type(cause).__name__}")
        self.category = category


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
        name=AgentId.RECOVERY_PLANNER.value,
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
        name=AgentId.RISK_CRITIC.value,
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


def create_recovery_analyst_workflow() -> Workflow:
    analyst = Agent(
        name=AgentId.RECOVERY_ANALYST.value,
        model=_model(),
        mode="single_turn",
        input_schema=RecoveryAnalysisInput,
        output_schema=RecoveryAnalysis,
        instruction=(
            "Analyze why the verified prior recovery failed and state what must materially change "
            "before another plan is proposed. Carry forward the exact supplied failed invariant, "
            "evidence references, and failed-effect fingerprints. Identify failed or unsupported "
            "assumptions, next-plan constraints, and changes supported by AVAILABLE artifacts. "
            "Never invent evidence or artifacts, propose a final plan, select or execute actions, "
            "change policy, or declare the objective restored. Return only typed concise analysis "
            "and no hidden reasoning."
        ),
        generate_content_config=_generation_config(4096),
        timeout=PLANNER_TIMEOUT_SECONDS,
    )
    return Workflow(
        name="recovery_analyst_workflow",
        input_schema=RecoveryAnalysisInput,
        output_schema=RecoveryAnalysis,
        edges=[("START", analyst)],
        timeout=PLANNER_TIMEOUT_SECONDS,
    )


def create_replan_workflow() -> Workflow:
    planner = Agent(
        name=AgentId.RECOVERY_PLANNER.value,
        model=_model(),
        mode="single_turn",
        input_schema=RecoveryPlanningInput,
        output_schema=CandidateSet,
        instruction=(
            f"{_COMMON_PLANNER_INSTRUCTION}\n\n"
            "This is a revision after a verified external recovery failure. Consume the typed "
            "recovery analysis, while treating authoritative_context as final whenever they "
            "conflict. Generate one to "
            "three materially revised executable futures from the supplied durable context. "
            "Use only immutable artifacts whose state is AVAILABLE. A GitHub validation action "
            "must have action_type github_release_validation, target the supplied repository, "
            "and include candidate_sha, workflow_id, workflow_path, and invariant_id parameters. "
            "Do not repeat a historically failed objective effect. Do not assume an artifact is "
            "selected merely because it is available. If no executable future exists, return "
            "plans that truthfully expose their blocking unknown or policy conflict; never invent "
            "an artifact, SHA, external result, or success. Assignment proposals may use only "
            "the supplied resources, person IDs, work-item IDs, and their exact declared skills; "
            "they are proposals and must not be represented as already executed."
        ),
        generate_content_config=_generation_config(8192),
        timeout=PLANNER_TIMEOUT_SECONDS,
    )
    return Workflow(
        name="recovery_replan_workflow",
        input_schema=RecoveryPlanningInput,
        output_schema=CandidateSet,
        edges=[("START", planner)],
        timeout=PLANNER_TIMEOUT_SECONDS,
    )


def create_replan_critic_workflow() -> Workflow:
    critic = Agent(
        name=AgentId.RISK_CRITIC.value,
        model=_model(),
        mode="single_turn",
        input_schema=ReplanCriticInput,
        output_schema=CritiqueBundle,
        instruction=(
            "Attack every candidate using both the complete failed-recovery context and the new "
            "candidates. Identify exact-repeat recovery, unsupported artifacts, SHA/workflow "
            "mismatch, contradictions, missing external evidence, deadline risk, overload, and "
            "blocking unknowns. Return exactly one critique per unchanged plan_id. Adjust risk "
            "scores but never select, execute, or mark the objective healthy."
        ),
        generate_content_config=_generation_config(4096),
        timeout=PLANNER_TIMEOUT_SECONDS,
    )
    return Workflow(
        name="recovery_replan_critic_workflow",
        input_schema=ReplanCriticInput,
        output_schema=CritiqueBundle,
        edges=[("START", critic)],
        timeout=PLANNER_TIMEOUT_SECONDS,
    )


async def run_workflow(
    workflow: Workflow,
    payload: BaseModel,
    *,
    trace: AgentTraceContext | None = None,
) -> WorkflowResult:
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
    input_fingerprint = content_fingerprint(payload)
    if trace is not None:
        emit_agent_event(
            "started",
            trace,
            model=MODEL_ID,
            input_fingerprint=input_fingerprint,
        )
    output: Any = None
    output_text: str | None = None
    total_tokens = 0
    input_tokens = 0
    output_tokens = 0
    try:
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
        output_schema = workflow.output_schema
        if isinstance(output_schema, type) and issubclass(output_schema, BaseModel):
            output = output_schema.model_validate(output)
    except BaseException as error:
        if trace is not None:
            emit_agent_event(
                "failed",
                trace,
                model=MODEL_ID,
                input_fingerprint=input_fingerprint,
                latency_ms=int((time.perf_counter() - started) * 1000),
                error_type=type(error).__name__,
            )
        raise
    latency_ms = int((time.perf_counter() - started) * 1000)
    if trace is not None:
        emit_agent_event(
            "completed",
            trace,
            model=MODEL_ID,
            input_fingerprint=input_fingerprint,
            output_fingerprint=content_fingerprint(output),
            latency_ms=latency_ms,
        )
    return WorkflowResult(output, latency_ms, total_tokens, input_tokens, output_tokens)


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


def build_recovery_analysis_input(value: ReplanningInput) -> RecoveryAnalysisInput:
    evidence_references = [f"invariant:{value.failed_invariant_id}"]
    for effect in value.failed_recovery_effects:
        evidence_references.append(f"failed-effect:{effect.fingerprint}")
    run_id = value.failed_run.get("run_id")
    if run_id is not None:
        evidence_references.append(f"github-run:{run_id}")
    for prefix, receipt in (
        ("calendar-receipt", value.calendar_receipt),
        ("github-receipt", value.github_receipt),
    ):
        reference = next(
            (
                receipt.get(key)
                for key in ("receipt_id", "action_receipt_id", "idempotency_key")
                if receipt.get(key)
            ),
            None,
        )
        if reference is not None:
            evidence_references.append(f"{prefix}:{reference}")
    return RecoveryAnalysisInput(
        incident_id=value.incident_id,
        plan_revision=value.plan_revision,
        objective_id=value.objective.objective_id,
        failed_invariant_id=value.failed_invariant_id,
        evidence_references=evidence_references,
        previous_plan_assumptions=value.previous_plan_assumptions,
        previous_plan_unknowns=value.previous_plan_unknowns,
        previous_critic_findings=value.previous_critic_findings,
        failed_candidate_sha=value.failed_candidate_sha,
        failed_run=value.failed_run,
        failed_jobs=value.failed_jobs,
        failed_recovery_effects=value.failed_recovery_effects,
        available_recovery_artifacts=value.available_recovery_artifacts,
        recovery_one_accomplished=value.recovery_one_accomplished,
        remaining_broken=value.remaining_broken,
        unhealthy_reason=value.unhealthy_reason,
        policy_summary=value.policy_summary,
    )


def validate_recovery_analysis(
    analysis_input: RecoveryAnalysisInput, analysis: RecoveryAnalysis
) -> RecoveryAnalysis:
    if set(analysis.failed_invariant_references) != {analysis_input.failed_invariant_id}:
        raise ValueError("recovery analyst changed the authoritative failed invariant")
    allowed_evidence = set(analysis_input.evidence_references)
    if (
        not analysis.evidence_references
        or not set(analysis.evidence_references) <= allowed_evidence
    ):
        raise ValueError("recovery analyst returned an ungrounded evidence reference")
    failed_fingerprints = {item.fingerprint for item in analysis_input.failed_recovery_effects}
    required_evidence = {
        f"invariant:{analysis_input.failed_invariant_id}",
        *(f"failed-effect:{fingerprint}" for fingerprint in failed_fingerprints),
    }
    if not required_evidence <= set(analysis.evidence_references):
        raise ValueError("recovery analyst omitted required failure evidence")
    if set(analysis.exact_repeat_fingerprints) != failed_fingerprints:
        raise ValueError("recovery analyst changed exact-repeat avoidance fingerprints")
    if not analysis.next_plan_constraints:
        raise ValueError("recovery analyst returned no next-plan constraints")
    if not analysis.material_changes:
        raise ValueError("recovery analyst returned no material change")
    return analysis


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

    async def generate_candidates(self, planning_input: PlanningInput) -> CandidateGeneration:
        planning_run_id = str(uuid.uuid4())
        correlation = {
            "event_id": planning_input.disruption.event_id,
            "incident_id": planning_input.incident_id,
            "planning_run_id": planning_run_id,
            "model": MODEL_ID,
        }
        emit_operational_event(OperationalEvent.PLANNER_STARTED, **correlation)
        try:
            planner_result = await asyncio.wait_for(
                run_workflow(
                    create_bundle_workflow(),
                    planning_input,
                    trace=AgentTraceContext(
                        AgentId.RECOVERY_PLANNER,
                        "initial_recovery_planning",
                        incident_id=planning_input.incident_id,
                        recovery_attempt=1,
                        source_event_id=planning_input.disruption.event_id,
                    ),
                ),
                timeout=PLANNER_TIMEOUT_SECONDS + 5,
            )
        except TimeoutError as error:
            emit_operational_event(OperationalEvent.PLANNER_TIMEOUT, **correlation)
            raise PlanningPhaseError(OperationalEvent.PLANNER_TIMEOUT, error) from error
        except (json.JSONDecodeError, ValidationError) as error:
            emit_operational_event(OperationalEvent.PLANNER_SCHEMA_INVALID, **correlation)
            raise PlanningPhaseError(OperationalEvent.PLANNER_SCHEMA_INVALID, error) from error
        except Exception as error:
            emit_operational_event(
                OperationalEvent.PLANNER_FAILED,
                error_type=type(error).__name__,
                **correlation,
            )
            raise PlanningPhaseError(OperationalEvent.PLANNER_FAILED, error) from error

        try:
            candidates = CandidateSet.model_validate(planner_result.output)
        except ValidationError as error:
            emit_operational_event(OperationalEvent.PLANNER_SCHEMA_INVALID, **correlation)
            raise PlanningPhaseError(OperationalEvent.PLANNER_SCHEMA_INVALID, error) from error
        try:
            ensure_materially_different(candidates)
        except ValueError as error:
            emit_operational_event(
                OperationalEvent.PLANNER_FAILED,
                error_type="InsufficientDiversity",
                **correlation,
            )
            raise PlanningPhaseError(OperationalEvent.PLANNER_FAILED, error) from error

        emit_operational_event(
            OperationalEvent.PLANNER_COMPLETED,
            latency_ms=planner_result.latency_ms,
            candidate_count=len(candidates.plans),
            total_tokens=planner_result.total_tokens,
            **correlation,
        )
        return CandidateGeneration(
            planning_run_id=planning_run_id,
            candidates=candidates,
            planner_latency_ms=planner_result.latency_ms,
            total_tokens=planner_result.total_tokens,
            input_tokens=planner_result.input_tokens,
            output_tokens=planner_result.output_tokens,
        )

    async def critique(
        self,
        candidates: CandidateSet,
        *,
        planning_run_id: str,
        event_id: str | None = None,
        incident_id: str | None = None,
    ) -> CritiqueGeneration:
        correlation = {
            "planning_run_id": planning_run_id,
            "model": MODEL_ID,
            "event_id": event_id,
            "incident_id": incident_id,
        }
        emit_operational_event(
            OperationalEvent.CRITIC_STARTED,
            candidate_count=len(candidates.plans),
            **correlation,
        )
        try:
            critic_result = await asyncio.wait_for(
                run_workflow(
                    create_critic_workflow(),
                    candidates,
                    trace=AgentTraceContext(
                        AgentId.RISK_CRITIC,
                        "initial_plan_critique",
                        incident_id=incident_id,
                        recovery_attempt=1,
                        source_event_id=event_id,
                    ),
                ),
                timeout=PLANNER_TIMEOUT_SECONDS + 5,
            )
        except TimeoutError as error:
            emit_operational_event(OperationalEvent.CRITIC_TIMEOUT, **correlation)
            raise PlanningPhaseError(OperationalEvent.CRITIC_TIMEOUT, error) from error
        except (json.JSONDecodeError, ValidationError) as error:
            emit_operational_event(OperationalEvent.CRITIC_SCHEMA_INVALID, **correlation)
            raise PlanningPhaseError(OperationalEvent.CRITIC_SCHEMA_INVALID, error) from error
        except Exception as error:
            emit_operational_event(
                OperationalEvent.CRITIC_FAILED,
                error_type=type(error).__name__,
                **correlation,
            )
            raise PlanningPhaseError(OperationalEvent.CRITIC_FAILED, error) from error

        try:
            critiques = CritiqueBundle.model_validate(critic_result.output)
            _validate_critique_ids(candidates, critiques)
        except (ValidationError, ValueError) as error:
            emit_operational_event(OperationalEvent.CRITIC_SCHEMA_INVALID, **correlation)
            raise PlanningPhaseError(OperationalEvent.CRITIC_SCHEMA_INVALID, error) from error

        emit_operational_event(
            OperationalEvent.CRITIC_COMPLETED,
            latency_ms=critic_result.latency_ms,
            critique_count=len(critiques.critiques),
            total_tokens=critic_result.total_tokens,
            **correlation,
        )
        return CritiqueGeneration(
            critiques=critiques,
            critic_latency_ms=critic_result.latency_ms,
            total_tokens=critic_result.total_tokens,
            input_tokens=critic_result.input_tokens,
            output_tokens=critic_result.output_tokens,
        )

    async def generate(self, planning_input: PlanningInput) -> PlanningRun:
        candidate_generation = await self.generate_candidates(planning_input)
        critique_generation = await self.critique(
            candidate_generation.candidates,
            planning_run_id=candidate_generation.planning_run_id,
            event_id=planning_input.disruption.event_id,
            incident_id=planning_input.incident_id,
        )
        return PlanningRun(
            planning_run_id=candidate_generation.planning_run_id,
            candidates=candidate_generation.candidates,
            critiques=critique_generation.critiques,
            planner_latency_ms=candidate_generation.planner_latency_ms,
            critic_latency_ms=critique_generation.critic_latency_ms,
            total_tokens=candidate_generation.total_tokens + critique_generation.total_tokens,
            input_tokens=candidate_generation.input_tokens + critique_generation.input_tokens,
            output_tokens=candidate_generation.output_tokens + critique_generation.output_tokens,
            failed_perspectives=[],
        )

    async def analyze_recovery(
        self, replanning_input: ReplanningInput
    ) -> RecoveryAnalysisGeneration:
        analysis_input = build_recovery_analysis_input(replanning_input)
        correlation = {
            "incident_id": replanning_input.incident_id,
            "model": MODEL_ID,
            "plan_revision": replanning_input.plan_revision,
            "agent_id": AgentId.RECOVERY_ANALYST.value,
        }
        try:
            result = await asyncio.wait_for(
                run_workflow(
                    create_recovery_analyst_workflow(),
                    analysis_input,
                    trace=AgentTraceContext(
                        AgentId.RECOVERY_ANALYST,
                        "failed_recovery_analysis",
                        incident_id=replanning_input.incident_id,
                        recovery_attempt=replanning_input.plan_revision,
                    ),
                ),
                timeout=PLANNER_TIMEOUT_SECONDS + 5,
            )
            analysis = validate_recovery_analysis(
                analysis_input, RecoveryAnalysis.model_validate(result.output)
            )
        except TimeoutError as error:
            emit_operational_event(OperationalEvent.RECOVERY_ANALYST_TIMEOUT, **correlation)
            raise PlanningPhaseError(OperationalEvent.RECOVERY_ANALYST_TIMEOUT, error) from error
        except (json.JSONDecodeError, ValidationError, ValueError) as error:
            emit_operational_event(OperationalEvent.RECOVERY_ANALYST_SCHEMA_INVALID, **correlation)
            raise PlanningPhaseError(
                OperationalEvent.RECOVERY_ANALYST_SCHEMA_INVALID, error
            ) from error
        except Exception as error:
            emit_operational_event(
                OperationalEvent.RECOVERY_ANALYST_FAILED,
                error_type=type(error).__name__,
                **correlation,
            )
            raise PlanningPhaseError(OperationalEvent.RECOVERY_ANALYST_FAILED, error) from error
        return RecoveryAnalysisGeneration(
            analysis=analysis,
            analyst_latency_ms=result.latency_ms,
            total_tokens=result.total_tokens,
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
        )

    async def generate_replan_candidates(
        self,
        replanning_input: ReplanningInput,
        recovery_analysis: RecoveryAnalysis,
    ) -> CandidateGeneration:
        planning_run_id = str(uuid.uuid4())
        correlation = {
            "incident_id": replanning_input.incident_id,
            "planning_run_id": planning_run_id,
            "model": MODEL_ID,
            "plan_revision": replanning_input.plan_revision,
        }
        emit_operational_event(OperationalEvent.PLANNER_STARTED, **correlation)
        try:
            result = await asyncio.wait_for(
                run_workflow(
                    create_replan_workflow(),
                    RecoveryPlanningInput(
                        authoritative_context=replanning_input,
                        recovery_analysis=recovery_analysis,
                    ),
                    trace=AgentTraceContext(
                        AgentId.RECOVERY_PLANNER,
                        "recovery_replanning",
                        incident_id=replanning_input.incident_id,
                        recovery_attempt=replanning_input.plan_revision,
                    ),
                ),
                timeout=PLANNER_TIMEOUT_SECONDS + 5,
            )
            candidates = CandidateSet.model_validate(result.output)
        except TimeoutError as error:
            emit_operational_event(OperationalEvent.PLANNER_TIMEOUT, **correlation)
            raise PlanningPhaseError(OperationalEvent.PLANNER_TIMEOUT, error) from error
        except (json.JSONDecodeError, ValidationError) as error:
            emit_operational_event(OperationalEvent.PLANNER_SCHEMA_INVALID, **correlation)
            raise PlanningPhaseError(OperationalEvent.PLANNER_SCHEMA_INVALID, error) from error
        except Exception as error:
            emit_operational_event(
                OperationalEvent.PLANNER_FAILED, error_type=type(error).__name__, **correlation
            )
            raise PlanningPhaseError(OperationalEvent.PLANNER_FAILED, error) from error
        emit_operational_event(
            OperationalEvent.PLANNER_COMPLETED,
            latency_ms=result.latency_ms,
            candidate_count=len(candidates.plans),
            total_tokens=result.total_tokens,
            **correlation,
        )
        return CandidateGeneration(
            planning_run_id=planning_run_id,
            candidates=candidates,
            planner_latency_ms=result.latency_ms,
            total_tokens=result.total_tokens,
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
        )

    async def critique_replan(
        self,
        replanning_input: ReplanningInput,
        candidates: CandidateSet,
        *,
        planning_run_id: str,
    ) -> CritiqueGeneration:
        correlation = {
            "incident_id": replanning_input.incident_id,
            "planning_run_id": planning_run_id,
            "model": MODEL_ID,
            "plan_revision": replanning_input.plan_revision,
        }
        emit_operational_event(
            OperationalEvent.CRITIC_STARTED, candidate_count=len(candidates.plans), **correlation
        )
        try:
            result = await asyncio.wait_for(
                run_workflow(
                    create_replan_critic_workflow(),
                    ReplanCriticInput(
                        replanning_context=replanning_input,
                        candidates=candidates,
                    ),
                    trace=AgentTraceContext(
                        AgentId.RISK_CRITIC,
                        "recovery_plan_critique",
                        incident_id=replanning_input.incident_id,
                        recovery_attempt=replanning_input.plan_revision,
                    ),
                ),
                timeout=PLANNER_TIMEOUT_SECONDS + 5,
            )
            critiques = CritiqueBundle.model_validate(result.output)
            _validate_critique_ids(candidates, critiques)
        except TimeoutError as error:
            emit_operational_event(OperationalEvent.CRITIC_TIMEOUT, **correlation)
            raise PlanningPhaseError(OperationalEvent.CRITIC_TIMEOUT, error) from error
        except (json.JSONDecodeError, ValidationError, ValueError) as error:
            emit_operational_event(OperationalEvent.CRITIC_SCHEMA_INVALID, **correlation)
            raise PlanningPhaseError(OperationalEvent.CRITIC_SCHEMA_INVALID, error) from error
        except Exception as error:
            emit_operational_event(
                OperationalEvent.CRITIC_FAILED, error_type=type(error).__name__, **correlation
            )
            raise PlanningPhaseError(OperationalEvent.CRITIC_FAILED, error) from error
        emit_operational_event(
            OperationalEvent.CRITIC_COMPLETED,
            latency_ms=result.latency_ms,
            critique_count=len(critiques.critiques),
            total_tokens=result.total_tokens,
            **correlation,
        )
        return CritiqueGeneration(
            critiques=critiques,
            critic_latency_ms=result.latency_ms,
            total_tokens=result.total_tokens,
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
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
