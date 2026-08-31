"""Durable P1A orchestration around bounded ADK reasoning."""

from __future__ import annotations

import hashlib
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
    ReceiptStatus,
    RecoveryPlan,
)
from objective_recovery_agent.calendar_execution import (
    CalendarActionExecutor,
    CalendarExecutionFailure,
)
from objective_recovery_agent.ledger import WorkflowLedger
from objective_recovery_agent.objective_store import CANONICAL_OBJECTIVE, ObjectiveStore
from objective_recovery_agent.observability import OperationalEvent, emit_operational_event
from objective_recovery_agent.planning import PlanningPhaseError, pairwise_diversity
from objective_recovery_agent.recovery_outbox import (
    P1CContinuationPublisher,
    publish_p1c_handoff,
)
from objective_recovery_agent.schemas import (
    AssumptionState,
    CandidateGeneration,
    CandidateSet,
    CritiqueGeneration,
    DisruptionEvent,
    IncidentStage,
    PlanningInput,
    PlanningRun,
    RecoveryPlanCandidate,
    WorkflowEventType,
)
from objective_recovery_agent.world import build_policy_engine, planning_input


class PlanningService(Protocol):
    async def generate_candidates(self, planning_input: PlanningInput) -> CandidateGeneration: ...

    async def critique(
        self,
        candidates: CandidateSet,
        *,
        planning_run_id: str,
        event_id: str | None = None,
        incident_id: str | None = None,
    ) -> CritiqueGeneration: ...


class P1CContinuationPublishFailure(RuntimeError):
    """The durable P1C outbox exists but transport publication remains pending."""


