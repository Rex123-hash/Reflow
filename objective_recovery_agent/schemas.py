"""Typed contracts at the model, transport, and persistence boundaries."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Annotated
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class StrictModel(BaseModel):
    # Gemini structured output does not accept every JSON Schema keyword; in
    # particular nested additionalProperties=false produces INVALID_ARGUMENT.
    # All declared fields remain typed and validated before deterministic use.
    model_config = ConfigDict(extra="ignore")


class StrategyType(StrEnum):
    DEADLINE_FIRST = "deadline-first"
    RISK_MINIMIZATION_FIRST = "risk-minimization-first"
    RESOURCE_BALANCE_FIRST = "resource-balance-first"


class AssumptionState(StrEnum):
    CONFIRMED = "confirmed"
    UNKNOWN = "unknown"
    REJECTED = "rejected"


class WorkflowEventType(StrEnum):
    EVENT_RECEIVED = "EVENT_RECEIVED"
    EVENT_INTERPRETED = "EVENT_INTERPRETED"
    IMPACT_MAPPED = "IMPACT_MAPPED"
    PLAN_GENERATION_STARTED = "PLAN_GENERATION_STARTED"
    PLAN_CREATED = "PLAN_CREATED"
    RISK_CRITIQUE_COMPLETED = "RISK_CRITIQUE_COMPLETED"
    PLAN_REJECTED = "PLAN_REJECTED"
    PLAN_SELECTED = "PLAN_SELECTED"
    PLANNING_FAILED = "PLANNING_FAILED"
    ALL_PLANS_INVALID = "ALL_PLANS_INVALID"
    BLOCKING_UNKNOWN = "BLOCKING_UNKNOWN"
    WORKFLOW_RESUMED = "WORKFLOW_RESUMED"


class IncidentStage(StrEnum):
    EVENT_RECEIVED = "EVENT_RECEIVED"
    EVENT_INTERPRETED = "EVENT_INTERPRETED"
    IMPACT_MAPPED = "IMPACT_MAPPED"
    PLAN_GENERATION_STARTED = "PLAN_GENERATION_STARTED"
    PLANS_GENERATED = "PLANS_GENERATED"
    PLANS_CRITIQUED = "PLANS_CRITIQUED"
    PLAN_SELECTED = "PLAN_SELECTED"
    NO_VALID_PLAN = "NO_VALID_PLAN"
    PLANNING_FAILED = "PLANNING_FAILED"


class DisruptionEvent(StrictModel):
    event_id: Annotated[str, Field(min_length=3, max_length=160)]
    event_type: Annotated[str, Field(min_length=3, max_length=80)]
    occurred_at: str
    source: Annotated[str, Field(min_length=1, max_length=80)]
    summary: Annotated[str, Field(min_length=3, max_length=1000)]
    disrupted_node_ids: Annotated[list[str], Field(min_length=1, max_length=20)]
    evidence_references: Annotated[list[str], Field(min_length=1, max_length=20)]

    @field_validator("occurred_at", mode="before")
    @classmethod
    def normalize_occurred_at(cls, value: object) -> str:
        return _iso_timestamp(value)


class ResourceOption(StrictModel):
    person_id: str
    skills: list[str]
    current_load_percent: Annotated[int, Field(ge=0, le=100)]
    available: bool = True


class PlanningInput(StrictModel):
    incident_id: str
    objective_id: str
    objective_label: str
    protected_deadline: str
    disruption: DisruptionEvent
    affected_node_ids: list[str]
    affected_node_labels: list[str]
    resources: list[ResourceOption]
    allowed_work_item_ids: list[str]
    allowed_commitment_ids: list[str]
    policy_summary: list[str]

    @field_validator("protected_deadline", mode="before")
    @classmethod
    def normalize_protected_deadline(cls, value: object) -> str:
        return _iso_timestamp(value)


class ActionParameter(StrictModel):
    key: str
    value: str


class ProposedAction(StrictModel):
    action_id: str
    action_type: str
    target: str
    parameters: list[ActionParameter]


class ProposedAssignment(StrictModel):
    work_item_id: str
    person_id: str
    required_skills: list[str]
    projected_load_percent: int


class ProposedDeadlineChange(StrictModel):
    commitment_id: str
    proposed_deadline: str

    @field_validator("proposed_deadline", mode="before")
    @classmethod
    def normalize_proposed_deadline(cls, value: object) -> str:
        return _iso_timestamp(value)


class PlanAssumptionOutput(StrictModel):
    assumption_id: str
    description: str
    status: AssumptionState
    blocks_execution: bool


class PlanUnknown(StrictModel):
    unknown_id: str
    description: str
    blocks_execution: bool


class PlanRisk(StrictModel):
    risk_id: str
    summary: str
    severity: int


class RecoveryPlanCandidate(StrictModel):
    plan_id: str
    strategy_type: StrategyType
    actions: list[ProposedAction]
    assignments: list[ProposedAssignment]
    deadline_changes: list[ProposedDeadlineChange]
    assumptions: list[PlanAssumptionOutput]
    unknowns: list[PlanUnknown]
    expected_objective_effect: str
    risks: list[PlanRisk]
    required_evidence: list[str]
    initial_risk_score: int

    @model_validator(mode="after")
    def validate_bounds(self) -> RecoveryPlanCandidate:
        if not self.actions or len(self.actions) > 12:
            raise ValueError("a plan requires 1-12 actions")
        if not self.risks or len(self.risks) > 12:
            raise ValueError("a plan requires 1-12 risks")
        if not self.required_evidence or len(self.required_evidence) > 12:
            raise ValueError("a plan requires 1-12 evidence requirements")
        if not 0 <= self.initial_risk_score <= 100:
            raise ValueError("initial risk score must be between 0 and 100")
        if any(not 1 <= risk.severity <= 5 for risk in self.risks):
            raise ValueError("risk severity must be between 1 and 5")
        if any(not 0 <= item.projected_load_percent <= 200 for item in self.assignments):
            raise ValueError("projected load must be between 0 and 200")
        if len(self.expected_objective_effect) < 10:
            raise ValueError("expected objective effect is too short")
        return self


class CandidateSet(StrictModel):
    plans: list[RecoveryPlanCandidate]

    @model_validator(mode="after")
    def unique_plans(self) -> CandidateSet:
        ids = [plan.plan_id for plan in self.plans]
        if not 1 <= len(ids) <= 3:
            raise ValueError("candidate set must contain 1-3 plans")
        if len(ids) != len(set(ids)):
            raise ValueError("plan IDs must be unique")
        return self


class StrategySeed(StrictModel):
    strategy_type: StrategyType
    differentiator: str
    tradeoff: str


class StrategySeedSet(StrictModel):
    seeds: list[StrategySeed]

    @model_validator(mode="after")
    def exactly_three(self) -> StrategySeedSet:
        if len(self.seeds) != 3:
            raise ValueError("strategy seed set must contain exactly three seeds")
        return self


class PlanCritique(StrictModel):
    plan_id: str
    verdict_summary: str
    additional_risks: list[str]
    contradictions: list[str]
    missing_evidence: list[str]
    adjusted_risk_score: int

    @model_validator(mode="after")
    def validate_risk_score(self) -> PlanCritique:
        if not 0 <= self.adjusted_risk_score <= 100:
            raise ValueError("adjusted risk score must be between 0 and 100")
        return self


class CritiqueBundle(StrictModel):
    critiques: list[PlanCritique]

    @model_validator(mode="after")
    def validate_count(self) -> CritiqueBundle:
        if not 1 <= len(self.critiques) <= 3:
            raise ValueError("critique bundle must contain 1-3 critiques")
        return self


class PlanningRun(StrictModel):
    planning_run_id: str = Field(default_factory=lambda: str(uuid4()))
    candidates: CandidateSet
    critiques: CritiqueBundle
    planner_latency_ms: int
    critic_latency_ms: int
    total_tokens: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    failed_perspectives: list[StrategyType] = Field(default_factory=list)


class CandidateGeneration(StrictModel):
    planning_run_id: str
    candidates: CandidateSet
    planner_latency_ms: int
    total_tokens: int = 0
    input_tokens: int = 0
    output_tokens: int = 0


class CritiqueGeneration(StrictModel):
    critiques: CritiqueBundle
    critic_latency_ms: int
    total_tokens: int = 0
    input_tokens: int = 0
    output_tokens: int = 0


class PubSubMessage(StrictModel):
    data: str
    message_id: str = Field(alias="messageId")
    publish_time: datetime | None = Field(default=None, alias="publishTime")
    attributes: dict[str, str] = Field(default_factory=dict)


class PubSubEnvelope(StrictModel):
    message: PubSubMessage
    subscription: str


def _iso_timestamp(value: object) -> str:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            raise ValueError("timestamp must include a timezone")
        return value.isoformat()
    if not isinstance(value, str):
        raise ValueError("timestamp must be an ISO-8601 string")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timestamp must include a timezone")
    return parsed.isoformat()
