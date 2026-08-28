"""Bounded Operator reasoning, action, and verification contracts."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from objective_recovery_agent.slack_operator_policy import SLACK_CREDENTIAL

ShortText = Annotated[str, Field(min_length=1, max_length=800)]
Reference = Annotated[str, Field(min_length=1, max_length=200)]
IntentType = Literal["INSPECT", "EXPLAIN", "SIMULATE", "ACT"]
Authority = Literal["JIRA", "GOOGLE_CALENDAR", "REFLOW", "SLACK"]
ResourceType = Literal["ISSUE", "EVENT", "OBJECTIVE", "CHANNEL"]
OperationType = Literal[
    "JIRA_TRANSITION",
    "JIRA_SET_PRIORITY",
    "JIRA_ASSIGN",
    "JIRA_SET_DUE_DATE",
    "JIRA_ADD_COMMENT",
    "CALENDAR_RESCHEDULE",
    "CALENDAR_UPDATE_TITLE",
    "CALENDAR_UPDATE_DESCRIPTION",
    "MOVE_PROTECTED_DEADLINE",
    "SLACK_INSPECT_CHANNEL",
    "SLACK_POST_MESSAGE",
]


class OperatorModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, revalidate_instances="always")


class OperatorQuery(OperatorModel):
    incident_id: str = Field(pattern=r"^incident-[a-zA-Z0-9-]{1,80}$")
    message: str = Field(min_length=3, max_length=1200)
    idempotency_key: str | None = Field(
        default=None, pattern=r"^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,127}$"
    )


class OperatorTarget(OperatorModel):
    authority: Authority
    resource_type: ResourceType
    resource_identifier: str = Field(min_length=1, max_length=200)

    @model_validator(mode="after")
    def matching_resource(self) -> OperatorTarget:
        expected = {
            "JIRA": "ISSUE",
            "GOOGLE_CALENDAR": "EVENT",
            "REFLOW": "OBJECTIVE",
            "SLACK": "CHANNEL",
        }
        if expected[self.authority] != self.resource_type:
            raise ValueError("Authority and resource type do not match")
        return self


class RequestedOperation(OperatorModel):
    operation: OperationType
    value: str | None = Field(default=None, min_length=1, max_length=800)
    comment: str | None = Field(default=None, min_length=1, max_length=1000)

    @model_validator(mode="after")
    def operation_payload(self) -> RequestedOperation:
        text = self.comment if self.comment is not None else self.value
        if text is not None and (
            not text.strip() or any(ord(c) < 32 and c not in "\n\t" for c in text)
        ):
            raise ValueError("Action text must be nonempty and contain no control characters")
        if self.operation == "SLACK_INSPECT_CHANNEL":
            if self.comment is not None or self.value is not None:
                raise ValueError("Slack inspection has no mutation payload")
        elif self.operation == "JIRA_ADD_COMMENT":
            if self.comment is None or self.value is not None:
                raise ValueError("A Jira comment requires only comment text")
        elif self.comment is not None or self.value is None:
            raise ValueError("This operation requires only a typed value")
        if self.operation == "SLACK_POST_MESSAGE" and SLACK_CREDENTIAL.search(text or ""):
            raise ValueError("Credentials cannot enter a Slack action receipt")
        return self


class OperatorCapability(OperatorModel):
    authority: Authority
    resource_type: ResourceType
    operations: tuple[OperationType, ...] = Field(min_length=1, max_length=10)
    resource_identifiers: tuple[str, ...] = Field(default=(), max_length=5)


class OperatorFact(OperatorModel):
    fact_id: Reference
    text: ShortText
    evidence_ids: tuple[Reference, ...] = Field(max_length=8)


class OperatorEvidence(OperatorModel):
    evidence_id: Reference
    title: ShortText
    observed_at: str | None


class OperatorSnapshot(OperatorModel):
    incident_id: str
    revision: int
    objective_id: str
    protected_deadline: str
    recovery_attempts: tuple[int, ...]
    facts: tuple[OperatorFact, ...] = Field(max_length=100)
    evidence: tuple[OperatorEvidence, ...] = Field(max_length=40)
    fingerprint: str


class HypotheticalChange(OperatorModel):
    kind: Literal["CI_PASSED", "DEADLINE_SHIFT_MINUTES", "RESOURCE_AVAILABLE_AT"]
    target: ShortText
    value: ShortText


class OperatorIntent(OperatorModel):
    disposition: Literal["SUPPORTED", "CLARIFICATION_REQUIRED", "UNSUPPORTED"]
    intent_type: IntentType | None = None
    subject: Literal["OBJECTIVE", "RECOVERY", "CALENDAR", "JIRA", "SLACK", "EVIDENCE", "CHRONOLOGY"]
    incident_id: str
    recovery_attempt: int | None = None
    question: ShortText
    hypothetical_changes: tuple[HypotheticalChange, ...] = Field(max_length=3)
    constraints: tuple[ShortText, ...] = Field(max_length=5)
    fact_ids: tuple[Reference, ...] = Field(max_length=8)
    target: OperatorTarget | None = None
    requested_operations: tuple[RequestedOperation, ...] = Field(default=(), max_length=5)
    clarification: ShortText | None = None

    @model_validator(mode="after")
    def bounded_intent(self) -> OperatorIntent:
        if self.disposition == "SUPPORTED":
            if self.intent_type is None or self.clarification is not None:
                raise ValueError("Supported intent requires a type, not clarification")
            if self.intent_type == "SIMULATE" and not self.hypothetical_changes:
                raise ValueError("Simulation needs an explicit hypothetical")
            if self.intent_type != "SIMULATE" and self.hypothetical_changes:
                raise ValueError("Hypotheticals cannot become observed facts")
            if self.intent_type == "ACT":
                if self.target is None or not self.requested_operations or self.fact_ids:
                    raise ValueError("ACT requires one target and typed operations, not facts")
            elif self.requested_operations:
                raise ValueError("Only ACT may request mutations")
            elif self.subject == "SLACK":
                if (
                    self.intent_type != "INSPECT"
                    or self.target is None
                    or self.target.authority != "SLACK"
                    or self.fact_ids
                ):
                    raise ValueError("Slack inspection requires only its external target")
            elif self.subject == "JIRA" and self.intent_type == "INSPECT":
                if self.target is None or self.fact_ids:
                    raise ValueError("Jira inspection requires an external target")
            elif (
                self.subject == "CALENDAR"
                and self.intent_type == "INSPECT"
                and self.target is not None
            ):
                if self.target.authority != "GOOGLE_CALENDAR" or self.fact_ids:
                    raise ValueError(
                        "Dedicated Calendar inspection requires only its external target"
                    )
            elif not self.fact_ids:
                raise ValueError("Supported intent must select authoritative facts")
            if (
                self.subject == "SLACK"
                and self.intent_type == "ACT"
                and (self.target is None or self.target.authority != "SLACK")
            ):
                raise ValueError("Slack ACT requires its external target")
        elif (
            self.intent_type is not None
            or not self.clarification
            or self.hypothetical_changes
            or self.requested_operations
        ):
            raise ValueError("Unsupported/ambiguous requests cannot authorize a reasoning path")
        return self


class IntentInput(OperatorModel):
    request: OperatorQuery
    snapshot: OperatorSnapshot
    capabilities: tuple[OperatorCapability, ...] = Field(default=(), max_length=8)


class OperatorInspection(OperatorModel):
    authority: Authority
    resource_type: ResourceType
    resource_identifier: str
    observed_state: dict[str, str | None]
    observed_at: str


class OperatorActionView(OperatorModel):
    operator_action_id: str
    request_id: str
    authenticated_subject_hash: str
    authority: Authority
    resource_type: ResourceType
    resource_identifier: str
    operations: tuple[RequestedOperation, ...]
    expected_state: dict[str, str | None] = Field(default_factory=dict)
    authorization_result: Literal["AUTO_EXECUTABLE", "APPROVAL_REQUIRED", "DENIED"]
    lifecycle: Literal[
        "REQUESTED",
        "AUTHORIZED",
        "APPROVAL_REQUIRED",
        "APPROVED",
        "EXECUTING",
        "EXECUTED",
        "READ_BACK",
        "VERIFIED",
        "VERIFICATION_FAILED",
        "DENIED",
        "FAILED",
    ]
    execution_acknowledgement: dict[str, str] = Field(default_factory=dict)
    observed_state: dict[str, str | None] = Field(default_factory=dict)
    verification_result: Literal["NOT_RUN", "PASSED", "FAILED"] = "NOT_RUN"
    adapter_proof: dict[str, str] = Field(default_factory=dict)
    created_at: str
    updated_at: str
    error_category: str | None = None
    request_fingerprint: str | None = None
    external_effects_possible: bool = False

    @model_validator(mode="after")
    def verified_requires_evidence(self) -> OperatorActionView:
        if (self.lifecycle == "VERIFIED") != (self.verification_result == "PASSED"):
            raise ValueError("Only VERIFIED actions may report a passed verification")
        if self.lifecycle == "VERIFIED" and (
            not self.expected_state
            or not self.observed_state
            or not self.execution_acknowledgement
            or self.authorization_result == "DENIED"
        ):
            raise ValueError("Verification requires authorization, acknowledgement and read-back")
        return self


class SimulationInput(OperatorModel):
    provenance: Literal["HYPOTHETICAL_NO_ACTION"] = "HYPOTHETICAL_NO_ACTION"
    snapshot: OperatorSnapshot
    intent: OperatorIntent
    hypothetical_deadline: str | None = None


class SimulationFuture(OperatorModel):
    title: ShortText
    consequence: ShortText
    tradeoffs: tuple[ShortText, ...] = Field(min_length=1, max_length=4)
    required_verification: tuple[ShortText, ...] = Field(min_length=1, max_length=4)


class SimulationResult(OperatorModel):
    provenance: Literal["HYPOTHETICAL_NO_ACTION"]
    scenario_summary: ShortText
    assumptions: tuple[ShortText, ...] = Field(min_length=1, max_length=6)
    threatened_invariants: tuple[ShortText, ...] = Field(max_length=8)
    candidate_futures: tuple[SimulationFuture, ...] = Field(min_length=1, max_length=3)
    risk_critique: tuple[ShortText, ...] = Field(min_length=1, max_length=6)
    likely_objective_outcome: Literal["MAY_IMPROVE", "STILL_AT_RISK", "INSUFFICIENT_EVIDENCE"]
    unsupported_assumptions: tuple[ShortText, ...] = Field(max_length=6)
    evidence_ids: tuple[Reference, ...] = Field(min_length=1, max_length=12)
    # Vertex structured output rejects boolean values inside a JSON Schema enum.
    # Keep the generated schema compatible and enforce the same invariant in Pydantic.
    external_effects_executed: bool

    @model_validator(mode="after")
    def no_external_effects(self) -> SimulationResult:
        if self.external_effects_executed:
            raise ValueError("Simulation cannot report external effects")
        return self


class OperatorAgentTrace(OperatorModel):
    agent_id: Literal["operator_intent_interpreter", "simulation_agent"]
    model: str
    request_id: str
    latency_ms: int
    attempts: int
    input_tokens: int
    output_tokens: int
    total_tokens: int
    validation: Literal["PASSED"] = "PASSED"


class OperatorResponse(OperatorModel):
    request_id: str
    incident_id: str
    revision: int
    snapshot_fingerprint: str
    generated_at: str
    disposition: Literal["SUPPORTED", "CLARIFICATION_REQUIRED", "UNSUPPORTED"]
    intent: OperatorIntent
    answer: str = Field(min_length=1, max_length=8000)
    facts: tuple[OperatorFact, ...] = Field(max_length=12)
    evidence: tuple[OperatorEvidence, ...] = Field(max_length=40)
    simulation: SimulationResult | None = None
    inspection: OperatorInspection | None = None
    action: OperatorActionView | None = None
    hypothetical_deadline: str | None = None
    provenance: Literal["AUTHORITATIVE_SNAPSHOT", "HYPOTHETICAL_NO_ACTION", "OPERATOR_ACTION"]
    external_effects_executed: bool = False
    agents: tuple[OperatorAgentTrace, ...] = Field(max_length=2)
