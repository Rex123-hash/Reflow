"""Run non-destructive P2C qualification against the configured Vertex runtime."""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import hashlib
import io
import json
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from objective_recovery_agent.agent_runtime import AgentId, AgentTraceContext
from objective_recovery_agent.gmail_contract import (
    DisruptionFacts,
    GmailClassification,
    GmailInterpretation,
    NormalizedGmailMessage,
)
from objective_recovery_agent.gmail_interpretation import (
    create_disruption_interpreter_workflow,
    create_impact_analyst_workflow,
    disruption_input,
    impact_input,
    validate_disruption_facts,
    validate_impact_analysis,
)
from objective_recovery_agent.ledger import FirestoreWorkflowLedger
from objective_recovery_agent.objective_store import FirestoreObjectiveStore
from objective_recovery_agent.orchestrator import _to_domain_plan
from objective_recovery_agent.p1d import (
    P1DConfiguration,
    build_replanning_input,
    deterministic_selection,
)
from objective_recovery_agent.p1d_store import FirestoreP1DStore
from objective_recovery_agent.planning import AdkPlanningService, WorkflowResult, run_workflow
from objective_recovery_agent.schemas import DisruptionEvent
from objective_recovery_agent.world import build_policy_engine, planning_input

from objective_recovery.application.selection import select_best_valid_plan
from objective_recovery.domain.errors import NoValidPlanError
from objective_recovery.domain.models import EvaluatedPlan

DEFAULT_INCIDENT = "incident-0fc3af5b0bd1ad847aea"
DEFAULT_OUTPUT = Path("artifacts/p2c-live-qualification.json")


def load_project_environment() -> None:
    env_path = Path(".env")
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def fingerprint(value: Any) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str).encode()
    return hashlib.sha256(encoded).hexdigest()


def normalized_message(message_id: str, subject: str, text: str) -> NormalizedGmailMessage:
    return NormalizedGmailMessage(
        gmail_message_id=message_id,
        thread_id=f"thread-{message_id}",
        mailbox="qualification@example.invalid",
        sender="ops@example.invalid",
        to="qualification@example.invalid",
        subject=subject,
        internal_date="2026-08-27T12:00:00+00:00",
        labels=["INBOX"],
        snippet=text[:80],
        normalized_text=text,
        content_hash=hashlib.sha256(text.encode()).hexdigest(),
        evidence_excerpt=text[:256],
    )


async def captured(coroutine: Any) -> tuple[Any, list[dict[str, Any]]]:
    output = io.StringIO()
    with contextlib.redirect_stdout(output):
        result = await coroutine
    events: list[dict[str, Any]] = []
    for line in output.getvalue().splitlines():
        try:
            value = json.loads(line)
        except json.JSONDecodeError:
            continue
        if str(value.get("operational_event", "")).startswith("AGENT_INVOCATION_"):
            events.append(value)
    return result, events


async def invoke(
    *,
    workflow: Any,
    payload: Any,
    trace: AgentTraceContext,
) -> tuple[WorkflowResult, list[dict[str, Any]]]:
    result, events = await captured(run_workflow(workflow, payload, trace=trace))
    return result, events


