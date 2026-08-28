"""P2F's bounded, read-only Operator contracts; no execution/action request type."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

ShortText = Annotated[str, Field(min_length=1, max_length=800)]
Reference = Annotated[str, Field(min_length=1, max_length=200)]
IntentType = Literal["INSPECT", "EXPLAIN", "SIMULATE"]


class OperatorModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class OperatorQuery(OperatorModel):
    incident_id: str = Field(pattern=r"^incident-[a-zA-Z0-9-]{1,80}$")
    message: str = Field(min_length=3, max_length=1200)


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
    subject: Literal["OBJECTIVE", "RECOVERY", "CALENDAR", "EVIDENCE", "CHRONOLOGY"]
    incident_id: str
    recovery_attempt: int | None = None
    question: ShortText
    hypothetical_changes: tuple[HypotheticalChange, ...] = Field(max_length=3)
    constraints: tuple[ShortText, ...] = Field(max_length=5)
    fact_ids: tuple[Reference, ...] = Field(max_length=8)
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
            if not self.fact_ids:
                raise ValueError("Supported intent must select authoritative facts")
        elif self.intent_type is not None or not self.clarification or self.hypothetical_changes:
            raise ValueError("Unsupported/ambiguous requests cannot authorize a reasoning path")
        return self


class IntentInput(OperatorModel):
    request: OperatorQuery
    snapshot: OperatorSnapshot


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
    hypothetical_deadline: str | None = None
    provenance: Literal["AUTHORITATIVE_SNAPSHOT", "HYPOTHETICAL_NO_ACTION"]
    external_effects_executed: Literal[False] = False
    agents: tuple[OperatorAgentTrace, ...] = Field(min_length=1, max_length=2)
