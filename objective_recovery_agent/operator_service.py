"""Operator routing: model interpretation followed by deterministic control."""

from __future__ import annotations

import asyncio
import hashlib
import json
import re
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from typing import Literal, Protocol

from objective_recovery_agent.external_reality_schemas import ExternalRealityView
from objective_recovery_agent.operator_actions import (
    CapabilityRegistry,
    OperatorActionCoordinator,
    OperatorAdapterError,
)
from objective_recovery_agent.operator_agents import AdkOperatorAgents, OperatorReasoningError
from objective_recovery_agent.operator_context import safe_text
from objective_recovery_agent.operator_schemas import (
    IntentInput,
    OperatorActionView,
    OperatorAgentTrace,
    OperatorFact,
    OperatorInspection,
    OperatorIntent,
    OperatorQuery,
    OperatorResponse,
    OperatorSnapshot,
    OperatorTarget,
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


def validate_intent(
    intent: OperatorIntent,
    snapshot: OperatorSnapshot,
    registry: CapabilityRegistry | None = None,
) -> str | None:
    if intent.incident_id != snapshot.incident_id:
        raise OperatorReasoningError("Intent changed the incident scope")
    if (
        intent.recovery_attempt is not None
        and intent.recovery_attempt not in snapshot.recovery_attempts
    ):
        raise OperatorReasoningError("Unknown recovery attempt")
    if not set(intent.fact_ids) <= {fact.fact_id for fact in snapshot.facts}:
        raise OperatorReasoningError("Unknown fact reference")
    if intent.disposition == "SUPPORTED" and intent.target is not None:
        capability = next(
            (
                item
                for item in (registry.capabilities() if registry else ())
                if item.authority == intent.target.authority
                and item.resource_type == intent.target.resource_type
            ),
            None,
        )
        if capability is None:
            raise OperatorReasoningError("Unknown external authority")
        if (
            capability.resource_identifiers
            and intent.target.resource_identifier not in capability.resource_identifiers
        ):
            raise OperatorReasoningError("Unknown external target")
        if intent.intent_type == "ACT" and not {
            item.operation for item in intent.requested_operations
        } <= set(capability.operations):
            raise OperatorReasoningError("Unknown action capability")
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
        action_coordinator: OperatorActionCoordinator | None = None,
    ) -> None:
        self._snapshot_reader = snapshot_reader
        self._calendar_reader = calendar_reader
        self._agents = agents or AdkOperatorAgents()
        self._actions = action_coordinator
        self._registry = action_coordinator.registry if action_coordinator else CapabilityRegistry()

    async def approve_action(
        self, action_id: str, subject_hash: str, role: str
    ) -> OperatorActionView:
        if self._actions is None:
            raise OperatorAdapterError("action_control_plane_unavailable")
        return await asyncio.to_thread(self._actions.approve, action_id, subject_hash, role)

    async def query(
        self,
        query: OperatorQuery,
        request_id: str,
        subject_hash: str = "0" * 64,
        role: str = "VIEWER",
    ) -> OperatorResponse:
        async with asyncio.timeout(70):
            snapshot = await self._snapshot_reader(query.incident_id)
            fingerprint = hashlib.sha256(
                json.dumps(
                    {"incident": query.incident_id, "message": query.message}, sort_keys=True
                ).encode()
            ).hexdigest()
            replay = None
            if query.idempotency_key and self._actions:
                replay = await asyncio.to_thread(
                    self._actions.replay, subject_hash, query.idempotency_key, fingerprint
                )
            bounded_query = OperatorQuery(
                incident_id=query.incident_id,
                message=safe_text(query.message, 1200),
                idempotency_key=query.idempotency_key,
            )
            if replay:
                intent = OperatorIntent(
                    disposition="SUPPORTED",
                    intent_type="ACT",
                    subject=(
                        "JIRA"
                        if replay.authority == "JIRA"
                        else "CALENDAR"
                        if replay.authority == "GOOGLE_CALENDAR"
                        else "SLACK"
                        if replay.authority == "SLACK"
                        else "OBJECTIVE"
                    ),
                    incident_id=query.incident_id,
                    question="Previously recorded Operator request",
                    hypothetical_changes=(),
                    constraints=(),
                    fact_ids=(),
                    target=OperatorTarget(
                        authority=replay.authority,
                        resource_type=replay.resource_type,
                        resource_identifier=replay.resource_identifier,
                    ),
                    requested_operations=replay.operations,
                )
                traces = []  # A durable replay is not another model invocation.
            else:
                intent, trace = await self._agents.interpret(
                    IntentInput(
                        request=bounded_query,
                        snapshot=snapshot,
                        capabilities=self._registry.capabilities(),
                    ),
                    request_id,
                )
                traces = [trace]
            # Validate even injected implementations; no unvalidated model output is used.
            intent = OperatorIntent.model_validate(intent)
            deadline = None if replay else validate_intent(intent, snapshot, self._registry)
            if (
                intent.disposition == "SUPPORTED"
                and intent.intent_type in {"INSPECT", "EXPLAIN"}
                and re.search(r"\boperator[\s-]+demo\b", query.message, re.IGNORECASE)
                and (
                    intent.subject != "CALENDAR"
                    or intent.target is None
                    or intent.target.authority != "GOOGLE_CALENDAR"
                    or intent.target.resource_type != "EVENT"
                )
            ):
                # A model omission must not substitute canonical recovery evidence.
                raise OperatorReasoningError("Dedicated Operator Calendar inspection unavailable")
            facts = tuple(
                fact
                for key in dict.fromkeys(intent.fact_ids)
                for fact in snapshot.facts
                if fact.fact_id == key
            )
            evidence_ids = {ref for fact in facts for ref in fact.evidence_ids}
            simulation = None
            inspection: OperatorInspection | None = None
            action = None
            external_effects = False
            response_disposition = intent.disposition
            provenance: Literal[
                "AUTHORITATIVE_SNAPSHOT", "HYPOTHETICAL_NO_ACTION", "OPERATOR_ACTION"
            ] = "AUTHORITATIVE_SNAPSHOT"
            if intent.disposition != "SUPPORTED":
                facts = ()
                evidence_ids = set()
                answer = (
                    "This request is not a supported Operator capability. "
                    if intent.disposition == "UNSUPPORTED"
                    else "Please clarify the request. "
                ) + str(intent.clarification)
            elif intent.intent_type == "ACT":
                if intent.target is None or self._actions is None:
                    raise OperatorReasoningError("Action control plane unavailable")
                if not query.idempotency_key:
                    raise OperatorAdapterError("action_idempotency_key_required")
                action = replay or await asyncio.to_thread(
                    self._actions.request,
                    request_id=request_id,
                    idempotency_key=query.idempotency_key,
                    subject_hash=subject_hash,
                    role=role,
                    target=intent.target,
                    operations=intent.requested_operations,
                    request_fingerprint=fingerprint,
                )
                if action is None:
                    raise OperatorReasoningError("Action receipt unavailable")
                provenance = "OPERATOR_ACTION"
                external_effects = bool(action.execution_acknowledgement)
                if action.error_category is not None and action.error_category in {
                    "jira_assignee_ambiguous",
                    "jira_assignee_not_found",
                    "jira_transition_ambiguous",
                    "jira_transition_unavailable",
                }:
                    response_disposition = "CLARIFICATION_REQUIRED"
                answer = {
                    "VERIFIED": "The authorized action was independently read back and VERIFIED.",
                    "VERIFICATION_FAILED": (
                        "The external write was acknowledged, but read-back did not match. "
                        "The action is not verified."
                    ),
                    "APPROVAL_REQUIRED": (
                        "This action requires explicit confirmation before execution."
                    ),
                    "DENIED": (
                        "Deterministic policy denied this action. No external action occurred."
                    ),
                    "FAILED": (
                        "The action is not verified. Some operations may have taken effect; "
                        "review the receipt. Retrying this request will not repeat writes."
                    ),
                }.get(action.lifecycle, f"Operator action state: {action.lifecycle}.")
                if response_disposition == "CLARIFICATION_REQUIRED":
                    answer = (
                        "Please clarify the Jira assignee or choose an actually available "
                        "workflow transition. No action occurred."
                    )
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
                if intent.subject == "SLACK":
                    if intent.target is None or intent.target.authority != "SLACK":
                        raise OperatorReasoningError("Slack inspection target missing")
                    try:
                        inspection = await asyncio.to_thread(self._registry.inspect, intent.target)
                    except OperatorAdapterError as error:
                        raise OperatorReasoningError("Slack inspection unavailable") from error
                    state = inspection.observed_state
                    evidence_ids = set()
                    facts = (
                        OperatorFact(
                            fact_id="slack:configured-release-channel",
                            text=safe_text(
                                f"Configured public Slack channel #{state.get('channel_name')} "
                                f"({state.get('channel_id')}); bot membership confirmed. "
                                "Latest Reflow-bot message in the bounded 15-message window: "
                                f"{state.get('latest_reflow_message_text') or 'none observed'}."
                            ),
                            evidence_ids=(),
                        ),
                    )
                    answer = facts[0].text
                elif intent.subject == "JIRA":
                    if intent.target is None:
                        raise OperatorReasoningError("Jira inspection target missing")
                    try:
                        inspection = await asyncio.to_thread(self._registry.inspect, intent.target)
                    except OperatorAdapterError as error:
                        raise OperatorReasoningError("External inspection unavailable") from error
                    state = inspection.observed_state
                    facts = (
                        OperatorFact(
                            fact_id=f"jira:{intent.target.resource_identifier}",
                            text=safe_text(
                                (
                                    f"Jira {intent.target.resource_identifier}: summary "
                                    f"{state.get('summary')}; status {state.get('status')}; "
                                    f"priority {state.get('priority')}; assignee "
                                    f"{state.get('assignee_display_name')}; due date "
                                    f"{state.get('due_date')}."
                                ),
                                800,
                            ),
                            evidence_ids=(),
                        ),
                    )
                    answer = facts[0].text
                elif intent.subject == "CALENDAR" and intent.target is not None:
                    if intent.target.authority != "GOOGLE_CALENDAR":
                        raise OperatorReasoningError("Calendar inspection target invalid")
                    try:
                        inspection = await asyncio.to_thread(self._registry.inspect, intent.target)
                    except OperatorAdapterError as error:
                        raise OperatorReasoningError(
                            "Dedicated Operator Calendar inspection unavailable"
                        ) from error
                    state = inspection.observed_state
                    evidence_ids = set()
                    facts = (
                        OperatorFact(
                            fact_id=f"calendar:{intent.target.resource_identifier}",
                            text=safe_text(
                                (
                                    f"Fresh Operator demo Calendar read-back at "
                                    f"{inspection.observed_at}: {state.get('title')}; "
                                    f"{state.get('start')} to {state.get('end')}; "
                                    f"status {state.get('status')}."
                                ),
                                800,
                            ),
                            evidence_ids=(),
                        ),
                    )
                    answer = facts[0].text
                elif intent.subject == "CALENDAR":
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
                    # Selected facts remain the only source of answer prose.
                    answer = "\n\n".join(fact.text for fact in facts)
                else:
                    answer = "\n\n".join(fact.text for fact in facts)
            return OperatorResponse(
                request_id=request_id,
                incident_id=snapshot.incident_id,
                revision=snapshot.revision,
                snapshot_fingerprint=snapshot.fingerprint,
                generated_at=datetime.now(UTC).isoformat(),
                disposition=response_disposition,
                intent=intent,
                answer=answer,
                facts=facts,
                evidence=tuple(
                    item for item in snapshot.evidence if item.evidence_id in evidence_ids
                ),
                simulation=simulation,
                inspection=inspection,
                action=action,
                hypothetical_deadline=deadline,
                provenance=provenance,
                external_effects_executed=external_effects,
                agents=tuple(traces),
            )
