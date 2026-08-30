from __future__ import annotations

import json
import re
from copy import deepcopy
from hashlib import sha256
from typing import Any, cast

import pytest
import requests
from objective_recovery_agent.agent_runtime import AgentId
from objective_recovery_agent.calendar_operator_adapter import (
    CalendarOperatorAdapter,
    OperatorCalendarGateway,
)
from objective_recovery_agent.calendar_operator_contract import (
    CALENDAR_CREATE_RESOURCE,
    CalendarEventCreation,
    CalendarReminderConfiguration,
    calendar_event_id,
)
from objective_recovery_agent.operator_actions import (
    ActionAuthorizationPolicy,
    CapabilityRegistry,
    InMemoryOperatorActionStore,
    OperatorActionCoordinator,
)
from objective_recovery_agent.operator_agents import INTENT_INSTRUCTION, OPERATOR_AGENT_NAMES
from objective_recovery_agent.operator_schemas import (
    ConversationEnvelope,
    IntentInput,
    OperatorIntent,
    OperatorQuery,
    OperatorTarget,
    RequestedOperation,
)
from objective_recovery_agent.operator_service import OperatorService
from pydantic import ValidationError

from test_operator_runtime import INCIDENT, REQUEST, FakeAgents, snapshot


def event(**changes: Any) -> CalendarEventCreation:
    return CalendarEventCreation.model_validate(
        {
            "summary": "Release review",
            "start": "2026-08-31T16:00:00+05:30",
            "end": "2026-08-31T17:00:00+05:30",
            "timezone": "Asia/Kolkata",
            "time_basis": "RELATIVE",
            "duration_minutes": 60,
            "description": "Review the release verification evidence.",
            "location": "Release room",
            "reminders": {"use_default": True},
            **changes,
        }
    )


def create_operation(value: CalendarEventCreation | None = None) -> RequestedOperation:
    return RequestedOperation(operation="CREATE_CALENDAR_EVENT", calendar_event=value or event())


def create_target(identifier: str = CALENDAR_CREATE_RESOURCE) -> OperatorTarget:
    return OperatorTarget(
        authority="GOOGLE_CALENDAR",
        resource_type="EVENT",
        resource_identifier=identifier,
    )


class CalendarCreateGateway:
    def __init__(self, *, mismatch: bool = False) -> None:
        self.events: dict[str, dict[str, Any]] = {}
        self.insert_calls = 0
        self.get_calls = 0
        self.mismatch = mismatch

    def get_event(self, calendar_id: str, event_id: str) -> dict[str, Any] | None:
        assert calendar_id == "operator-calendar"
        self.get_calls += 1
        value = deepcopy(self.events.get(event_id))
        if value is not None and self.mismatch:
            value["summary"] = "Different title"
        return value

    def insert_operator_event(
        self,
        calendar_id: str,
        event_id: str,
        action_id: str,
        value: CalendarEventCreation,
    ) -> dict[str, Any]:
        assert calendar_id == "operator-calendar"
        self.insert_calls += 1
        result: dict[str, Any] = {
            "id": event_id,
            "etag": '"created"',
            "summary": value.summary,
            "description": value.description,
            "location": value.location,
            "start": {"dateTime": value.start, "timeZone": value.timezone},
            "end": {"dateTime": value.end, "timeZone": value.timezone},
            "status": "confirmed",
            "reminders": {
                "useDefault": value.reminders.use_default,
                **(
                    {"overrides": [item.model_dump() for item in value.reminders.overrides]}
                    if value.reminders.overrides
                    else {}
                ),
            },
            "extendedProperties": {
                "private": {
                    "reflow_resource": "operator_created",
                    "reflow_action_id": action_id,
                }
            },
        }
        self.events[event_id] = deepcopy(result)
        return result


def adapter(
    gateway: CalendarCreateGateway | None = None,
    *,
    timezone: str = "Asia/Kolkata",
) -> CalendarOperatorAdapter:
    return CalendarOperatorAdapter(
        calendar_id="operator-calendar",
        demo_event_id="operator-demo",
        gateway=cast(Any, gateway or CalendarCreateGateway()),
        timezone=timezone,
    )


