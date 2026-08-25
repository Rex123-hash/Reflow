"""Durable P1A orchestration around bounded ADK reasoning."""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Protocol

from objective_recovery.application.selection import select_best_valid_plan
from objective_recovery.domain.actions import derive_idempotency_key
from objective_recovery.domain.errors import NoValidPlanError
from objective_recovery.domain.models import (
    Action,
    Assignment,
    AssumptionStatus,
    DeadlineChange,
    EvaluatedPlan,
    PlanAssumption,
    RecoveryPlan,
)
from objective_recovery_agent.ledger import WorkflowLedger
from objective_recovery_agent.planning import pairwise_diversity
from objective_recovery_agent.schemas import (
    AssumptionState,
    DisruptionEvent,
    IncidentStage,
    PlanningInput,
    PlanningRun,
    RecoveryPlanCandidate,
    WorkflowEventType,
)
from objective_recovery_agent.world import build_policy_engine, planning_input


class PlanningService(Protocol):
    async def generate(self, planning_input: PlanningInput) -> PlanningRun: ...


@dataclass(frozen=True, slots=True)
class ProcessResult:
    incident_id: str
    deduplicated: bool
    in_progress: bool
    stage: IncidentStage
    selected_plan_id: str | None
    end_to_end_latency_ms: int


_STAGE_ORDER = {stage: index for index, stage in enumerate(IncidentStage)}


def _at_least(document: dict[str, object], stage: IncidentStage) -> bool:
    current = IncidentStage(str(document["stage"]))
    return _STAGE_ORDER[current] >= _STAGE_ORDER[stage]


def _to_domain_plan(
    incident_id: str,
    candidate: RecoveryPlanCandidate,
    adjusted_risk_score: int,
    additional_risks: list[str],
) -> RecoveryPlan:
    actions = tuple(
        Action(
            action_id=action.action_id,
            action_type=action.action_type,
            target=action.target,
            parameters=tuple(sorted((item.key, item.value) for item in action.parameters)),
            idempotency_key=derive_idempotency_key(
                incident_id=incident_id,
                revision=0,
                action_type=action.action_type,
                target=action.target,
                desired_state=json.dumps(
                    {item.key: item.value for item in action.parameters}, sort_keys=True
                ),
            ),
        )
        for action in candidate.actions
    )
    assignments = tuple(
        Assignment(
            work_item_id=item.work_item_id,
            person_id=item.person_id,
            required_skills=frozenset(item.required_skills),
            projected_load_percent=Decimal(item.projected_load_percent),
        )
        for item in candidate.assignments
    )
    status_map = {
        AssumptionState.CONFIRMED: AssumptionStatus.CONFIRMED,
        AssumptionState.UNKNOWN: AssumptionStatus.UNKNOWN,
        AssumptionState.REJECTED: AssumptionStatus.REJECTED,
    }
    assumptions = [
        PlanAssumption(
            item.assumption_id,
            item.description,
            status_map[item.status],
            item.blocks_execution,
        )
        for item in candidate.assumptions
    ]
    assumptions.extend(
        PlanAssumption(
            item.unknown_id,
            item.description,
            AssumptionStatus.UNKNOWN,
            item.blocks_execution,
        )
        for item in candidate.unknowns
    )
    return RecoveryPlan(
        plan_id=candidate.plan_id,
        strategy=candidate.strategy_type.value,
        risk_score=Decimal(adjusted_risk_score),
        actions=actions,
        assignments=assignments,
        assumptions=tuple(assumptions),
        deadline_changes=tuple(
            DeadlineChange(item.commitment_id, datetime.fromisoformat(item.proposed_deadline))
            for item in candidate.deadline_changes
        ),
        expected_objective_effect=candidate.expected_objective_effect,
        risks=tuple([risk.summary for risk in candidate.risks] + additional_risks),
        required_evidence=tuple(candidate.required_evidence),
        unknowns=tuple(item.unknown_id for item in candidate.unknowns),
    )


