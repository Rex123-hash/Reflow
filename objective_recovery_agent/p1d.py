"""P1D autonomous reopen, replan, second recovery, shipping, and closure."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Any, Protocol, cast

from objective_recovery.application.selection import select_best_valid_plan
from objective_recovery.domain.actions import derive_idempotency_key
from objective_recovery.domain.errors import NoValidPlanError
from objective_recovery.domain.models import (
    Action,
    Assignment,
    AssumptionStatus,
    DeadlineChange,
    EvaluatedPlan,
    EvidenceKind,
    IncidentStatus,
    InvariantObservation,
    ObjectiveInvariant,
    PlanAssumption,
    PolicyViolation,
    ReceiptStatus,
    RecoveryPlan,
)
from objective_recovery.domain.policy import (
    FailedRecoveryRepeatPolicy,
    PolicyEngine,
    ProtectedDeadlinePolicy,
    recovery_effect_fingerprint,
)
from objective_recovery.domain.state_machine import Incident
from objective_recovery.domain.verification import DeterministicObjectiveVerifier
from objective_recovery_agent.calendar_contract import (
    ActionRisk,
    CalendarActionIntent,
    CalendarDesiredState,
)
from objective_recovery_agent.calendar_execution import CalendarExecutionService
from objective_recovery_agent.github_contract import GitHubReleaseIntent
from objective_recovery_agent.github_execution import (
    GitHubP1CService,
    GitHubP1DPromotionService,
    P1CState,
)
from objective_recovery_agent.github_ledger import GitHubActionLedger
from objective_recovery_agent.ledger import WorkflowLedger
from objective_recovery_agent.objective_store import ObjectiveStore
from objective_recovery_agent.p1d_store import P1DStore
from objective_recovery_agent.planning import MODEL_ID
from objective_recovery_agent.schemas import (
    AssumptionState,
    CandidateGeneration,
    CandidateSet,
    CritiqueGeneration,
    FailedRecoveryEffect,
    IncidentStage,
    P1DContinuation,
    RecoveryAnalysis,
    RecoveryAnalysisGeneration,
    RecoveryPlanCandidate,
    ReplanningInput,
    WorkflowEventType,
)
from objective_recovery_agent.world import RESOURCES, objective_graph_snapshot

PLAN_REVISION = 2
FAILED_CANDIDATE_A = "5353cf7c664f384d6642b5348c7f190187b06b4c"
REQUIRED_COMPATIBILITY_STEP = "Validate release compatibility"


class P1DState(StrEnum):
    PENDING = "pending"
    NO_VALID_PLAN = "no_valid_plan"
    RECOVERY_FAILED = "recovery_failed"
    RESOLVED = "resolved"


@dataclass(frozen=True, slots=True)
class P1DResult:
    incident_id: str
    state: P1DState
    stage: str
    selected_plan_id: str | None = None
    release_id: int | None = None


@dataclass(frozen=True, slots=True)
class P1DConfiguration:
    repository: str
    workflow_id: int
    workflow_path: str


class P1DPlanningService(Protocol):
    async def analyze_recovery(
        self, replanning_input: ReplanningInput
    ) -> RecoveryAnalysisGeneration: ...

    async def generate_replan_candidates(
        self,
        replanning_input: ReplanningInput,
        recovery_analysis: RecoveryAnalysis,
    ) -> CandidateGeneration: ...

    async def critique_replan(
        self,
        replanning_input: ReplanningInput,
        candidates: CandidateSet,
        *,
        planning_run_id: str,
    ) -> CritiqueGeneration: ...


def _canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)


def replanning_input_fingerprint(value: ReplanningInput) -> str:
    return hashlib.sha256(value.model_dump_json().encode()).hexdigest()


def plan_semantic_fingerprint(candidate: RecoveryPlanCandidate) -> str:
    data = candidate.model_dump(mode="json")
    data.pop("plan_id", None)
    data.pop("risks", None)
    return hashlib.sha256(_canonical(data).encode()).hexdigest()


def _domain_plan(incident_id: str, candidate: RecoveryPlanCandidate, risk: int) -> RecoveryPlan:
    semantic = plan_semantic_fingerprint(candidate)
    actions: list[Action] = []
    for proposed in candidate.actions:
        parameters = {item.key: item.value for item in proposed.parameters}
        parameters["selected_plan_semantic_fingerprint"] = semantic
        desired = _canonical(
            {
                "incident_id": incident_id,
                "plan_revision": PLAN_REVISION,
                "plan_semantic_fingerprint": semantic,
                "repository": proposed.target,
                **parameters,
            }
        )
        key = derive_idempotency_key(
            incident_id=incident_id,
            revision=PLAN_REVISION,
            action_type=proposed.action_type,
            target=proposed.target,
            desired_state=desired,
        )
        actions.append(
            Action(
                action_id=f"p1d-{proposed.action_type}-{key[:16]}",
                action_type=proposed.action_type,
                target=proposed.target,
                parameters=tuple(sorted(parameters.items())),
                idempotency_key=key,
            )
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
        risk_score=Decimal(risk),
        actions=tuple(actions),
        assignments=tuple(
            Assignment(
                item.work_item_id,
                item.person_id,
                frozenset(item.required_skills),
                Decimal(item.projected_load_percent),
            )
            for item in candidate.assignments
        ),
        assumptions=tuple(assumptions),
        deadline_changes=tuple(
            DeadlineChange(item.commitment_id, datetime.fromisoformat(item.proposed_deadline))
            for item in candidate.deadline_changes
        ),
        expected_objective_effect=candidate.expected_objective_effect,
        risks=tuple(item.summary for item in candidate.risks),
        required_evidence=tuple(candidate.required_evidence),
        unknowns=tuple(item.unknown_id for item in candidate.unknowns),
    )


class ExecutableRecoveryPolicy:
    rule_id = "p1d_executable_artifact"

    def __init__(
        self,
        *,
        available: set[tuple[str, str]],
        configuration: P1DConfiguration,
    ) -> None:
        self._available = available
        self._configuration = configuration

    def evaluate(self, plan: RecoveryPlan) -> tuple[PolicyViolation, ...]:
        github_actions = [
            action for action in plan.actions if action.action_type == "github_release_validation"
        ]
        if len(github_actions) != 1:
            return (
                PolicyViolation(
                    self.rule_id,
                    "recovery must contain exactly one supported GitHub validation action",
                ),
            )
        action = github_actions[0]
        parameters = dict(action.parameters)
        violations: list[PolicyViolation] = []
        candidate_sha = parameters.get("candidate_sha", "")
        if (action.target, candidate_sha) not in self._available:
            violations.append(
                PolicyViolation(self.rule_id, "candidate is not an AVAILABLE immutable artifact")
            )
        if action.target != self._configuration.repository:
            violations.append(PolicyViolation(self.rule_id, "repository is not authorized"))
        if parameters.get("workflow_id") != str(self._configuration.workflow_id):
            violations.append(PolicyViolation(self.rule_id, "workflow ID is not authorized"))
        if parameters.get("workflow_path") != self._configuration.workflow_path:
            violations.append(PolicyViolation(self.rule_id, "workflow path is not authorized"))
        if parameters.get("invariant_id") != "release-validation-green":
            violations.append(PolicyViolation(self.rule_id, "intended invariant is unsupported"))
        return tuple(violations)


def evaluate_replan_candidates(
    *,
    incident_id: str,
    candidates: CandidateSet,
    critiques: CritiqueGeneration,
    replanning_input: ReplanningInput,
    configuration: P1DConfiguration,
) -> tuple[list[EvaluatedPlan], list[dict[str, Any]]]:
    critique_by_id = {item.plan_id: item for item in critiques.critiques.critiques}
    available = {
        (artifact.repository, artifact.candidate_sha)
        for artifact in replanning_input.available_recovery_artifacts
        if artifact.state == "AVAILABLE"
    }
    failed = {
        effect.fingerprint: effect.failed_invariant_id
        for effect in replanning_input.failed_recovery_effects
    }
    deadline = datetime.fromisoformat(replanning_input.objective.deadline_at_utc)
    engine = PolicyEngine(
        (
            ProtectedDeadlinePolicy({"commit-release": deadline}),
            FailedRecoveryRepeatPolicy(failed),
            ExecutableRecoveryPolicy(available=available, configuration=configuration),
        )
    )
    evaluated: list[EvaluatedPlan] = []
    decisions: list[dict[str, Any]] = []
    for candidate in candidates.plans:
        critique = critique_by_id[candidate.plan_id]
        plan = _domain_plan(incident_id, candidate, critique.adjusted_risk_score)
        decision = engine.evaluate(plan)
        evaluated.append(EvaluatedPlan(plan, decision))
        decisions.append(
            {
                "plan_id": plan.plan_id,
                "is_valid": decision.is_valid,
                "violations": [
                    {"rule_id": item.rule_id, "message": item.message}
                    for item in decision.violations
                ],
                "blocking_unknowns": list(decision.blocking_unknowns),
            }
        )
    return evaluated, decisions


def _plan_dict(plan: RecoveryPlan) -> dict[str, Any]:
    github_action = next(
        (action for action in plan.actions if action.action_type == "github_release_validation"),
        None,
    )
    return {
        "plan_id": plan.plan_id,
        "strategy_type": plan.strategy,
        "risk_score": str(plan.risk_score),
        "semantic_fingerprint": (
            dict(github_action.parameters).get("selected_plan_semantic_fingerprint")
            if github_action is not None
            else None
        ),
        "actions": [
            {
                "action_id": action.action_id,
                "action_type": action.action_type,
                "target": action.target,
                "parameters": dict(action.parameters),
                "idempotency_key": action.idempotency_key,
            }
            for action in plan.actions
        ],
        "expected_objective_effect": plan.expected_objective_effect,
        "risks": list(plan.risks),
        "required_evidence": list(plan.required_evidence),
    }


def deterministic_selection(
    *,
    incident_id: str,
    candidates: CandidateSet,
    critiques: CritiqueGeneration,
    replanning_input: ReplanningInput,
    configuration: P1DConfiguration,
) -> dict[str, Any]:
    """Select from persisted model output using the versioned deterministic policy."""
    evaluated, decisions = evaluate_replan_candidates(
        incident_id=incident_id,
        candidates=candidates,
        critiques=critiques,
        replanning_input=replanning_input,
        configuration=configuration,
    )
    try:
        selected = select_best_valid_plan(evaluated)
    except NoValidPlanError:
        return {
            "result": "NO_VALID_PLAN",
            "policy_decisions": decisions,
            "policy_version": "p1d-executable-v2",
        }
    github_actions = [
        action for action in selected.actions if action.action_type == "github_release_validation"
    ]
    if len(github_actions) != 1:
        raise AssertionError("valid selected plan lacks one GitHub validation action")
    action = github_actions[0]
    parameters = dict(action.parameters)
    selected_fingerprint = recovery_effect_fingerprint(
        action_type=action.action_type,
        repository=action.target,
        candidate_sha=parameters["candidate_sha"],
        workflow_id=parameters["workflow_id"],
        workflow_path=parameters["workflow_path"],
    )
    failed_fingerprints = {item.fingerprint for item in replanning_input.failed_recovery_effects}
    if selected_fingerprint in failed_fingerprints:
        raise AssertionError("failed recovery fingerprint survived final selection")
    return {
        "result": "PLAN_SELECTED",
        "selected_plan": _plan_dict(selected),
        "selected_effect_fingerprint": selected_fingerprint,
        "policy_decisions": decisions,
        "policy_version": "p1d-executable-v2",
    }


def build_replanning_input(
    *,
    incident: dict[str, Any],
    objective_store: ObjectiveStore,
    p1d_store: P1DStore,
) -> ReplanningInput:
    objective_id = str(incident.get("objective_id", "release-v2"))
    objective_version = int(incident.get("objective_version", 1))
    objective = objective_store.load_objective(objective_id)
    if objective.objective_version != objective_version:
        raise ValueError("incident objective version does not match persisted authority")
    artifacts = objective_store.list_available_artifacts(objective.objective_id)
    if not artifacts and objective.objective_id != "release-v2":
        artifacts = objective_store.list_available_artifacts("release-v2")
    calendar_claim, calendar_receipt = p1d_store.load_action_evidence(
        str(incident["action_receipt_id"])
    )
    github_claim, github_receipt = p1d_store.load_action_evidence(
        str(incident["github_action_receipt_id"])
    )
    evidence = dict(incident["github_evidence"])
    verification = dict(incident["github_verification"])
    selected_plan_id = str(incident["selected_plan_id"])
    planning_run = dict(incident.get("planning_run", {}))
    candidate_values = dict(planning_run.get("candidates", {})).get("plans", [])
    previous_candidate = next(
        (
            dict(item)
            for item in candidate_values
            if isinstance(item, dict) and item.get("plan_id") == selected_plan_id
        ),
        {},
    )
    critiques = dict(planning_run.get("critiques", {})).get("critiques", [])
    failed_sha = str(evidence.get("tag_sha") or evidence.get("head_sha") or FAILED_CANDIDATE_A)
    workflow_id = int(evidence["workflow_id"])
    workflow_path = str(evidence["workflow_path"])
    failed_effect = recovery_effect_fingerprint(
        action_type="github_release_validation",
        repository=str(evidence["repository"]),
        candidate_sha=failed_sha,
        workflow_id=str(workflow_id),
        workflow_path=workflow_path,
    )
    return ReplanningInput(
        incident_id=str(incident["incident_id"]),
        plan_revision=PLAN_REVISION,
        objective=objective,
        objective_invariants=[
            "coordination-action-preserved",
            "active-release-candidate-revised",
            "release-validation-green",
            "shipped-full-release",
            "external-correlation-fresh",
            "protected-release-deadline-satisfied",
        ],
        objective_graph=objective_graph_snapshot(objective),
        resources=list(RESOURCES),
        allowed_work_item_ids=[
            "work-api-migration",
            "work-api-tests",
            "work-release-notes",
        ],
        allowed_commitment_ids=["commit-release"],
        previous_selected_plan=dict(incident.get("selected_plan", {})),
        previous_plan_assumptions=list(previous_candidate.get("assumptions", [])),
        previous_plan_unknowns=list(previous_candidate.get("unknowns", [])),
        previous_critic_findings=[
            dict(item)
            for item in critiques
            if isinstance(item, dict) and item.get("plan_id") == selected_plan_id
        ],
        previous_policy_result=list(incident.get("policy_decisions", [])),
        calendar_action_claim=calendar_claim,
        calendar_receipt=calendar_receipt,
        github_action_claim=github_claim,
        github_receipt=github_receipt,
        failed_candidate_sha=failed_sha,
        failed_release={
            key: evidence.get(key)
            for key in ("release_id", "release_tag", "release_url", "published_at", "tag_sha")
        },
        failed_run={
            key: evidence.get(key)
            for key in (
                "run_id",
                "run_number",
                "run_attempt",
                "workflow_id",
                "workflow_path",
                "status",
                "conclusion",
                "run_url",
            )
        },
        failed_jobs=[dict(item) for item in evidence.get("jobs", [])],
        failed_invariant_id="release-validation-green",
        verification_timestamps=[
            str(value)
            for value in (
                evidence.get("read_back_at"),
                evidence.get("completed_at"),
                verification.get("observed_at"),
            )
            if value
        ],
        exact_external_evidence={"github": evidence, "verification": verification},
        failed_recovery_effects=[
            FailedRecoveryEffect(
                action_type="github_release_validation",
                repository=str(evidence["repository"]),
                candidate_sha=failed_sha,
                workflow_id=workflow_id,
                workflow_path=workflow_path,
                failed_invariant_id="release-validation-green",
                fingerprint=failed_effect,
            )
        ],
        available_recovery_artifacts=list(artifacts),
        recovery_one_accomplished=[
            "Calendar coordination action remained independently VERIFIED.",
            "Candidate A prerelease was created and read back exactly.",
            "Candidate A validation action receipt was independently VERIFIED.",
        ],
        remaining_broken=[
            "The unchanged release compatibility validation failed for Candidate A.",
            "Release V2 is not yet a latest full release.",
        ],
        unhealthy_reason=(
            "Recovery #1 executed successfully, but external GitHub evidence proves the "
            "release-validation-green invariant is false."
        ),
        policy_summary=[
            "Reject an exact repeat of a historically failed objective effect.",
            "Use only AVAILABLE immutable recovery artifacts.",
            "Do not move the persisted protected deadline later.",
            "Any blocking unknown makes a candidate invalid.",
            "Selection is stable by risk, action count, then plan ID.",
        ],
    )


def _validation_intent(
    incident_id: str,
    plan: RecoveryPlan,
    configuration: P1DConfiguration,
) -> GitHubReleaseIntent:
    github_actions = [
        action for action in plan.actions if action.action_type == "github_release_validation"
    ]
    if len(github_actions) != 1:
        raise ValueError("selected P1D plan lacks one exact GitHub validation action")
    action = github_actions[0]
    parameters = dict(action.parameters)
    return GitHubReleaseIntent(
        incident_id=incident_id,
        plan_id=plan.plan_id,
        plan_revision=PLAN_REVISION,
        action=action,
        repository=configuration.repository,
        candidate_sha=parameters["candidate_sha"],
        workflow_id=configuration.workflow_id,
        workflow_path=configuration.workflow_path,
        invariant_id="release-validation-green",
        tag_prefix="reflow-p1d",
    )


def _promotion_intent(validation: GitHubReleaseIntent, release_id: int) -> GitHubReleaseIntent:
    desired = _canonical(
        {
            "incident_id": validation.incident_id,
            "plan_revision": PLAN_REVISION,
            "repository": validation.repository,
            "candidate_sha": validation.candidate_sha,
            "release_id": release_id,
            "release_tag": validation.tag,
            "draft": False,
            "prerelease": False,
            "make_latest": "true",
        }
    )
    key = derive_idempotency_key(
        incident_id=validation.incident_id,
        revision=PLAN_REVISION,
        action_type="github_release_promotion",
        target=validation.repository,
        desired_state=desired,
    )
    action = Action(
        action_id=f"p1d-promote-{key[:16]}",
        action_type="github_release_promotion",
        target=validation.repository,
        parameters=tuple(
            sorted(
                {
                    "candidate_sha": validation.candidate_sha,
                    "make_latest": "true",
                    "release_id": str(release_id),
                    "release_tag": validation.tag,
                }.items()
            )
        ),
        idempotency_key=key,
    )
    return GitHubReleaseIntent(
        incident_id=validation.incident_id,
        plan_id=validation.plan_id,
        plan_revision=PLAN_REVISION,
        action=action,
        repository=validation.repository,
        candidate_sha=validation.candidate_sha,
        workflow_id=validation.workflow_id,
        workflow_path=validation.workflow_path,
        invariant_id="shipped-full-release",
        tag_prefix="reflow-p1d",
        tag_override=validation.tag,
    )


def _calendar_intent(claim: dict[str, Any]) -> CalendarActionIntent:
    raw = dict(claim["intent"])
    action_data = dict(raw["action"])
    parameters = action_data.get("parameters", {})
    if isinstance(parameters, dict):
        parameter_values = tuple(
            sorted((str(key), str(value)) for key, value in parameters.items())
        )
    else:
        parameter_values = tuple(tuple(item) for item in parameters)
    raw["action"] = Action(
        action_id=str(action_data["action_id"]),
        action_type=str(action_data["action_type"]),
        target=str(action_data["target"]),
        parameters=parameter_values,
        idempotency_key=str(action_data["idempotency_key"]),
    )
    raw["desired"] = CalendarDesiredState.model_validate(raw["desired"])
    raw["risk"] = ActionRisk(str(raw["risk"]))
    return CalendarActionIntent.model_validate(raw)


def _verification_dict(result: Any) -> dict[str, Any]:
    return {
        "objective_id": result.objective_id,
        "passed": result.passed,
        "observed_at": result.observed_at.isoformat(),
        "checks": [
            {
                "invariant_id": check.invariant_id,
                "passed": check.passed,
                "reason": check.reason,
                "evidence_kind": check.evidence_kind.value,
                "source_reference": check.source_reference,
            }
            for check in result.checks
        ],
    }


class P1DService:
    def __init__(
        self,
        *,
        store: P1DStore,
        workflow: WorkflowLedger,
        objective_store: ObjectiveStore,
        planner: P1DPlanningService,
        github_validation: GitHubP1CService,
        github_promotion: GitHubP1DPromotionService,
        github_ledger: GitHubActionLedger,
        calendar: CalendarExecutionService,
        configuration: P1DConfiguration,
    ) -> None:
        self._store = store
        self._workflow = workflow
        self._objective_store = objective_store
        self._planner = planner
        self._github_validation = github_validation
        self._github_promotion = github_promotion
        self._github_ledger = github_ledger
        self._calendar = calendar
        self._configuration = configuration

    async def advance(self, handoff: P1DContinuation) -> P1DResult:
        incident = self._store.load_incident(handoff.incident_id)
        if incident.get("stage") == "RESOLVED" and incident.get("status") == "objective_restored":
            return P1DResult(handoff.incident_id, P1DState.RESOLVED, "RESOLVED")
        self._store.reopen(handoff)
        self._workflow.record_event(
            handoff.incident_id,
            WorkflowEventType.INCIDENT_REOPENED,
            handoff.handoff_id,
            {"plan_revision": PLAN_REVISION, "handoff_id": handoff.handoff_id},
        )
        incident = self._store.load_incident(handoff.incident_id)
        revision = self._store.load_revision(handoff.incident_id)

        if "replanning_input" not in revision:
            replanning_input = build_replanning_input(
                incident=incident,
                objective_store=self._objective_store,
                p1d_store=self._store,
            )
            self._store.checkpoint(
                handoff.incident_id,
                "replanning_input",
                {
                    "fingerprint": replanning_input_fingerprint(replanning_input),
                    "context": replanning_input.model_dump(mode="json"),
                },
            )
            self._workflow.record_event(
                handoff.incident_id,
                WorkflowEventType.REPLAN_STARTED,
                "revision-2",
                {"input_fingerprint": replanning_input_fingerprint(replanning_input)},
            )
            revision = self._store.load_revision(handoff.incident_id)
        replanning_input = ReplanningInput.model_validate(revision["replanning_input"]["context"])

        if "planner_checkpoint" not in revision:
            if "recovery_analysis" not in revision:
                claim = self._store.claim_phase(handoff.incident_id, "recovery_analysis")
                if claim == "busy":
                    return P1DResult(handoff.incident_id, P1DState.PENDING, "REPLANNING")
                if claim == "acquired":
                    try:
                        analyzed = await self._planner.analyze_recovery(replanning_input)
                        self._store.checkpoint(
                            handoff.incident_id,
                            "recovery_analysis",
                            analyzed.model_dump(mode="json"),
                        )
                    except Exception as error:
                        self._store.release_phase(
                            handoff.incident_id, "recovery_analysis", type(error).__name__
                        )
                        raise
                revision = self._store.load_revision(handoff.incident_id)
            recovery_analysis = RecoveryAnalysisGeneration.model_validate(
                revision["recovery_analysis"]
            ).analysis
            claim = self._store.claim_phase(handoff.incident_id, "planner_checkpoint")
            if claim == "busy":
                return P1DResult(handoff.incident_id, P1DState.PENDING, "REPLANNING")
            if claim == "acquired":
                try:
                    generated = await self._planner.generate_replan_candidates(
                        replanning_input, recovery_analysis
                    )
                    self._store.checkpoint(
                        handoff.incident_id,
                        "planner_checkpoint",
                        generated.model_dump(mode="json"),
                    )
                except Exception as error:
                    self._store.release_phase(
                        handoff.incident_id, "planner_checkpoint", type(error).__name__
                    )
                    raise
                self._workflow.record_event(
                    handoff.incident_id,
                    WorkflowEventType.PLANNER_CHECKPOINTED,
                    generated.planning_run_id,
                    {"model": MODEL_ID, "candidate_count": len(generated.candidates.plans)},
                )
            revision = self._store.load_revision(handoff.incident_id)
        generated = CandidateGeneration.model_validate(revision["planner_checkpoint"])

        if "critic_checkpoint" not in revision:
            claim = self._store.claim_phase(handoff.incident_id, "critic_checkpoint")
            if claim == "busy":
                return P1DResult(handoff.incident_id, P1DState.PENDING, "REPLANNING")
            if claim == "acquired":
                try:
                    critiqued = await self._planner.critique_replan(
                        replanning_input,
                        generated.candidates,
                        planning_run_id=generated.planning_run_id,
                    )
                    domain = Incident(
                        handoff.incident_id,
                        replanning_input.objective.objective_id,
                        IncidentStatus.REPLANNING,
                        PLAN_REVISION,
                        [IncidentStatus.REPLANNING],
                    )
                    domain.transition_to(IncidentStatus.VALIDATING)
                    self._store.checkpoint(
                        handoff.incident_id,
                        "critic_checkpoint",
                        critiqued.model_dump(mode="json"),
                        stage=IncidentStage.VALIDATING,
                        status="validating",
                    )
                except Exception as error:
                    self._store.release_phase(
                        handoff.incident_id, "critic_checkpoint", type(error).__name__
                    )
                    raise
                self._workflow.record_event(
                    handoff.incident_id,
                    WorkflowEventType.CRITIC_CHECKPOINTED,
                    generated.planning_run_id,
                    {"model": MODEL_ID, "critique_count": len(critiqued.critiques.critiques)},
                )
            revision = self._store.load_revision(handoff.incident_id)
        critiqued = CritiqueGeneration.model_validate(revision["critic_checkpoint"])

        if "selection" not in revision:
            selection = deterministic_selection(
                incident_id=handoff.incident_id,
                candidates=generated.candidates,
                critiques=critiqued,
                replanning_input=replanning_input,
                configuration=self._configuration,
            )
            self._workflow.record_event(
                handoff.incident_id,
                WorkflowEventType.POLICY_EVALUATED,
                generated.planning_run_id,
                {
                    "decisions": selection["policy_decisions"],
                    "policy_version": selection["policy_version"],
                },
            )
            if selection["result"] == "NO_VALID_PLAN":
                self._store.checkpoint(
                    handoff.incident_id,
                    "selection",
                    selection,
                    stage=IncidentStage.NO_VALID_PLAN,
                    status="no_valid_plan",
                )
                return P1DResult(handoff.incident_id, P1DState.NO_VALID_PLAN, "NO_VALID_PLAN")
            domain = Incident(
                handoff.incident_id,
                replanning_input.objective.objective_id,
                IncidentStatus.VALIDATING,
                PLAN_REVISION,
                [IncidentStatus.VALIDATING],
            )
            domain.transition_to(IncidentStatus.PLAN_SELECTED)
            self._store.checkpoint(
                handoff.incident_id,
                "selection",
                selection,
                stage=IncidentStage.PLAN_SELECTED,
                status="plan_selected",
            )
            selected_data = cast(dict[str, Any], selection["selected_plan"])
            selected_actions = cast(list[dict[str, Any]], selected_data["actions"])
            github_action = next(
                action
                for action in selected_actions
                if action["action_type"] == "github_release_validation"
            )
            self._workflow.record_event(
                handoff.incident_id,
                WorkflowEventType.RECOVERY_SELECTED,
                str(selected_data["plan_id"]),
                {
                    "plan_id": selected_data["plan_id"],
                    "candidate_sha": github_action["parameters"]["candidate_sha"],
                },
            )
            revision = self._store.load_revision(handoff.incident_id)
        selection = dict(revision["selection"])
        if selection.get("result") == "NO_VALID_PLAN" and "policy_version" not in selection:
            if "selection_reassessment" not in revision:
                reassessment = deterministic_selection(
                    incident_id=handoff.incident_id,
                    candidates=generated.candidates,
                    critiques=critiqued,
                    replanning_input=replanning_input,
                    configuration=self._configuration,
                )
                self._workflow.record_event(
                    handoff.incident_id,
                    WorkflowEventType.POLICY_EVALUATED,
                    f"{generated.planning_run_id}:selection-reassessment",
                    {
                        "decisions": reassessment["policy_decisions"],
                        "policy_version": reassessment["policy_version"],
                        "reused_persisted_planner_and_critic": True,
                    },
                )
                stage = (
                    IncidentStage.PLAN_SELECTED
                    if reassessment["result"] == "PLAN_SELECTED"
                    else IncidentStage.NO_VALID_PLAN
                )
                status = (
                    "plan_selected"
                    if reassessment["result"] == "PLAN_SELECTED"
                    else "no_valid_plan"
                )
                self._store.checkpoint(
                    handoff.incident_id,
                    "selection_reassessment",
                    reassessment,
                    stage=stage,
                    status=status,
                )
                if reassessment["result"] == "PLAN_SELECTED":
                    selected_data = cast(dict[str, Any], reassessment["selected_plan"])
                    selected_actions = cast(list[dict[str, Any]], selected_data["actions"])
                    github_action = next(
                        action
                        for action in selected_actions
                        if action["action_type"] == "github_release_validation"
                    )
                    self._workflow.record_event(
                        handoff.incident_id,
                        WorkflowEventType.RECOVERY_SELECTED,
                        f"{selected_data['plan_id']}:selection-reassessment",
                        {
                            "plan_id": selected_data["plan_id"],
                            "candidate_sha": github_action["parameters"]["candidate_sha"],
                            "reused_persisted_planner_and_critic": True,
                        },
                    )
                revision = self._store.load_revision(handoff.incident_id)
            selection = dict(revision["selection_reassessment"])
        if selection.get("result") == "NO_VALID_PLAN":
            return P1DResult(handoff.incident_id, P1DState.NO_VALID_PLAN, "NO_VALID_PLAN")
        selected_data = cast(dict[str, Any], selection["selected_plan"])
        selected_actions = cast(list[dict[str, Any]], selected_data["actions"])
        selected = RecoveryPlan(
            plan_id=str(selected_data["plan_id"]),
            strategy=str(selected_data["strategy_type"]),
            risk_score=Decimal(str(selected_data["risk_score"])),
            actions=tuple(
                Action(
                    str(selected_action["action_id"]),
                    str(selected_action["action_type"]),
                    str(selected_action["target"]),
                    tuple(sorted(dict(selected_action["parameters"]).items())),
                    str(selected_action["idempotency_key"]),
                )
                for selected_action in selected_actions
            ),
        )
        validation_intent = _validation_intent(handoff.incident_id, selected, self._configuration)

        incident = self._store.load_incident(handoff.incident_id)
        if incident.get("stage") == "RESOLVED":
            return P1DResult(handoff.incident_id, P1DState.RESOLVED, "RESOLVED")
        if "execution_started" not in revision:
            domain = Incident(
                handoff.incident_id,
                replanning_input.objective.objective_id,
                IncidentStatus.PLAN_SELECTED,
                PLAN_REVISION,
                [IncidentStatus.PLAN_SELECTED],
            )
            domain.transition_to(IncidentStatus.EXECUTING)
            self._store.checkpoint(
                handoff.incident_id,
                "execution_started",
                {
                    "validation_action_id": validation_intent.action.action_id,
                    "validation_idempotency_key": validation_intent.action.idempotency_key,
                    "tag": validation_intent.tag,
                },
                stage=IncidentStage.EXECUTING,
                status="executing",
            )
            revision = self._store.load_revision(handoff.incident_id)

        validation = self._github_validation.advance(validation_intent)
        if validation.state in {P1CState.WAITING_FOR_RUN, P1CState.WAITING_FOR_COMPLETION}:
            return P1DResult(
                handoff.incident_id,
                P1DState.PENDING,
                "EXECUTING",
                selected.plan_id,
            )
        if validation.state is not P1CState.CI_PASSED:
            return P1DResult(
                handoff.incident_id,
                P1DState.RECOVERY_FAILED,
                "VERIFICATION_FAILED",
                selected.plan_id,
            )
        validation_claim = self._github_ledger.load(validation_intent)
        validation_evidence = dict(validation_claim.progress["evidence"])
        if validation_claim.receipt.status is not ReceiptStatus.VERIFIED:
            raise AssertionError("Candidate validation receipt is not VERIFIED")
        if "validation_evidence" not in revision:
            self._store.checkpoint(
                handoff.incident_id,
                "validation_evidence",
                {
                    "receipt_id": validation_claim.receipt.receipt_id,
                    "receipt_status": validation_claim.receipt.status.value,
                    "evidence": validation_evidence,
                },
            )
            self._workflow.record_event(
                handoff.incident_id,
                WorkflowEventType.RELEASE_VALIDATION_SUCCEEDED,
                f"{validation.run_id}:{validation.run_attempt}",
                {"run_id": validation.run_id, "run_attempt": validation.run_attempt},
            )
            revision = self._store.load_revision(handoff.incident_id)

        release_id = int(validation_evidence["release_id"])
        promotion_intent = _promotion_intent(validation_intent, release_id)
        if "promotion_started" not in revision:
            self._store.checkpoint(
                handoff.incident_id,
                "promotion_started",
                {
                    "action_id": promotion_intent.action.action_id,
                    "idempotency_key": promotion_intent.action.idempotency_key,
                    "release_id": release_id,
                    "release_tag": validation_intent.tag,
                },
            )
            self._workflow.record_event(
                handoff.incident_id,
                WorkflowEventType.FULL_RELEASE_PROMOTION_STARTED,
                promotion_intent.action.idempotency_key,
                {"release_id": release_id, "release_tag": validation_intent.tag},
            )
            revision = self._store.load_revision(handoff.incident_id)
        promotion = self._github_promotion.advance(promotion_intent, release_id=release_id)
        if promotion.receipt_status is not ReceiptStatus.VERIFIED:
            return P1DResult(
                handoff.incident_id, P1DState.PENDING, "EXECUTING", selected.plan_id, release_id
            )
        if "promotion_evidence" not in revision:
            domain = Incident(
                handoff.incident_id,
                replanning_input.objective.objective_id,
                IncidentStatus.EXECUTING,
                PLAN_REVISION,
                [IncidentStatus.EXECUTING],
            )
            domain.transition_to(IncidentStatus.VERIFYING)
            promotion_claim = self._github_ledger.load(promotion_intent)
            self._store.checkpoint(
                handoff.incident_id,
                "promotion_evidence",
                {
                    "receipt_id": promotion_claim.receipt.receipt_id,
                    "receipt_status": promotion_claim.receipt.status.value,
                    "evidence": promotion.evidence,
                },
                stage=IncidentStage.VERIFYING,
                status="verifying",
            )
            self._workflow.record_event(
                handoff.incident_id,
                WorkflowEventType.FULL_RELEASE_PROMOTION_VERIFIED,
                promotion_claim.receipt.receipt_id,
                {"release_id": release_id},
            )
            revision = self._store.load_revision(handoff.incident_id)

        incident = self._store.load_incident(handoff.incident_id)
        if incident.get("stage") == "RESOLVED":
            return P1DResult(
                handoff.incident_id, P1DState.RESOLVED, "RESOLVED", selected.plan_id, release_id
            )
        if "calendar_closure_evidence" not in revision:
            calendar_intent = _calendar_intent(replanning_input.calendar_action_claim)
            calendar_evidence = self._calendar.verify_fresh(calendar_intent)
            self._store.checkpoint(
                handoff.incident_id,
                "calendar_closure_evidence",
                {
                    "passed": calendar_evidence.passed,
                    "observed_at": calendar_evidence.observed_at.isoformat(),
                    "source_reference": calendar_evidence.source_reference,
                    "observed_state": dict(calendar_evidence.observed_state),
                    "differences": list(calendar_evidence.differences),
                },
            )
            revision = self._store.load_revision(handoff.incident_id)

        if "closure_result" in revision:
            final = self._store.load_incident(handoff.incident_id)
            return P1DResult(
                handoff.incident_id,
                P1DState.RESOLVED if final.get("stage") == "RESOLVED" else P1DState.RECOVERY_FAILED,
                str(final.get("stage")),
                selected.plan_id,
                release_id,
            )
        self._workflow.record_event(
            handoff.incident_id,
            WorkflowEventType.OBJECTIVE_VERIFICATION_STARTED,
            "revision-2",
            {"invariant_count": 6},
        )
        calendar_proof = dict(revision["calendar_closure_evidence"])
        promotion_proof = dict(revision["promotion_evidence"]["evidence"])
        validation_proof = dict(revision["validation_evidence"]["evidence"])
        now = datetime.now(UTC)
        validation_observed = datetime.fromisoformat(str(validation_proof["read_back_at"]))
        promotion_observed = datetime.fromisoformat(str(promotion_proof["read_back_at"]))
        calendar_observed = datetime.fromisoformat(str(calendar_proof["observed_at"]))
        jobs = validation_proof.get("jobs", [])
        compatibility_steps = [
            step
            for job in jobs
            if isinstance(job, dict)
            for step in job.get("steps", [])
            if isinstance(step, dict) and step.get("name") == REQUIRED_COMPATIBILITY_STEP
        ]
        correlation_ok = (
            validation_proof.get("repository") == self._configuration.repository
            and int(validation_proof.get("workflow_id", -1)) == self._configuration.workflow_id
            and validation_proof.get("workflow_path") == self._configuration.workflow_path
            and validation_proof.get("tag_sha") == validation_intent.candidate_sha
            and int(promotion_proof.get("release_id", -1)) == release_id
            and promotion_proof.get("release_tag") == validation_intent.tag
            and promotion_proof.get("tag_sha") == validation_intent.candidate_sha
        )
        deadline = datetime.fromisoformat(replanning_input.objective.deadline_at_utc)
        shipping_at = datetime.fromisoformat(str(promotion_proof["shipping_completed_at"]))
        observations = {
            "coordination-action-preserved": InvariantObservation(
                "coordination-action-preserved",
                bool(calendar_proof["passed"]),
                EvidenceKind.EXTERNAL,
                calendar_observed,
                str(calendar_proof["source_reference"]),
            ),
            "active-release-candidate-revised": InvariantObservation(
                "active-release-candidate-revised",
                validation_proof.get("tag_sha") == validation_intent.candidate_sha
                and validation_intent.candidate_sha != replanning_input.failed_candidate_sha,
                EvidenceKind.EXTERNAL,
                validation_observed,
                str(validation_proof["release_url"]),
            ),
            "release-validation-green": InvariantObservation(
                "release-validation-green",
                validation_proof.get("status") == "completed"
                and validation_proof.get("conclusion") == "success"
                and len(compatibility_steps) == 1
                and compatibility_steps[0].get("conclusion") == "success",
                EvidenceKind.EXTERNAL,
                validation_observed,
                str(validation_proof["run_url"]),
            ),
            "shipped-full-release": InvariantObservation(
                "shipped-full-release",
                promotion_proof.get("draft") is False
                and promotion_proof.get("prerelease") is False
                and int(promotion_proof.get("latest_release_id", -1)) == release_id,
                EvidenceKind.EXTERNAL,
                promotion_observed,
                str(promotion_proof["release_url"]),
            ),
            "external-correlation-fresh": InvariantObservation(
                "external-correlation-fresh",
                correlation_ok,
                EvidenceKind.EXTERNAL,
                promotion_observed,
                str(promotion_proof["release_url"]),
            ),
            "protected-release-deadline-satisfied": InvariantObservation(
                "protected-release-deadline-satisfied",
                shipping_at <= deadline,
                EvidenceKind.EXTERNAL,
                promotion_observed,
                str(promotion_proof["release_url"]),
            ),
        }
        invariants = tuple(
            ObjectiveInvariant(invariant_id, invariant_id.replace("-", " "), 900)
            for invariant_id in replanning_input.objective_invariants
        )
        verification = DeterministicObjectiveVerifier().verify(
            objective_id=replanning_input.objective.objective_id,
            invariants=invariants,
            observations=observations,
            now=now,
        )
        domain = Incident(
            handoff.incident_id,
            replanning_input.objective.objective_id,
            IncidentStatus.VERIFYING,
            PLAN_REVISION,
            [IncidentStatus.VERIFYING],
        )
        domain.apply_verification(verification)
        serialized = _verification_dict(verification)
        final = self._store.finalize(
            handoff.incident_id,
            passed=verification.passed,
            verification=serialized,
            active_candidate_sha=validation_intent.candidate_sha,
            resolved_at=now,
        )
        if verification.passed:
            self._workflow.record_event(
                handoff.incident_id,
                WorkflowEventType.OBJECTIVE_RESTORED,
                "revision-2",
                {"active_candidate_sha": validation_intent.candidate_sha},
            )
        else:
            self._workflow.record_event(
                handoff.incident_id,
                WorkflowEventType.OBJECTIVE_VERIFICATION_FAILED,
                "revision-2",
                {
                    "plan_revision": PLAN_REVISION,
                    "objective_id": replanning_input.objective.objective_id,
                    "observed_at": verification.observed_at.isoformat(),
                    "failed_invariant_ids": [
                        check.invariant_id for check in verification.checks if not check.passed
                    ],
                    "invariant_count": len(verification.checks),
                },
            )
        return P1DResult(
            handoff.incident_id,
            P1DState.RESOLVED if verification.passed else P1DState.RECOVERY_FAILED,
            str(final["stage"]),
            selected.plan_id,
            release_id,
        )