def coordinator(
    gateway: CalendarCreateGateway | None = None,
) -> tuple[OperatorActionCoordinator, CalendarCreateGateway]:
    selected = gateway or CalendarCreateGateway()
    control = OperatorActionCoordinator(
        CapabilityRegistry((adapter(selected),)), InMemoryOperatorActionStore()
    )
    return control, selected


def request_create(
    control: OperatorActionCoordinator,
    *,
    key: str = "calendar-create-request",
    operation: RequestedOperation | None = None,
    role: str = "OPERATOR",
    target: OperatorTarget | None = None,
) -> Any:
    return control.request(
        request_id=REQUEST,
        idempotency_key=key,
        subject_hash="a" * 64,
        role=role,
        target=target or create_target(),
        operations=(operation or create_operation(),),
    )


def create_intent(value: CalendarEventCreation | None = None) -> OperatorIntent:
    return OperatorIntent(
        disposition="SUPPORTED",
        intent_type="ACT",
        subject="CALENDAR",
        incident_id=INCIDENT,
        question="Create a release review tomorrow at 4 PM for one hour.",
        hypothetical_changes=(),
        constraints=("Resolved against the configured Calendar timezone.",),
        fact_ids=(),
        target=create_target(),
        requested_operations=(create_operation(value),),
    )


def create_conversation() -> ConversationEnvelope:
    return ConversationEnvelope(
        mode="TASK",
        user_goal="Create a release review tomorrow at 4 PM for one hour.",
        normalized_request="Create a release review tomorrow at 4 PM for one hour.",
        requested_capability="CALENDAR_CREATE",
        requires_operator=True,
        tone="neutral",
        confidence="HIGH",
    )


def test_create_contract_accepts_explicit_end_and_resolved_duration() -> None:
    explicit = event(duration_minutes=None, time_basis="ABSOLUTE")
    duration = event(duration_minutes=60)
    assert explicit.end == duration.end
    assert duration.timezone == "Asia/Kolkata"


def test_default_and_bounded_custom_reminders_are_typed() -> None:
    defaults = event()
    custom = event(
        reminders={
            "use_default": False,
            "overrides": [{"method": "popup", "minutes": 30}],
        }
    )
    email = event(
        reminders={
            "use_default": False,
            "overrides": [{"method": "email", "minutes": 60}],
        }
    )
    none = event(reminders={"use_default": False})
    assert defaults.reminders.use_default and not defaults.reminders.overrides
    assert custom.reminders.overrides[0].minutes == 30
    assert email.reminders.overrides[0].method == "email"
    assert not none.reminders.use_default and not none.reminders.overrides


@pytest.mark.parametrize(
    "reminders",
    [
        {"use_default": False, "overrides": [{"method": "sms", "minutes": 10}]},
        {"use_default": False, "overrides": [{"method": "popup", "minutes": -1}]},
        {"use_default": False, "overrides": [{"method": "popup", "minutes": 40_321}]},
        {
            "use_default": False,
            "overrides": [{"method": "popup", "minutes": index} for index in range(6)],
        },
        {"use_default": True, "overrides": [{"method": "popup", "minutes": 30}]},
        {
            "use_default": False,
            "overrides": [
                {"method": "popup", "minutes": 30},
                {"method": "popup", "minutes": 30},
            ],
        },
    ],
)
def test_malformed_or_unsupported_reminders_fail_closed(reminders: dict[str, Any]) -> None:
    with pytest.raises(ValidationError):
        event(reminders=reminders)


@pytest.mark.parametrize(
    "changes",
    [
        {"end": "2026-08-31T15:59:00+05:30", "duration_minutes": None},
        {"end": "2026-08-31T16:00:00+05:30", "duration_minutes": None},
        {"end": "2026-09-01T16:01:00+05:30", "duration_minutes": None},
        {"start": "2026-08-31T16:00:00", "duration_minutes": None},
        {"timezone": "Not/AZone"},
        {
            "start": "2026-03-08T02:30:00-05:00",
            "end": "2026-03-08T03:30:00-05:00",
            "timezone": "America/New_York",
        },
        {"duration_minutes": 30},
    ],
)
def test_invalid_ambiguous_or_incoherent_times_fail_closed(changes: dict[str, Any]) -> None:
    with pytest.raises(ValidationError):
        event(**changes)