class RecoveryOrchestrator:
    def __init__(self, ledger: WorkflowLedger, planner: PlanningService) -> None:
        self._ledger = ledger
        self._planner = planner

    async def process(self, disruption: DisruptionEvent, message_id: str) -> ProcessResult:
        started = time.perf_counter()
        claim = self._ledger.claim_event(disruption, message_id)
        if not claim.should_process:
            incident = self._ledger.load_incident(claim.incident_id)
            return ProcessResult(
                claim.incident_id,
                claim.deduplicated,
                not claim.deduplicated,
                IncidentStage(str(incident["stage"])),
                incident.get("selected_plan_id"),
                int((time.perf_counter() - started) * 1000),
            )

        try:
            result = await self._continue(claim.incident_id, disruption)
        except Exception as error:
            self._ledger.record_event(
                claim.incident_id,
                WorkflowEventType.PLANNING_FAILED,
                type(error).__name__,
                {"error_type": type(error).__name__, "summary": str(error)[:500]},
            )
            self._ledger.save_checkpoint(
                claim.incident_id,
                IncidentStage.PLANNING_FAILED,
                {"status": "planning_failed", "last_error": str(error)[:1000]},
            )
            self._ledger.release_claim(disruption.event_id, str(error))
            raise

        end_to_end_latency_ms = int((time.perf_counter() - started) * 1000)
        self._ledger.save_checkpoint(
            claim.incident_id,
            result.stage,
            {"end_to_end_latency_ms": end_to_end_latency_ms},
        )
        self._ledger.complete_claim(disruption.event_id)
        return ProcessResult(
            incident_id=claim.incident_id,
            deduplicated=False,
            in_progress=False,
            stage=result.stage,
            selected_plan_id=result.selected_plan_id,
            end_to_end_latency_ms=end_to_end_latency_ms,
        )

    async def _continue(self, incident_id: str, disruption: DisruptionEvent) -> ProcessResult:
        incident = self._ledger.load_incident(incident_id)
        context = planning_input(incident_id, disruption)

        if not _at_least(incident, IncidentStage.EVENT_INTERPRETED):
            self._ledger.save_checkpoint(
                incident_id,
                IncidentStage.EVENT_INTERPRETED,
                {"status": "interpreting", "canonical_event": disruption.model_dump(mode="json")},
            )
            self._ledger.record_event(
                incident_id,
                WorkflowEventType.EVENT_INTERPRETED,
                disruption.event_id,
                {"schema": "DisruptionEvent", "source": disruption.source},
            )
            incident = self._ledger.load_incident(incident_id)

        if not _at_least(incident, IncidentStage.IMPACT_MAPPED):
            impact = {
                "objective_id": context.objective_id,
                "affected_node_ids": context.affected_node_ids,
                "affected_node_labels": context.affected_node_labels,
            }
            self._ledger.save_checkpoint(
                incident_id,
                IncidentStage.IMPACT_MAPPED,
                {"status": "impact_mapped", "impact": impact},
            )
            self._ledger.record_event(
                incident_id,
                WorkflowEventType.IMPACT_MAPPED,
                context.objective_id,
                impact,
            )
            incident = self._ledger.load_incident(incident_id)

        if not _at_least(incident, IncidentStage.PLAN_GENERATION_STARTED):
            self._ledger.save_checkpoint(
                incident_id,
                IncidentStage.PLAN_GENERATION_STARTED,
                {"status": "planning"},
            )
            self._ledger.record_event(
                incident_id,
                WorkflowEventType.PLAN_GENERATION_STARTED,
                "revision-0",
                {"model": "gemini-3.7-flash", "architecture": "single-diverse-bundle"},
            )
            incident = self._ledger.load_incident(incident_id)

        # Durable output, not a terminal/error stage rank, proves the model call completed.
        # This lets a retry resume after policy/ledger failure without paying for another call.
        if "planning_run" not in incident:
            planning_run = await self._planner.generate(context)
            self._ledger.save_checkpoint(
                incident_id,
                IncidentStage.PLANS_GENERATED,
                {
                    "status": "planning",
                    "planning_run": planning_run.model_dump(mode="json"),
                    "diversity": pairwise_diversity(planning_run.candidates.plans),
                },
            )
            for created_candidate in planning_run.candidates.plans:
                self._ledger.record_event(
                    incident_id,
                    WorkflowEventType.PLAN_CREATED,
                    created_candidate.plan_id,
                    {
                        "plan_id": created_candidate.plan_id,
                        "strategy_type": created_candidate.strategy_type.value,
                    },
                )
            incident = self._ledger.load_incident(incident_id)

        planning_run = PlanningRun.model_validate(incident["planning_run"])
        if not _at_least(incident, IncidentStage.PLANS_CRITIQUED):
            self._ledger.save_checkpoint(
                incident_id,
                IncidentStage.PLANS_CRITIQUED,
                {"status": "validating"},
            )
            for critique in planning_run.critiques.critiques:
                self._ledger.record_event(
                    incident_id,
                    WorkflowEventType.RISK_CRITIQUE_COMPLETED,
                    critique.plan_id,
                    critique.model_dump(mode="json"),
                )

        critiques = {item.plan_id: item for item in planning_run.critiques.critiques}
        policy = build_policy_engine()
        evaluated: list[EvaluatedPlan] = []
        decisions: list[dict[str, object]] = []
        for candidate in planning_run.candidates.plans:
            critique = critiques[candidate.plan_id]
            plan = _to_domain_plan(
                incident_id,
                candidate,
                critique.adjusted_risk_score,
                critique.additional_risks,
            )
            decision = policy.evaluate(plan)
            evaluated.append(EvaluatedPlan(plan, decision))
            decision_data = {
                "plan_id": plan.plan_id,
                "is_valid": decision.is_valid,
                "violations": [item.message for item in decision.violations],
                "blocking_unknowns": list(decision.blocking_unknowns),
            }
            decisions.append(decision_data)
            if not decision.is_valid:
                self._ledger.record_event(
                    incident_id,
                    WorkflowEventType.PLAN_REJECTED,
                    plan.plan_id,
                    decision_data,
                )

        try:
            selected = select_best_valid_plan(evaluated)
        except NoValidPlanError:
            self._ledger.save_checkpoint(
                incident_id,
                IncidentStage.NO_VALID_PLAN,
                {"status": "replanning_required", "policy_decisions": decisions},
            )
            return ProcessResult(incident_id, False, False, IncidentStage.NO_VALID_PLAN, None, 0)

        self._ledger.save_checkpoint(
            incident_id,
            IncidentStage.PLAN_SELECTED,
            {
                "status": "plan_selected",
                "selected_plan_id": selected.plan_id,
                "selected_plan": {
                    "plan_id": selected.plan_id,
                    "strategy_type": selected.strategy,
                    "risk_score": str(selected.risk_score),
                    "actions": [
                        {
                            "action_id": action.action_id,
                            "action_type": action.action_type,
                            "target": action.target,
                            "parameters": dict(action.parameters),
                            "idempotency_key": action.idempotency_key,
                        }
                        for action in selected.actions
                    ],
                    "expected_objective_effect": selected.expected_objective_effect,
                    "risks": list(selected.risks),
                    "required_evidence": list(selected.required_evidence),
                },
                "policy_decisions": decisions,
            },
        )
        self._ledger.record_event(
            incident_id,
            WorkflowEventType.PLAN_SELECTED,
            selected.plan_id,
            {"plan_id": selected.plan_id, "strategy_type": selected.strategy},
        )
        return ProcessResult(
            incident_id, False, False, IncidentStage.PLAN_SELECTED, selected.plan_id, 0
        )
