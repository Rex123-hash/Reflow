"""Deterministic read-only routing. Simulation only receives immutable value objects."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from typing import Literal, Protocol

from objective_recovery_agent.external_reality_schemas import ExternalRealityView
from objective_recovery_agent.operator_agents import AdkOperatorAgents, OperatorReasoningError
from objective_recovery_agent.operator_context import safe_text
from objective_recovery_agent.operator_schemas import (
    IntentInput,
    OperatorAgentTrace,
    OperatorFact,
    OperatorIntent,
    OperatorQuery,
    OperatorResponse,
    OperatorSnapshot,
    SimulationInput,
    SimulationResult,
)


class ReasoningAgents(Protocol):
    async def interpret(
        self, payload: IntentInput, request_id: str
    ) -> tuple[OperatorIntent, OperatorAgentTrace]: ...
    async def simulate(
        self, payload: SimulationInput, request_id: str
    ) -> tuple[SimulationResult, OperatorAgentTrace]: ...


def validate_intent(intent: OperatorIntent, snapshot: OperatorSnapshot) -> str | None:
    if intent.incident_id != snapshot.incident_id:
        raise OperatorReasoningError("Intent changed the incident scope")
    if (
        intent.recovery_attempt is not None
        and intent.recovery_attempt not in snapshot.recovery_attempts
    ):
        raise OperatorReasoningError("Unknown recovery attempt")
    if not set(intent.fact_ids) <= {fact.fact_id for fact in snapshot.facts}:
        raise OperatorReasoningError("Unknown fact reference")
    deadline = None
    kinds = [item.kind for item in intent.hypothetical_changes]
    if len(kinds) != len(set(kinds)):
        raise OperatorReasoningError("Duplicate hypothetical change")
    for change in intent.hypothetical_changes:
        if change.kind == "DEADLINE_SHIFT_MINUTES":
            try:
                minutes = int(change.value)
                if abs(minutes) > 1440 or not minutes or change.target != snapshot.objective_id:
                    raise ValueError("Invalid deadline hypothetical")
                deadline = (
                    datetime.fromisoformat(snapshot.protected_deadline) + timedelta(minutes=minutes)
                ).isoformat()
            except ValueError as error:
                raise OperatorReasoningError("Invalid deadline hypothetical") from error
        elif change.kind == "CI_PASSED":
            if change.value.casefold() != "true" or not any(
                change.target.casefold() in fact.text.casefold() or change.target == fact.fact_id
                for fact in snapshot.facts
            ):
                raise OperatorReasoningError("Unknown CI hypothetical target")
        else:
            if f"resource:{change.target}" not in {item.fact_id for item in snapshot.facts}:
                raise OperatorReasoningError("Unknown resource")
            try:
                if datetime.fromisoformat(change.value).tzinfo is None:
                    raise ValueError("Timezone required")
            except ValueError as error:
                raise OperatorReasoningError("Ambiguous resource availability") from error
    return deadline


class OperatorService:
    def __init__(
        self,
        snapshot_reader: Callable[[str], Awaitable[OperatorSnapshot]],
        calendar_reader: Callable[[str], Awaitable[ExternalRealityView]],
        agents: ReasoningAgents | None = None,
    ) -> None:
        self._snapshot_reader = snapshot_reader
        self._calendar_reader = calendar_reader
        self._agents = agents or AdkOperatorAgents()

    async def query(self, query: OperatorQuery, request_id: str) -> OperatorResponse:
        async with asyncio.timeout(70):
            snapshot = await self._snapshot_reader(query.incident_id)
            bounded_query = OperatorQuery(
                incident_id=query.incident_id, message=safe_text(query.message, 1200)
            )
            intent, trace = await self._agents.interpret(
                IntentInput(request=bounded_query, snapshot=snapshot), request_id
            )
            # Validate even injected implementations; no unvalidated model output is used.
            intent = OperatorIntent.model_validate(intent)
            deadline = validate_intent(intent, snapshot)
            facts = tuple(
                fact
                for key in dict.fromkeys(intent.fact_ids)
                for fact in snapshot.facts
                if fact.fact_id == key
            )
            evidence_ids = {ref for fact in facts for ref in fact.evidence_ids}
            traces = [trace]
            simulation = None
            provenance: Literal["AUTHORITATIVE_SNAPSHOT", "HYPOTHETICAL_NO_ACTION"] = (
                "AUTHORITATIVE_SNAPSHOT"
            )
            if intent.disposition != "SUPPORTED":
                facts = ()
                evidence_ids = set()
                answer = (
                    "Production mutations are not supported. "
                    if intent.disposition == "UNSUPPORTED"
                    else "Please clarify the request. "
                ) + str(intent.clarification)
            elif intent.intent_type == "SIMULATE":
                # Agent 7 has values only: no reader, gateway, service, ledger or callback.
                simulation, simulation_trace = await self._agents.simulate(
                    SimulationInput(
                        snapshot=snapshot, intent=intent, hypothetical_deadline=deadline
                    ),
                    request_id,
                )
                simulation = SimulationResult.model_validate(simulation)
                if not set(simulation.evidence_ids) <= {
                    item.evidence_id for item in snapshot.evidence
                }:
                    raise OperatorReasoningError("Simulation cited unavailable evidence")
                traces.append(simulation_trace)
                evidence_ids.update(simulation.evidence_ids)
                provenance = "HYPOTHETICAL_NO_ACTION"
                answer = (
                    "Hypothetical only — no external action occurred. "
                    + simulation.scenario_summary
                )
            else:
                if intent.subject == "CALENDAR":
                    calendar = await self._calendar_reader(query.incident_id)
                    if calendar.revision != snapshot.revision:
                        raise OperatorReasoningError("Calendar context revision changed")
                    for resource in calendar.resources[:2]:
                        latest = resource.latest_readback
                        fresh = (
                            resource.fresh_read_status == "READ_BACK"
                            and latest is not None
                            and latest.source_freshness == "FRESH_READ"
                        )
                        text = (
                            f"Fresh Google Calendar read-back at {latest.observed_at}: "
                            f"{latest.state.start} to {latest.state.end}, {latest.state.status}; "
                            f"comparison {latest.verification_status}."
                            if fresh and latest
                            else f"Current Calendar read status: {resource.fresh_read_status}. "
                            "No fresh observed event is asserted; recorded evidence is historical."
                        )
                        facts += (
                            OperatorFact(
                                fact_id="calendar:current",
                                text=text,
                                evidence_ids=(resource.evidence_id,),
                            ),
                        )
                        evidence_ids.add(resource.evidence_id)
                # The model selects relevant authoritative facts; prose cannot manufacture truth.
                answer = "\n\n".join(fact.text for fact in facts)
            return OperatorResponse(
                request_id=request_id,
                incident_id=snapshot.incident_id,
                revision=snapshot.revision,
                snapshot_fingerprint=snapshot.fingerprint,
                generated_at=datetime.now(UTC).isoformat(),
                disposition=intent.disposition,
                intent=intent,
                answer=answer,
                facts=facts,
                evidence=tuple(
                    item for item in snapshot.evidence if item.evidence_id in evidence_ids
                ),
                simulation=simulation,
                hypothetical_deadline=deadline,
                provenance=provenance,
                agents=tuple(traces),
            )