def event_metadata(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    allowed = {
        "operational_event",
        "occurred_at",
        "agent_id",
        "agent_version",
        "model",
        "phase",
        "incident_id",
        "recovery_attempt",
        "source_event_id",
        "input_fingerprint",
        "output_fingerprint",
        "latency_ms",
        "status",
        "error_type",
    }
    return [{key: value for key, value in item.items() if key in allowed} for item in events]


def usage(result: WorkflowResult) -> dict[str, int]:
    return {
        "latency_ms": result.latency_ms,
        "input_tokens": result.input_tokens,
        "output_tokens": result.output_tokens,
        "total_tokens": result.total_tokens,
    }


def canonical_snapshot(project: str, incident_id: str) -> tuple[dict[str, Any], Any]:
    workflow = FirestoreWorkflowLedger(project)
    incident = workflow.load_incident(incident_id)
    replanning = build_replanning_input(
        incident=incident,
        objective_store=FirestoreObjectiveStore(project),
        p1d_store=FirestoreP1DStore(project),
    )
    summary = {
        "incident_id": incident_id,
        "stage": incident.get("stage"),
        "status": incident.get("status"),
        "revision": incident.get("revision"),
        "selected_plan_id": incident.get("selected_plan_id"),
        "active_plan_revision": incident.get("active_plan_revision"),
        "final_verification": incident.get("final_verification"),
        "document_fingerprint": fingerprint(incident),
    }
    return summary, replanning


async def qualify(project: str, incident_id: str) -> dict[str, Any]:
    traces: list[dict[str, Any]] = []

    irrelevant_message = normalized_message(
        "p2c-live-irrelevant",
        "Lunch confirmation",
        (
            "Lunch is confirmed for Thursday. No release work, staffing, deadline, "
            "or incident changed."
        ),
    )
    irrelevant_result, irrelevant_events = await invoke(
        workflow=create_disruption_interpreter_workflow(),
        payload=disruption_input(irrelevant_message),
        trace=AgentTraceContext(
            AgentId.DISRUPTION_INTERPRETER,
            "qualification_irrelevant_interpretation",
            source_event_id=irrelevant_message.gmail_message_id,
        ),
    )
    traces.extend(irrelevant_events)
    irrelevant = validate_disruption_facts(
        irrelevant_message, DisruptionFacts.model_validate(irrelevant_result.output)
    )
    if irrelevant.classification is GmailClassification.REAL_DISRUPTION:
        raise ValueError("irrelevant qualification case was classified as a real disruption")

    real_message = normalized_message(
        "p2c-live-canonical",
        "Backend delivery disruption",
        (
            "The lead backend engineer is unavailable through the protected Friday release "
            "deadline. API migration work is blocked and Release V2 is at risk."
        ),
    )
    facts_result, fact_events = await invoke(
        workflow=create_disruption_interpreter_workflow(),
        payload=disruption_input(real_message),
        trace=AgentTraceContext(
            AgentId.DISRUPTION_INTERPRETER,
            "qualification_disruption_interpretation",
            recovery_attempt=1,
            source_event_id=real_message.gmail_message_id,
        ),
    )
    traces.extend(fact_events)
    facts = validate_disruption_facts(
        real_message, DisruptionFacts.model_validate(facts_result.output)
    )
    if facts.classification is not GmailClassification.REAL_DISRUPTION:
        raise ValueError("canonical qualification case was not classified as a real disruption")

    impact_result, impact_events = await invoke(
        workflow=create_impact_analyst_workflow(),
        payload=impact_input(facts),
        trace=AgentTraceContext(
            AgentId.IMPACT_ANALYST,
            "qualification_candidate_impact",
            recovery_attempt=1,
            source_event_id=real_message.gmail_message_id,
        ),
    )
    traces.extend(impact_events)
    impact = validate_impact_analysis(
        real_message, facts, GmailInterpretation.model_validate(impact_result.output)
    )

    disruption = DisruptionEvent(
        event_id="p2c-live-canonical",
        event_type=impact.event_type,
        occurred_at="2026-08-27T12:00:00+00:00",
        source="p2c-live-qualification",
        summary=impact.summary,
        disrupted_node_ids=impact.candidate_node_ids,
        evidence_references=[
            f"gmail-excerpt:{index}" for index, _ in enumerate(impact.grounded_excerpts)
        ],
    )
    initial_context = planning_input("p2c-live-initial", disruption)
    planner = AdkPlanningService()
    generated, planner_events = await captured(planner.generate_candidates(initial_context))
    traces.extend(planner_events)
    critiqued, critic_events = await captured(
        planner.critique(
            generated.candidates,
            planning_run_id=generated.planning_run_id,
            event_id=disruption.event_id,
            incident_id=initial_context.incident_id,
        )
    )
    traces.extend(critic_events)
    critique_by_id = {item.plan_id: item for item in critiqued.critiques.critiques}
    evaluated: list[EvaluatedPlan] = []
    policy = build_policy_engine()
    for candidate in generated.candidates.plans:
        critique = critique_by_id[candidate.plan_id]
        plan = _to_domain_plan(
            initial_context.incident_id,
            candidate,
            critique.adjusted_risk_score,
            critique.additional_risks,
        )
        evaluated.append(EvaluatedPlan(plan, policy.evaluate(plan)))
    try:
        selected_initial = select_best_valid_plan(evaluated)
    except NoValidPlanError as error:
        raise ValueError(
            "live initial planning produced no deterministic policy-valid plan"
        ) from error

    canonical_before, replanning = canonical_snapshot(project, incident_id)
    analyzed, analyst_events = await captured(planner.analyze_recovery(replanning))
    traces.extend(analyst_events)
    replan, replan_events = await captured(
        planner.generate_replan_candidates(replanning, analyzed.analysis)
    )
    traces.extend(replan_events)
    recritique, recritic_events = await captured(
        planner.critique_replan(
            replanning,
            replan.candidates,
            planning_run_id=replan.planning_run_id,
        )
    )
    traces.extend(recritic_events)
    configuration = P1DConfiguration(
        repository=str(replanning.failed_recovery_effects[0].repository),
        workflow_id=replanning.failed_recovery_effects[0].workflow_id,
        workflow_path=replanning.failed_recovery_effects[0].workflow_path,
    )
    selection = deterministic_selection(
        incident_id="p2c-live-replan",
        candidates=replan.candidates,
        critiques=recritique,
        replanning_input=replanning,
        configuration=configuration,
    )
    if selection["result"] != "PLAN_SELECTED":
        raise ValueError("live replanning produced no deterministic policy-valid plan")
    canonical_after, _ = canonical_snapshot(project, incident_id)
    if canonical_before != canonical_after:
        raise ValueError("canonical incident changed during read-only qualification")

    candidate_shas = sorted(
        {
            parameter.value
            for candidate in replan.candidates.plans
            for action in candidate.actions
            for parameter in action.parameters
            if parameter.key == "candidate_sha"
        }
    )
    completed_ids: set[str] = {
        str(item["agent_id"])
        for item in traces
        if item.get("status") == "completed" and item.get("agent_id") is not None
    }
    if completed_ids != {item.value for item in AgentId}:
        raise ValueError(f"not all five agents completed: {sorted(completed_ids)}")

    return {
        "qualification_id": f"p2c-live-{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}",
        "created_at": datetime.now(UTC).isoformat(),
        "runtime": {
            "project": project,
            "location": os.environ.get("GOOGLE_CLOUD_LOCATION"),
            "vertex": os.environ.get("GOOGLE_GENAI_USE_VERTEXAI"),
            "model": "gemini-3.7-flash",
            "adk": "2.7.1",
        },
        "scenarios": {
            "irrelevant": {
                "classification": irrelevant.classification.value,
                "impact_call_count": 0,
                "usage": usage(irrelevant_result),
            },
            "canonical_disruption": {
                "classification": facts.classification.value,
                "event_type": facts.event_type,
                "mentioned_entity_count": len(facts.mentioned_entities),
                "grounded_excerpt_count": len(facts.grounded_excerpts),
                "candidate_node_ids": impact.candidate_node_ids,
                "interpreter": usage(facts_result),
                "impact_analyst": usage(impact_result),
            },
            "initial_recovery": {
                "candidate_count": len(generated.candidates.plans),
                "strategy_types": sorted(
                    item.strategy_type.value for item in generated.candidates.plans
                ),
                "valid_plan_count": sum(item.decision.is_valid for item in evaluated),
                "selected_plan_id": selected_initial.plan_id,
                "selected_strategy": selected_initial.strategy,
                "recovery_planner": {
                    "latency_ms": generated.planner_latency_ms,
                    "input_tokens": generated.input_tokens,
                    "output_tokens": generated.output_tokens,
                    "total_tokens": generated.total_tokens,
                },
                "risk_critic": {
                    "latency_ms": critiqued.critic_latency_ms,
                    "input_tokens": critiqued.input_tokens,
                    "output_tokens": critiqued.output_tokens,
                    "total_tokens": critiqued.total_tokens,
                },
            },
            "failed_recovery": {
                "failed_invariant": replanning.failed_invariant_id,
                "input_evidence_reference_count": len(analyzed.analysis.evidence_references),
                "failed_invariant_references": analyzed.analysis.failed_invariant_references,
                "exact_repeat_fingerprints": analyzed.analysis.exact_repeat_fingerprints,
                "material_change_count": len(analyzed.analysis.material_changes),
                "next_plan_constraint_count": len(analyzed.analysis.next_plan_constraints),
                "candidate_count": len(replan.candidates.plans),
                "candidate_shas": candidate_shas,
                "selection_result": selection["result"],
                "selected_plan_id": selection["selected_plan"]["plan_id"],
                "selected_candidate_sha": next(
                    action["parameters"]["candidate_sha"]
                    for action in selection["selected_plan"]["actions"]
                    if action["action_type"] == "github_release_validation"
                ),
                "recovery_analyst": {
                    "latency_ms": analyzed.analyst_latency_ms,
                    "input_tokens": analyzed.input_tokens,
                    "output_tokens": analyzed.output_tokens,
                    "total_tokens": analyzed.total_tokens,
                },
                "recovery_planner": {
                    "latency_ms": replan.planner_latency_ms,
                    "input_tokens": replan.input_tokens,
                    "output_tokens": replan.output_tokens,
                    "total_tokens": replan.total_tokens,
                },
                "risk_critic": {
                    "latency_ms": recritique.critic_latency_ms,
                    "input_tokens": recritique.input_tokens,
                    "output_tokens": recritique.output_tokens,
                    "total_tokens": recritique.total_tokens,
                },
            },
        },
        "aggregate_latency_ms": {
            "disruption_plus_impact": facts_result.latency_ms + impact_result.latency_ms,
            "initial_planning_plus_critique": generated.planner_latency_ms
            + critiqued.critic_latency_ms,
            "failed_analysis_plus_replanning_plus_critique": analyzed.analyst_latency_ms
            + replan.planner_latency_ms
            + recritique.critic_latency_ms,
        },
        "canonical_incident": canonical_before,
        "agent_trace": event_metadata(traces),
        "completed_agent_ids": sorted(completed_ids),
        "external_effects_executed": False,
    }


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project")
    parser.add_argument("--incident", default=DEFAULT_INCIDENT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    load_project_environment()
    project = args.project or os.environ.get("GOOGLE_CLOUD_PROJECT")
    if not project:
        raise RuntimeError("GOOGLE_CLOUD_PROJECT is required")
    result = await qualify(project, args.incident)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True), encoding="utf-8")
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    asyncio.run(main())