def test_unknown_fields_and_attendees_are_not_in_the_contract() -> None:
    with pytest.raises(ValidationError):
        event(attendees=["person@example.invalid"])
    with pytest.raises(ValidationError):
        RequestedOperation.model_validate(
            {
                "operation": "CREATE_CALENDAR_EVENT",
                "calendar_event": {**event().model_dump(), "unknown": "denied"},
            }
        )
    with pytest.raises(ValidationError):
        RequestedOperation(operation="CREATE_CALENDAR_EVENT", value="untyped")


def test_create_policy_is_explicitly_allowlisted_and_target_scoped() -> None:
    selected = adapter()
    registry = CapabilityRegistry((selected,))
    policy = ActionAuthorizationPolicy()
    allowed, reason = policy.decide("OPERATOR", create_target(), (create_operation(),), registry)
    viewer, _ = policy.decide("VIEWER", create_target(), (create_operation(),), registry)
    wrong_target, _ = policy.decide(
        "OPERATOR", create_target("operator-demo"), (create_operation(),), registry
    )
    wrong_timezone, _ = policy.decide(
        "OPERATOR",
        create_target(),
        (
            create_operation(
                event(
                    start="2026-08-31T10:30:00+00:00",
                    end="2026-08-31T11:30:00+00:00",
                    timezone="Etc/UTC",
                )
            ),
        ),
        registry,
    )
    assert (allowed, reason) == ("AUTO_EXECUTABLE", "bounded_calendar_event_creation")
    assert viewer == wrong_target == wrong_timezone == "DENIED"


def test_adapter_create_acknowledgement_and_independent_readback_verify_exact_fields() -> None:
    control, gateway = coordinator()
    result = request_create(control)
    assert result.lifecycle == "VERIFIED"
    assert result.execution_acknowledgement["operation"] == "created"
    assert result.execution_acknowledgement["event_id"] == result.observed_state["event_id"]
    assert result.expected_state == result.observed_state
    assert result.expected_state["title"] == "Release review"
    assert result.expected_state["start_timezone"] == "Asia/Kolkata"
    assert '"minutes":30' not in result.expected_state["reminders"]
    assert gateway.insert_calls == 1 and gateway.get_calls >= 2


def test_custom_reminder_is_written_and_verified_semantically() -> None:
    control, _ = coordinator()
    created = request_create(
        control,
        operation=create_operation(
            event(
                reminders={
                    "use_default": False,
                    "overrides": [{"method": "popup", "minutes": 30}],
                }
            )
        ),
    )
    assert created.lifecycle == "VERIFIED"
    assert json.loads(created.observed_state["reminders"] or "{}")["overrides"] == [
        {"method": "popup", "minutes": 30}
    ]


def test_readback_mismatch_is_never_verified() -> None:
    control, gateway = coordinator(CalendarCreateGateway(mismatch=True))
    result = request_create(control)
    assert result.lifecycle == "VERIFICATION_FAILED"
    assert result.verification_result == "FAILED"
    assert result.observed_state["title"] == "Different title"
    assert gateway.insert_calls == 1


def test_same_idempotency_key_reuses_one_durable_result_and_one_insert() -> None:
    control, gateway = coordinator()
    first = request_create(control)
    replay = request_create(control)
    assert first == replay
    assert first.operator_action_id == replay.operator_action_id
    assert gateway.insert_calls == 1


def test_stable_external_id_recovers_a_preexisting_create_without_another_insert() -> None:
    key = "calendar-preexisting-request"
    action_id = sha256(f"{'a' * 64}|{key}".encode()).hexdigest()
    external_id = calendar_event_id(action_id)
    gateway = CalendarCreateGateway()
    gateway.insert_operator_event("operator-calendar", external_id, action_id, event())
    gateway.insert_calls = 0
    control, _ = coordinator(gateway)
    recovered = request_create(control, key=key)
    assert recovered.lifecycle == "VERIFIED"
    assert recovered.execution_acknowledgement["event_id"] == external_id
    assert gateway.insert_calls == 0


def test_receipt_preserves_resolved_action_facts_and_external_correlation() -> None:
    control, _ = coordinator()
    result = request_create(control)
    contract = result.operations[0].calendar_event
    assert contract is not None
    assert contract.start == "2026-08-31T16:00:00+05:30"
    assert contract.end == "2026-08-31T17:00:00+05:30"
    assert contract.duration_minutes == 60
    expected_id = calendar_event_id(result.operator_action_id)
    assert re.fullmatch(r"[0-9a-v]{5,1024}", expected_id)
    assert result.execution_acknowledgement["event_id"] == expected_id


