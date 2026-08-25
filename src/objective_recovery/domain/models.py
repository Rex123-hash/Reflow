"""Typed operational primitives shared by deterministic services."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from enum import StrEnum


class NodeKind(StrEnum):
    OBJECTIVE = "objective"
    COMMITMENT = "commitment"
    MILESTONE = "milestone"
    WORK_ITEM = "work_item"
    PERSON = "person"
    RESOURCE = "resource"
    TOOL = "tool"
    EXTERNAL_STATE = "external_state"


class AssumptionStatus(StrEnum):
    CONFIRMED = "confirmed"
    UNKNOWN = "unknown"
    REJECTED = "rejected"


class EvidenceKind(StrEnum):
    EXTERNAL = "external"
    EMULATED = "emulated"
    MODEL_ASSERTION = "model_assertion"
    MISSING = "missing"


class ReceiptStatus(StrEnum):
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class IncidentStatus(StrEnum):
    DETECTED = "detected"
    INTERPRETING = "interpreting"
    IMPACT_MAPPED = "impact_mapped"
    PLANNING = "planning"
    VALIDATING = "validating"
    EXECUTING = "executing"
    PARTIAL_FAILURE = "partial_failure"
    COMPENSATING = "compensating"
    VERIFYING = "verifying"
    VERIFICATION_FAILED = "verification_failed"
    REPLANNING = "replanning"
    RESOLVED = "resolved"


@dataclass(frozen=True, slots=True)
class OperationalNode:
    node_id: str
    kind: NodeKind
    label: str


@dataclass(frozen=True, slots=True)
class OperationalEdge:
    """A dependency edge from a dependent node to the node it needs."""

    source_id: str
    target_id: str
    relation: str = "depends_on"


@dataclass(frozen=True, slots=True)
class PlanAssumption:
    assumption_id: str
    description: str
    status: AssumptionStatus
    blocks_execution: bool = True


@dataclass(frozen=True, slots=True)
class Assignment:
    work_item_id: str
    person_id: str
    required_skills: frozenset[str]
    projected_load_percent: Decimal


@dataclass(frozen=True, slots=True)
class DeadlineChange:
    commitment_id: str
    proposed_deadline: datetime


@dataclass(frozen=True, slots=True)
class Action:
    action_id: str
    action_type: str
    target: str
    parameters: tuple[tuple[str, str], ...]
    idempotency_key: str


@dataclass(frozen=True, slots=True)
class RecoveryPlan:
    plan_id: str
    strategy: str
    risk_score: Decimal
    actions: tuple[Action, ...] = ()
    assignments: tuple[Assignment, ...] = ()
    assumptions: tuple[PlanAssumption, ...] = ()
    deadline_changes: tuple[DeadlineChange, ...] = ()


@dataclass(frozen=True, slots=True)
class PolicyViolation:
    rule_id: str
    message: str


@dataclass(frozen=True, slots=True)
class PolicyDecision:
    plan_id: str
    violations: tuple[PolicyViolation, ...] = ()
    blocking_unknowns: tuple[str, ...] = ()

    @property
    def is_valid(self) -> bool:
        return not self.violations and not self.blocking_unknowns


@dataclass(frozen=True, slots=True)
class EvaluatedPlan:
    plan: RecoveryPlan
    decision: PolicyDecision

    def __post_init__(self) -> None:
        if self.plan.plan_id != self.decision.plan_id:
            raise ValueError("policy decision does not belong to recovery plan")


@dataclass(frozen=True, slots=True)
class ActionReceipt:
    receipt_id: str
    action_id: str
    idempotency_key: str
    status: ReceiptStatus
    evidence_kind: EvidenceKind
    observed_at: datetime
    external_reference: str | None = None


@dataclass(frozen=True, slots=True)
class ObjectiveInvariant:
    invariant_id: str
    description: str
    max_evidence_age_seconds: int


@dataclass(frozen=True, slots=True)
class InvariantObservation:
    invariant_id: str
    passed: bool
    evidence_kind: EvidenceKind
    observed_at: datetime
    source_reference: str | None


@dataclass(frozen=True, slots=True)
class VerificationCheck:
    invariant_id: str
    passed: bool
    reason: str
    evidence_kind: EvidenceKind
    source_reference: str | None


@dataclass(frozen=True, slots=True)
class VerificationResult:
    objective_id: str
    observed_at: datetime
    checks: tuple[VerificationCheck, ...]

    @property
    def passed(self) -> bool:
        return bool(self.checks) and all(check.passed for check in self.checks)