@dataclass(frozen=True, slots=True)
class ProcessResult:
    incident_id: str
    deduplicated: bool
    in_progress: bool
    stage: IncidentStage
    selected_plan_id: str | None
    end_to_end_latency_ms: int


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
    def __init__(
        self,
        ledger: WorkflowLedger,
        planner: PlanningService,
        calendar_executor: CalendarActionExecutor | None = None,
        p1c_publisher: P1CContinuationPublisher | None = None,
        objective_store: ObjectiveStore | None = None,
    ) -> None:
        self._ledger = ledger
        self._planner = planner
        self._calendar_executor = calendar_executor
        self._p1c_publisher = p1c_publisher
        self._objective_store = objective_store

    async def process(self, disruption: DisruptionEvent, message_id: str) -> ProcessResult:
        started = time.perf_counter()
        try:
            claim = self._ledger.claim_event(disruption, message_id)
        except Exception as error:
            emit_operational_event(
                OperationalEvent.INCIDENT_CLAIM_FAILED,
                event_id=disruption.event_id,
                error_category=OperationalEvent.INCIDENT_CLAIM_FAILED.value,
                error_type=type(error).__name__,
            )
            raise
        if not claim.should_process:
            incident = self._ledger.load_incident(claim.incident_id)
            operational_event = (
                OperationalEvent.DUPLICATE_EVENT_SUPPRESSED
                if claim.deduplicated
                else OperationalEvent.EVENT_ALREADY_IN_PROGRESS
            )
            emit_operational_event(
                operational_event,
                event_id=disruption.event_id,
                incident_id=claim.incident_id,
                stage=incident.get("stage"),
                attempt=claim.attempt,
                latency_ms=int((time.perf_counter() - started) * 1000),
            )
            return ProcessResult(
                claim.incident_id,
                claim.deduplicated,
                not claim.deduplicated,
                IncidentStage(str(incident["stage"])),
                incident.get("selected_plan_id"),
                int((time.perf_counter() - started) * 1000),
            )

        try:
            result = await self._continue(
                claim.incident_id,
                disruption,
                attempt=claim.attempt,
                resumed=claim.resumed,
            )
        except CalendarExecutionFailure as error:
            failure_stage = (
                IncidentStage.EXECUTING if error.retryable else IncidentStage.PARTIAL_FAILURE
            )
            self._checkpoint(
                claim.incident_id,
                failure_stage,
                {
                    "status": "action_retryable" if error.retryable else "partial_failure",
                    "last_error_category": error.category,
                },
                event_id=disruption.event_id,
            )
            if error.retryable:
                self._ledger.release_claim(disruption.event_id, error.category)
                raise
            self._ledger.complete_claim(disruption.event_id)
            incident = self._ledger.load_incident(claim.incident_id)
            return ProcessResult(
                claim.incident_id,
                False,
                False,
                failure_stage,
                incident.get("selected_plan_id"),
                int((time.perf_counter() - started) * 1000),
            )
        except P1CContinuationPublishFailure as error:
            emit_operational_event(
                "P1C_CONTINUATION_PUBLISH_FAILED",
                event_id=disruption.event_id,
                incident_id=claim.incident_id,
                attempt=claim.attempt,
                error_type=(
                    type(error.__cause__).__name__ if error.__cause__ else type(error).__name__
                ),
            )
            self._ledger.release_claim(disruption.event_id, "p1c_continuation_publish")
            raise
        except Exception as error:
            error_category = (
                error.category.value
                if isinstance(error, PlanningPhaseError)
                else OperationalEvent.WORKFLOW_FAILED.value
            )
            emit_operational_event(
                OperationalEvent.WORKFLOW_FAILED,
                event_id=disruption.event_id,
                incident_id=claim.incident_id,
                attempt=claim.attempt,
                error_category=error_category,
                error_type=type(error).__name__,
            )
            try:
                self._ledger.record_event(
                    claim.incident_id,
                    WorkflowEventType.PLANNING_FAILED,
                    f"attempt-{claim.attempt}",
                    {
                        "attempt": claim.attempt,
                        "error_type": type(error).__name__,
                        "error_category": error_category,
                    },
                )
                self._checkpoint(
                    claim.incident_id,
                    IncidentStage.PLANNING_FAILED,
                    {
                        "status": "planning_failed",
                        "last_error_type": type(error).__name__,
                        "last_error_category": error_category,
                    },
                    event_id=disruption.event_id,
                )
                self._ledger.release_claim(disruption.event_id, error_category)
            except Exception:
                # The original exception remains authoritative; checkpoint failures log in
                # _checkpoint and Pub/Sub will retry the delivery.
                pass
            raise

        end_to_end_latency_ms = int((time.perf_counter() - started) * 1000)
        self._checkpoint(
            claim.incident_id,
            result.stage,
            {"end_to_end_latency_ms": end_to_end_latency_ms},
            event_id=disruption.event_id,
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

    def _checkpoint(
        self,
        incident_id: str,
        stage: IncidentStage,
        fields: dict[str, object],
        *,
        event_id: str,
    ) -> None:
        try:
            self._ledger.save_checkpoint(incident_id, stage, fields)
        except Exception as error:
            emit_operational_event(
                OperationalEvent.FIRESTORE_CHECKPOINT_FAILED,
                event_id=event_id,
                incident_id=incident_id,
                stage=stage.value,
                error_category=OperationalEvent.FIRESTORE_CHECKPOINT_FAILED.value,
                error_type=type(error).__name__,
            )
            raise

    async def _continue(
        self,
        incident_id: str,
        disruption: DisruptionEvent,
        *,
        attempt: int,
        resumed: bool,
    ) -> ProcessResult:
        incident = self._ledger.load_incident(incident_id)
        objective = (
            self._objective_store.load_objective(disruption.objective_id)
            if self._objective_store is not None
            else CANONICAL_OBJECTIVE
        )
        if (
            objective.objective_id != disruption.objective_id
            or objective.objective_version != disruption.objective_version
        ):
            raise ValueError("disruption does not match its persisted objective version")
        if resumed:
            emit_operational_event(
                OperationalEvent.WORKFLOW_RESUMED,
                event_id=disruption.event_id,
                incident_id=incident_id,
                stage=incident.get("stage"),
                attempt=attempt,
            )
            self._ledger.record_event(
                incident_id,
                WorkflowEventType.WORKFLOW_RESUMED,
                f"attempt-{attempt}",
                {"attempt": attempt, "resumed_from_stage": incident.get("stage")},
            )
        try:
            context = planning_input(incident_id, disruption, objective)
        except Exception as error:
            emit_operational_event(
                OperationalEvent.IMPACT_MAPPING_FAILED,
                event_id=disruption.event_id,
                incident_id=incident_id,
                attempt=attempt,
                error_category=OperationalEvent.IMPACT_MAPPING_FAILED.value,
                error_type=type(error).__name__,
            )
            raise

        if "canonical_event" not in incident:
            self._checkpoint(
                incident_id,
                IncidentStage.EVENT_INTERPRETED,
                {"status": "interpreting", "canonical_event": disruption.model_dump(mode="json")},
                event_id=disruption.event_id,
            )
            self._ledger.record_event(
                incident_id,
                WorkflowEventType.EVENT_INTERPRETED,
                disruption.event_id,
                {"schema": "DisruptionEvent", "source": disruption.source},
            )
            incident = self._ledger.load_incident(incident_id)

        if "impact" not in incident:
            impact = {
                "objective_id": context.objective_id,
                "affected_node_ids": context.affected_node_ids,
                "affected_node_labels": context.affected_node_labels,
            }
            self._checkpoint(
                incident_id,
                IncidentStage.IMPACT_MAPPED,
                {"status": "impact_mapped", "impact": impact},
                event_id=disruption.event_id,
            )
            self._ledger.record_event(
                incident_id,
                WorkflowEventType.IMPACT_MAPPED,
                context.objective_id,
                impact,
            )
            incident = self._ledger.load_incident(incident_id)

        if not incident.get("planning_started"):
            self._checkpoint(
                incident_id,
                IncidentStage.PLAN_GENERATION_STARTED,
                {"status": "planning", "planning_started": True},
                event_id=disruption.event_id,
            )
            self._ledger.record_event(
                incident_id,
                WorkflowEventType.PLAN_GENERATION_STARTED,
                "revision-0",
                {"model": "gemini-3.7-flash", "architecture": "single-diverse-bundle"},
            )
            incident = self._ledger.load_incident(incident_id)

        if "candidate_generation" in incident:
            candidate_generation = CandidateGeneration.model_validate(
                incident["candidate_generation"]
            )
        elif "planning_run" in incident:
            legacy_run = PlanningRun.model_validate(incident["planning_run"])
            candidate_generation = CandidateGeneration(
                planning_run_id=legacy_run.planning_run_id,
                candidates=legacy_run.candidates,
                planner_latency_ms=legacy_run.planner_latency_ms,
                total_tokens=legacy_run.total_tokens,
                input_tokens=legacy_run.input_tokens,
                output_tokens=legacy_run.output_tokens,
            )
        else:
            candidate_generation = await self._planner.generate_candidates(context)
            self._checkpoint(
                incident_id,
                IncidentStage.PLANS_GENERATED,
                {
                    "status": "planning",
                    "candidate_generation": candidate_generation.model_dump(mode="json"),
                    "diversity": pairwise_diversity(candidate_generation.candidates.plans),
                },
                event_id=disruption.event_id,
            )
            for created_candidate in candidate_generation.candidates.plans:
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

        if "planning_run" in incident:
            planning_run = PlanningRun.model_validate(incident["planning_run"])
        else:
            critique_generation = await self._planner.critique(
                candidate_generation.candidates,
                planning_run_id=candidate_generation.planning_run_id,
                event_id=disruption.event_id,
                incident_id=incident_id,
            )
            planning_run = PlanningRun(
                planning_run_id=candidate_generation.planning_run_id,
                candidates=candidate_generation.candidates,
                critiques=critique_generation.critiques,
                planner_latency_ms=candidate_generation.planner_latency_ms,
                critic_latency_ms=critique_generation.critic_latency_ms,
                total_tokens=candidate_generation.total_tokens + critique_generation.total_tokens,
                input_tokens=candidate_generation.input_tokens + critique_generation.input_tokens,
                output_tokens=candidate_generation.output_tokens
                + critique_generation.output_tokens,
            )
            self._checkpoint(
                incident_id,
                IncidentStage.PLANS_CRITIQUED,
                {
                    "status": "validating",
                    "planning_run": planning_run.model_dump(mode="json"),
                },
                event_id=disruption.event_id,
            )
            for critique in planning_run.critiques.critiques:
                self._ledger.record_event(
                    incident_id,
                    WorkflowEventType.RISK_CRITIQUE_COMPLETED,
                    critique.plan_id,
                    critique.model_dump(mode="json"),
                )

        critiques = {item.plan_id: item for item in planning_run.critiques.critiques}
        policy = build_policy_engine(datetime.fromisoformat(objective.deadline_at_utc))
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
            if decision.blocking_unknowns:
                blocking_details = {
                    "plan_id": plan.plan_id,
                    "blocking_unknowns": list(decision.blocking_unknowns),
                }
                self._ledger.record_event(
                    incident_id,
                    WorkflowEventType.BLOCKING_UNKNOWN,
                    plan.plan_id,
                    blocking_details,
                )
                emit_operational_event(
                    OperationalEvent.BLOCKING_UNKNOWN,
                    event_id=disruption.event_id,
                    incident_id=incident_id,
                    planning_run_id=planning_run.planning_run_id,
                    stage=IncidentStage.PLANS_CRITIQUED.value,
                    strategy_type=plan.strategy,
                )

        try:
            selected = select_best_valid_plan(evaluated)
        except NoValidPlanError:
            self._ledger.record_event(
                incident_id,
                WorkflowEventType.ALL_PLANS_INVALID,
                planning_run.planning_run_id,
                {"planning_run_id": planning_run.planning_run_id},
            )
            emit_operational_event(
                OperationalEvent.ALL_PLANS_INVALID,
                event_id=disruption.event_id,
                incident_id=incident_id,
                planning_run_id=planning_run.planning_run_id,
                stage=IncidentStage.NO_VALID_PLAN.value,
            )
            self._checkpoint(
                incident_id,
                IncidentStage.NO_VALID_PLAN,
                {"status": "replanning_required", "policy_decisions": decisions},
                event_id=disruption.event_id,
            )
            return ProcessResult(incident_id, False, False, IncidentStage.NO_VALID_PLAN, None, 0)

        self._checkpoint(
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
            event_id=disruption.event_id,
        )
        self._ledger.record_event(
            incident_id,
            WorkflowEventType.PLAN_SELECTED,
            selected.plan_id,
            {"plan_id": selected.plan_id, "strategy_type": selected.strategy},
        )
        emit_operational_event(
            OperationalEvent.PLAN_SELECTED,
            event_id=disruption.event_id,
            incident_id=incident_id,
            planning_run_id=planning_run.planning_run_id,
            stage=IncidentStage.PLAN_SELECTED.value,
            strategy_type=selected.strategy,
        )
        if self._calendar_executor is not None:
            self._checkpoint(
                incident_id,
                IncidentStage.EXECUTING,
                {"status": "executing", "selected_plan_id": selected.plan_id},
                event_id=disruption.event_id,
            )
            receipt = self._calendar_executor.execute_selected_plan(
                incident_id=incident_id,
                plan=selected,
                context=context,
            )
            receipt_event = (
                WorkflowEventType.ACTION_RECEIPT_VERIFIED
                if receipt.status is ReceiptStatus.VERIFIED
                else WorkflowEventType.ACTION_RECEIPT_VERIFICATION_FAILED
            )
            self._ledger.record_event(
                incident_id,
                receipt_event,
                receipt.receipt_id,
                {
                    "receipt_id": receipt.receipt_id,
                    "action_id": receipt.action_id,
                    "status": receipt.status.value,
                    "external_event_id": receipt.external_event_id,
                },
            )
            terminal_fields: dict[str, object] = {
                "status": "action_receipt_verified"
                if receipt.status is ReceiptStatus.VERIFIED
                else "action_receipt_verification_failed",
                "action_receipt_id": receipt.receipt_id,
                "action_receipt_status": receipt.status.value,
            }
            if receipt.status is ReceiptStatus.VERIFIED and self._p1c_publisher is not None:
                verified_effect = {
                    "receipt_id": receipt.receipt_id,
                    "idempotency_key": receipt.idempotency_key,
                    "external_event_id": receipt.external_event_id,
                    "observed_state": dict(receipt.observed_state),
                    "status": receipt.status.value,
                }
                fingerprint = hashlib.sha256(
                    json.dumps(
                        verified_effect, sort_keys=True, separators=(",", ":"), default=str
                    ).encode()
                ).hexdigest()
                handoff = self._ledger.persist_p1c_continuation(
                    incident_id, terminal_fields, fingerprint
                )
                try:
                    publish_p1c_handoff(self._ledger, self._p1c_publisher, handoff)
                except Exception as error:
                    raise P1CContinuationPublishFailure from error
            else:
                self._checkpoint(
                    incident_id,
                    IncidentStage.VERIFYING,
                    terminal_fields,
                    event_id=disruption.event_id,
                )
            return ProcessResult(
                incident_id,
                False,
                False,
                IncidentStage.VERIFYING,
                selected.plan_id,
                0,
            )
        return ProcessResult(
            incident_id, False, False, IncidentStage.PLAN_SELECTED, selected.plan_id, 0
        )