def test_gateway_uses_existing_events_insert_contract_without_attendees_or_notifications() -> None:
    calls: list[tuple[str, str, dict[str, Any]]] = []

    class Session:
        def request(self, method: str, url: str, **kwargs: Any) -> requests.Response:
            calls.append((method, url, kwargs))
            response = requests.Response()
            response.status_code = 200
            response._content = json.dumps({"id": "ref12345", "etag": '"created"'}).encode()
            return response

    gateway = object.__new__(OperatorCalendarGateway)
    gateway._session = cast(Any, Session())
    gateway._request_timeout = 1
    response = gateway.insert_operator_event("operator-calendar", "ref12345", "action-1", event())
    method, url, options = calls[0]
    assert method == "POST" and url.endswith("/events") and response["id"] == "ref12345"
    assert options["params"] == {"sendUpdates": "none"}
    assert options["json"]["start"]["timeZone"] == "Asia/Kolkata"
    assert options["json"]["reminders"] == {"useDefault": True}
    assert "attendees" not in options["json"]


@pytest.mark.asyncio
async def test_agent6_typed_routing_reaches_the_governed_create_path() -> None:
    control, gateway = coordinator()
    agents = FakeAgents(create_intent())
    agents.conversation = create_conversation()

    async def read(_: str) -> Any:
        return snapshot()

    async def no_calendar_read(_: str) -> Any:
        pytest.fail("Calendar CREATE must use adapter read-back, not canonical recovery evidence")

    service = OperatorService(read, no_calendar_read, agents, control)
    query = OperatorQuery(
        incident_id=INCIDENT,
        message="Create a release review tomorrow at 4 PM for one hour.",
        idempotency_key="calendar-service-create",
    )
    result = await service.query(
        query,
        REQUEST,
        "a" * 64,
        "OPERATOR",
    )
    assert result.action is not None and result.action.lifecycle == "VERIFIED"
    assert result.human_response.human_summary.startswith("Created Release review for Monday")
    assert "independently read back" in result.human_response.current_state
    assert result.external_effects_executed
    assert gateway.insert_calls == 1
    payload = cast(IntentInput, agents.inputs[0])
    assert payload.interpretation_time is not None
    calendar = next(item for item in payload.capabilities if item.authority == "GOOGLE_CALENDAR")
    assert calendar.timezone == "Asia/Kolkata"
    assert CALENDAR_CREATE_RESOURCE in calendar.resource_identifiers
    replay = await service.query(query, REQUEST, "a" * 64, "OPERATOR")
    assert replay.action == result.action and replay.agents == ()
    assert len(agents.inputs) == len(agents.conversation_inputs) == 1
    assert gateway.insert_calls == 1


@pytest.mark.asyncio
async def test_missing_time_clarifies_before_policy_or_adapter() -> None:
    control, gateway = coordinator()
    clarification = OperatorIntent(
        disposition="CLARIFICATION_REQUIRED",
        subject="CALENDAR",
        incident_id=INCIDENT,
        question="Create a review tomorrow.",
        hypothetical_changes=(),
        constraints=(),
        fact_ids=(),
        clarification="What time and timezone should I use for the review?",
    )
    agents = FakeAgents(clarification)
    agents.conversation = create_conversation()

    async def read(_: str) -> Any:
        return snapshot()

    service = OperatorService(read, read, agents, control)
    result = await service.query(
        OperatorQuery(incident_id=INCIDENT, message="Create a review tomorrow."),
        REQUEST,
        "a" * 64,
        "OPERATOR",
    )
    assert result.disposition == "CLARIFICATION_REQUIRED"
    assert result.action is None and not result.external_effects_executed
    assert gateway.insert_calls == gateway.get_calls == 0


def test_agent_topology_and_non_tool_authority_boundary_remain_fixed() -> None:
    agents = tuple(item.value for item in AgentId) + OPERATOR_AGENT_NAMES
    assert len(agents) == len(set(agents)) == 8
    assert "CREATE_CALENDAR_EVENT" in INTENT_INSTRUCTION
    assert "never let the adapter infer it" in INTENT_INSTRUCTION
    assert CalendarReminderConfiguration(use_default=True).overrides == ()
