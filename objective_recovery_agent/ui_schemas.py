"""Stable presentation contracts for the logged-in Reflow UI."""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class PresentationModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ObjectiveHealth(StrEnum):
    HEALTHY = "HEALTHY"
    WATCHING = "WATCHING"
    RECOVERING = "RECOVERING"
    NEEDS_ATTENTION = "NEEDS_ATTENTION"
    RESTORED = "RESTORED"


class WorkflowStage(StrEnum):
    DETECT = "DETECT"
    IMPACT = "IMPACT"
    PLAN = "PLAN"
    ACT = "ACT"
    VERIFY = "VERIFY"
    REPLAN = "REPLAN"
    RESTORED = "RESTORED"


class SemanticStatus(StrEnum):
    PENDING = "PENDING"
    CURRENT = "CURRENT"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    UNAVAILABLE = "UNAVAILABLE"


class ReceiptStatusView(StrEnum):
    PENDING = "PENDING"
    WRITE_ACKNOWLEDGED = "WRITE_ACKNOWLEDGED"
    VERIFIED = "VERIFIED"


class VerificationStatus(StrEnum):
    PASSED = "PASSED"
    FAILED = "FAILED"
    PENDING = "PENDING"
    UNAVAILABLE = "UNAVAILABLE"


class EvidenceSemanticStatus(StrEnum):
    PENDING = "PENDING"
    WRITE_ACKNOWLEDGED = "WRITE_ACKNOWLEDGED"
    VERIFIED_HEALTHY = "VERIFIED_HEALTHY"
    VERIFIED_UNHEALTHY = "VERIFIED_UNHEALTHY"
    UNAVAILABLE = "UNAVAILABLE"


class ObjectiveFilter(StrEnum):
    ALL = "all"
    ACTIVE = "active"
    RESTORED = "restored"


class ObjectiveSummary(PresentationModel):
    objective_id: str
    objective_version: int
    title: str
    health: ObjectiveHealth
    protected_deadline: str
    deadline_timezone: str
    active_incident_id: str | None = None
    active_recovery_number: int | None = None
    workflow_stage: WorkflowStage | None = None
    latest_observed_state: str | None = None
    updated_at: str | None = None


class CurrentPriority(PresentationModel):
    objective_id: str
    objective_title: str
    objective_health: ObjectiveHealth
    active_recovery_number: int | None = None
    active_workflow_stage: WorkflowStage | None = None
    protected_deadline: str
    deadline_timezone: str
    time_remaining_seconds: int | None = None
    summary: str
    incident_id: str | None = None


class ObjectiveCounts(PresentationModel):
    active: int
    recovering: int
    healthy: int
    watching_or_needs_attention: int
    restored: int


class ExecutionEventView(PresentationModel):
    event_id: str
    sequence: int
    cursor: str
    timestamp: str
    recovery_attempt: int
    semantic_type: str
    human_message: str
    technical_summary: str
    source_authority: str
    related_resource_ids: list[str] = Field(default_factory=list)


class OverviewView(PresentationModel):
    revision: int
    current_priority: CurrentPriority | None
    objective_summary: ObjectiveCounts
    active_objectives: list[ObjectiveSummary]
    recent_activity: list[ExecutionEventView]


class ObjectivesView(PresentationModel):
    revision: int
    filter: ObjectiveFilter
    items: list[ObjectiveSummary]


class ObjectiveContext(PresentationModel):
    objective_id: str
    objective_version: int
    title: str
    health: ObjectiveHealth
    protected_deadline: str
    deadline_timezone: str
    current_recovery_number: int
    workflow_stage: WorkflowStage
    incident_stage: str
    incident_status: str
    revision: int
    is_live: bool


class RecoveryStageView(PresentationModel):
    stage_id: str
    semantic_kind: WorkflowStage
    title: str
    subtitle: str
    status: SemanticStatus
    timestamp: str | None = None
    related_evidence_ids: list[str] = Field(default_factory=list)
    failure_reason: str | None = None


class RecoveryAttemptView(PresentationModel):
    attempt_number: int
    label: str
    status: SemanticStatus
    branch_from_attempt: int | None = None
    branch_reason: str | None = None
    candidate_sha: str | None = None
    selected_plan_id: str | None = None
    stages: list[RecoveryStageView]


class RecoverySummary(PresentationModel):
    what_happened: str
    why_current_recovery_exists: str | None = None
    what_changed: str | None = None


class GraphNodeView(PresentationModel):
    node_id: str
    label: str
    kind: str
    state: str
    affected: bool
    critical_path: bool


class GraphEdgeView(PresentationModel):
    source: str
    target: str
    relation: str


class OperationalGraphView(PresentationModel):
    nodes: list[GraphNodeView]
    edges: list[GraphEdgeView]


class PolicyViolationView(PresentationModel):
    rule_id: str
    message: str


class PolicyDecisionView(PresentationModel):
    plan_id: str
    valid: bool
    blocking_unknowns: list[str] = Field(default_factory=list)
    violations: list[PolicyViolationView] = Field(default_factory=list)


class RecoveryPlanView(PresentationModel):
    plan_id: str
    title: str
    revision: int
    recovery_attempt: int
    candidate_sha: str | None = None
    risk_score: int | None = None
    selected: bool
    valid: bool | None = None
    deterministic_rejection_reason: str | None = None
    policy: PolicyDecisionView | None = None
    assumptions_summary: list[str] = Field(default_factory=list)
    proposed_action_summary: list[str] = Field(default_factory=list)
    critic_summary: str | None = None


class ActionReceiptView(PresentationModel):
    action_id: str
    receipt_id: str | None = None
    recovery_attempt: int
    kind: str
    system: str
    desired_state_summary: str
    receipt_status: ReceiptStatusView
    write_acknowledged: bool
    write_acknowledged_at: str | None = None
    read_back_completed: bool
    read_back_at: str | None = None
    external_reference: str | None = None
    verification_state: VerificationStatus
    evidence_id: str | None = None


class VerificationInvariantView(PresentationModel):
    invariant_id: str
    expected: str
    observed: str | None = None
    status: VerificationStatus
    evidence_provenance: str | None = None
    evidence_id: str | None = None
    reason: str | None = None


class VerificationView(PresentationModel):
    verification_id: str
    recovery_attempt: int
    objective_id: str
    status: VerificationStatus
    observed_at: str | None = None
    invariants: list[VerificationInvariantView]


ProofValue = str | int | bool | None


class EvidenceView(PresentationModel):
    evidence_id: str
    recovery_attempt: int
    source_system: str
    evidence_kind: str
    title: str
    semantic_status: EvidenceSemanticStatus
    external_reference: str | None = None
    observed_at: str | None = None
    summary: str
    proof_fields: dict[str, ProofValue] = Field(default_factory=dict)


class AttemptComparisonItem(PresentationModel):
    field: str
    recovery_1: str | None = None
    recovery_2: str | None = None


class RecoveryCaseView(PresentationModel):
    revision: int
    objective: ObjectiveContext
    attempts: list[RecoveryAttemptView]
    summary: RecoverySummary
    world: OperationalGraphView
    plans: list[RecoveryPlanView]
    actions: list[ActionReceiptView]
    verifications: list[VerificationView]
    what_changed: list[AttemptComparisonItem]
    evidence: list[EvidenceView]


class EvidencePageView(PresentationModel):
    incident_id: str
    revision: int
    timeline: list[ExecutionEventView]
    receipts: list[ActionReceiptView]
    verification: list[VerificationView]
    decisions: list[RecoveryPlanView]
    evidence: list[EvidenceView]


class ExecutionEventsView(PresentationModel):
    incident_id: str
    revision: int
    events: list[ExecutionEventView]
    next_cursor: str
    terminal: bool


class OperatorContextView(PresentationModel):
    revision: int
    read_only: bool = True
    objective: ObjectiveContext
    current_recovery: RecoveryAttemptView
    plans: list[RecoveryPlanView]
    evidence: list[EvidenceView]
    verification: VerificationView | None = None
    events: list[ExecutionEventView]


def presentation_schema() -> dict[str, Any]:
    """One explicit schema entry point for contract export tooling."""
    return RecoveryCaseView.model_json_schema()
