from __future__ import annotations

import json
from typing import Any, cast

import pytest
import requests
from objective_recovery_agent.calendar_operator_adapter import CalendarOperatorAdapter
from objective_recovery_agent.jira_operator_adapter import JiraOperatorAdapter
from objective_recovery_agent.operator_actions import (
    ActionAuthorizationPolicy,
    AdapterExecution,
    CapabilityRegistry,
    InMemoryOperatorActionStore,
    OperatorActionCoordinator,
    OperatorAdapterError,
)
from objective_recovery_agent.operator_agents import AdkOperatorAgents
from objective_recovery_agent.operator_schemas import (
    Authority,
    IntentInput,
    OperationType,
    OperatorIntent,
    OperatorQuery,
    OperatorTarget,
    RequestedOperation,
    ResourceType,
)
from objective_recovery_agent.operator_service import OperatorService
from pydantic import ValidationError

from test_operator_runtime import INCIDENT, REQUEST, FakeAgents, snapshot


class FakeAdapter:
    authority: Authority = "JIRA"
    resource_type: ResourceType = "ISSUE"
    operations = frozenset(
        {
            "JIRA_TRANSITION",
            "JIRA_ADD_COMMENT",
            "JIRA_ASSIGN",
            "JIRA_SET_PRIORITY",
        }
    )
    resource_identifiers: tuple[str, ...] = ("API-42",)

    def __init__(self, *, mismatch: bool = False, failure: str | None = None) -> None:
        self.state: dict[str, str | None] = {
            "issue_key": "API-42",
            "status": "Open",
            "priority": "Medium",
            "assignee_account_id": None,
        }
        self.mismatch = mismatch
        self.failure = failure
        self.inspects = 0
        self.executions = 0

    def permits_target(self, target: OperatorTarget) -> bool:
        return target.resource_identifier in self.resource_identifiers

    def inspect(self, target: OperatorTarget) -> dict[str, str | None]:
        if not self.permits_target(target):
            raise OperatorAdapterError("target_missing")
        self.inspects += 1
        return dict(self.state)

    def execute(
        self,
        action_id: str,
        target: OperatorTarget,
        operations: tuple[RequestedOperation, ...],
        current: dict[str, str | None],
        proposal: dict[str, str],
    ) -> AdapterExecution:
        del action_id, target, current, proposal
        self.executions += 1
        if self.failure:
            raise OperatorAdapterError(self.failure)
        expected: dict[str, str | None] = {}
        for item in operations:
            if item.operation == "JIRA_TRANSITION":
                expected["status"] = item.value
            elif item.operation == "JIRA_SET_PRIORITY":
                expected["priority"] = item.value
            elif item.operation == "JIRA_ASSIGN":
                expected["assignee_account_id"] = "account-1"
            elif item.operation == "JIRA_ADD_COMMENT":
                expected["comment:1"] = item.comment
        if not self.mismatch:
            self.state.update(expected)
        return AdapterExecution(expected, {"write": "acknowledged"})

    def propose(
        self,
        target: OperatorTarget,
        operations: tuple[RequestedOperation, ...],
        current: dict[str, str | None],
    ) -> dict[str, str]:
        del target, operations, current
        return {}

    def read_back(
        self, target: OperatorTarget, acknowledgement: dict[str, str]
    ) -> dict[str, str | None]:
        assert acknowledgement["write"] == "acknowledged"
        return self.inspect(target)

    def verify(
        self, expected: dict[str, str | None], observed: dict[str, str | None]
    ) -> tuple[bool, dict[str, str]]:
        differences = [key for key, value in expected.items() if observed.get(key) != value]
        return not differences, {"difference_count": str(len(differences))}


def target(authority: str = "JIRA", identifier: str = "API-42") -> OperatorTarget:
    resource = {"JIRA": "ISSUE", "GOOGLE_CALENDAR": "EVENT", "REFLOW": "OBJECTIVE"}[authority]
    return OperatorTarget(
        authority=cast(Authority, authority),
        resource_type=cast(ResourceType, resource),
        resource_identifier=identifier,
    )


def operation(name: str = "JIRA_TRANSITION", value: str = "Blocked") -> RequestedOperation:
    if name == "JIRA_ADD_COMMENT":
        return RequestedOperation(operation=cast(OperationType, name), comment=value)
    return RequestedOperation(operation=cast(OperationType, name), value=value)


def coordinator(adapter: FakeAdapter) -> OperatorActionCoordinator:
    return OperatorActionCoordinator(CapabilityRegistry((adapter,)), InMemoryOperatorActionStore())


def test_auto_execution_read_back_verification_and_duplicate_retry() -> None:
    adapter = FakeAdapter()
    control = coordinator(adapter)
    first = control.request(
        request_id="request-1",
        idempotency_key="browser-request-1",
        subject_hash="a" * 64,
        role="OPERATOR",
        target=target(),
        operations=(operation(), operation("JIRA_ADD_COMMENT", "Backend unavailable.")),
    )
    replay = control.request(
        request_id="request-2",
        idempotency_key="browser-request-1",
        subject_hash="a" * 64,
        role="OPERATOR",
        target=target(),
        operations=(operation(), operation("JIRA_ADD_COMMENT", "Backend unavailable.")),
    )
    assert first.lifecycle == "VERIFIED"
    assert first.verification_result == "PASSED"
    assert all(
        first.observed_state.get(key) == value for key, value in first.expected_state.items()
    )
    assert replay == first and adapter.executions == 2


def test_viewer_hard_denial_and_target_scope_never_call_adapter() -> None:
    adapter = FakeAdapter()
    control = coordinator(adapter)
    viewer = control.request(
        request_id="request-viewer",
        idempotency_key="browser-viewer",
        subject_hash="b" * 64,
        role="VIEWER",
        target=target(),
        operations=(operation(),),
    )
    protected = control.request(
        request_id="request-protected",
        idempotency_key="browser-protected",
        subject_hash="b" * 64,
        role="OPERATOR",
        target=target("REFLOW", "protected-objective-deadline"),
        operations=(operation("MOVE_PROTECTED_DEADLINE", "120"),),
    )
    outside = control.request(
        request_id="request-outside",
        idempotency_key="browser-outside",
        subject_hash="b" * 64,
        role="OPERATOR",
        target=target("JIRA", "API-99"),
        operations=(operation(),),
    )
    assert {viewer.lifecycle, protected.lifecycle, outside.lifecycle} == {"DENIED"}
    assert adapter.inspects == adapter.executions == 0


def test_approval_execution_and_replay_are_single_use() -> None:
    adapter = FakeAdapter()
    control = coordinator(adapter)
    pending = control.request(
        request_id="request-approval",
        idempotency_key="browser-approval",
        subject_hash="c" * 64,
        role="OPERATOR",
        target=target(),
        operations=(operation("JIRA_ASSIGN", "Srishti"),),
    )
    assert pending.lifecycle == "APPROVAL_REQUIRED" and adapter.executions == 0
    with pytest.raises(OperatorAdapterError, match="approval_not_authorized"):
        control.approve(pending.operator_action_id, "d" * 64, "OPERATOR")
    completed = control.approve(pending.operator_action_id, "c" * 64, "OPERATOR")
    replay = control.approve(pending.operator_action_id, "c" * 64, "OPERATOR")
    assert completed.lifecycle == "VERIFIED" and replay == completed
    assert adapter.executions == 1


def test_mismatch_failure_and_idempotency_conflict_never_report_verified() -> None:
    adapter = FakeAdapter(mismatch=True)
    control = coordinator(adapter)
    failed = control.request(
        request_id="request-mismatch",
        idempotency_key="browser-mismatch",
        subject_hash="e" * 64,
        role="OPERATOR",
        target=target(),
        operations=(operation(),),
    )
    assert failed.lifecycle == "VERIFICATION_FAILED"
    assert failed.verification_result == "FAILED"
    with pytest.raises(OperatorAdapterError, match="idempotency_conflict"):
        control.request(
            request_id="request-conflict",
            idempotency_key="browser-mismatch",
            subject_hash="e" * 64,
            role="OPERATOR",
            target=target(),
            operations=(operation("JIRA_SET_PRIORITY", "High"),),
        )


def test_adapter_failure_is_safe_and_audited_without_secret_text() -> None:
    adapter = FakeAdapter(failure="jira_timeout")
    failed = coordinator(adapter).request(
        request_id="request-timeout",
        idempotency_key="browser-timeout",
        subject_hash="f" * 64,
        role="OPERATOR",
        target=target(),
        operations=(operation(),),
    )
    assert failed.lifecycle == "FAILED"
    assert failed.error_category == "jira_timeout"
    assert failed.execution_acknowledgement == {}


@pytest.mark.parametrize(
    "value,expected",
    [("60", "AUTO_EXECUTABLE"), ("180", "APPROVAL_REQUIRED"), ("600", "DENIED")],
)
def test_calendar_shift_policy_bounds(value: str, expected: str) -> None:
    adapter = FakeAdapter()
    adapter.authority = "GOOGLE_CALENDAR"
    adapter.resource_type = "EVENT"
    adapter.operations = frozenset({"CALENDAR_RESCHEDULE"})
    adapter.resource_identifiers = ("operator-demo",)
    decision, _ = ActionAuthorizationPolicy().decide(
        "OPERATOR",
        target("GOOGLE_CALENDAR", "operator-demo"),
        (operation("CALENDAR_RESCHEDULE", value),),
        CapabilityRegistry((adapter,)),
    )
    assert decision == expected


def test_act_schema_is_typed_and_malformed_model_output_is_rejected() -> None:
    valid = {
        "disposition": "SUPPORTED",
        "intent_type": "ACT",
        "subject": "JIRA",
        "incident_id": "incident-test",
        "recovery_attempt": None,
        "question": "Mark API-42 blocked",
        "hypothetical_changes": [],
        "constraints": [],
        "fact_ids": [],
        "target": {
            "authority": "JIRA",
            "resource_type": "ISSUE",
            "resource_identifier": "API-42",
        },
        "requested_operations": [{"operation": "JIRA_TRANSITION", "value": "Blocked"}],
        "clarification": None,
    }
    assert OperatorIntent.model_validate(valid).intent_type == "ACT"
    for change in (
        {"requested_operations": [{"operation": "jira.do_anything", "value": "x"}]},
        {"target": None},
        {"fact_ids": ["invented"]},
        {"requested_operations": [{"operation": "JIRA_ADD_COMMENT", "value": "wrong"}]},
    ):
        with pytest.raises(ValidationError):
            OperatorIntent.model_validate({**valid, **change})


def act_intent(role_target: OperatorTarget | None = None) -> OperatorIntent:
    selected = role_target or target()
    return OperatorIntent(
        disposition="SUPPORTED",
        intent_type="ACT",
        subject="JIRA" if selected.authority == "JIRA" else "OBJECTIVE",
        incident_id=INCIDENT,
        recovery_attempt=None,
        question="Mark API-42 blocked",
        hypothetical_changes=(),
        constraints=(),
        fact_ids=(),
        target=selected,
        requested_operations=(
            operation("MOVE_PROTECTED_DEADLINE", "120")
            if selected.authority == "REFLOW"
            else operation(),
        ),
        clarification=None,
    )


@pytest.mark.asyncio
async def test_agent_6_act_routes_to_code_policy_and_adapter_only_for_operator() -> None:
    async def read(_: str) -> Any:
        return snapshot()

    async def calendar(_: str) -> Any:
        raise AssertionError("ACT must not enter canonical Calendar recovery reads")

    viewer_adapter = FakeAdapter()
    viewer_agents = FakeAgents(act_intent())
    viewer = OperatorService(
        read,
        calendar,
        viewer_agents,
        coordinator(viewer_adapter),
    )
    denied = await viewer.query(
        OperatorQuery(
            incident_id=INCIDENT,
            message="Mark API-42 blocked",
            idempotency_key="browser-service-viewer",
        ),
        REQUEST,
        "1" * 64,
        "VIEWER",
    )
    assert denied.action is not None and denied.action.lifecycle == "DENIED"
    assert viewer_adapter.executions == 0
    payload = viewer_agents.inputs[0]
    assert isinstance(payload, IntentInput)
    assert payload.capabilities[0].resource_identifiers == ("API-42",)

    operator_adapter = FakeAdapter()
    operator = OperatorService(
        read,
        calendar,
        FakeAgents(act_intent()),
        coordinator(operator_adapter),
    )
    verified = await operator.query(
        OperatorQuery(
            incident_id=INCIDENT,
            message="Mark API-42 blocked",
            idempotency_key="browser-service-operator",
        ),
        REQUEST,
        "2" * 64,
        "OPERATOR",
    )
    assert verified.provenance == "OPERATOR_ACTION"
    assert verified.action is not None and verified.action.lifecycle == "VERIFIED"
    assert verified.external_effects_executed is True
    assert verified.simulation is None and operator_adapter.executions == 1


@pytest.mark.asyncio
async def test_agent_6_act_uses_real_adk_gemini_interface(monkeypatch: Any) -> None:
    from google.adk.models import Gemini
    from google.adk.models.llm_response import LlmResponse
    from google.genai import types

    expected = act_intent()
    calls: list[Any] = []

    async def generate(self: Any, llm_request: Any, stream: bool = False) -> Any:
        calls.append(llm_request)
        yield LlmResponse(
            content=types.Content(
                role="model",
                parts=[types.Part.from_text(text=expected.model_dump_json())],
            )
        )

    monkeypatch.setattr(Gemini, "generate_content_async", generate)
    adapter = FakeAdapter()
    result, _ = await AdkOperatorAgents().interpret(
        IntentInput(
            request=OperatorQuery(
                incident_id=INCIDENT,
                message="Mark API-42 blocked",
                idempotency_key="browser-real-adk-act",
            ),
            snapshot=snapshot(),
            capabilities=CapabilityRegistry((adapter,)).capabilities(),
        ),
        REQUEST,
    )
    assert result == expected and result.intent_type == "ACT" and calls
    assert "Mark API-42 blocked" in str(calls[0].contents)


class ResponseStub:
    def __init__(self, status: int, payload: Any = None) -> None:
        self.status_code = status
        self.ok = 200 <= status < 300
        self._payload = payload

    def json(self) -> Any:
        if isinstance(self._payload, Exception):
            raise self._payload
        return self._payload


class JiraSession:
    def __init__(self) -> None:
        self.auth: tuple[str, str] | None = None
        self.headers: dict[str, str] = {}
        self.state: dict[str, Any] = {
            "summary": "Demo issue",
            "status": {"name": "Open"},
            "priority": {"name": "Medium"},
            "assignee": None,
            "duedate": None,
            "description": {"type": "doc", "content": []},
        }
        self.comments: dict[str, Any] = {}
        self.calls: list[tuple[str, str, dict[str, Any]]] = []
        self.users: list[dict[str, Any]] = [
            {"accountId": "account-1", "displayName": "Srishti", "active": True}
        ]

    def request(self, method: str, url: str, **kwargs: Any) -> ResponseStub:
        self.calls.append((method, url, kwargs))
        path = url.split("/rest/api/3", 1)[1]
        if path == "/issue/API-42" and method == "GET":
            return ResponseStub(200, {"key": "API-42", "fields": self.state})
        if path == "/issue/API-42/transitions" and method == "GET":
            return ResponseStub(
                200,
                {"transitions": [{"id": "31", "name": "Block", "to": {"name": "Blocked"}}]},
            )
        if path == "/issue/API-42/transitions" and method == "POST":
            self.state["status"] = {"name": "Blocked"}
            return ResponseStub(204)
        if path == "/issue/API-42" and method == "PUT":
            fields = kwargs["json"]["fields"]
            if "priority" in fields:
                self.state["priority"] = fields["priority"]
            if "duedate" in fields:
                self.state["duedate"] = fields["duedate"]
            return ResponseStub(204)
        if path == "/user/assignable/search" and method == "GET":
            return ResponseStub(200, self.users)
        if path == "/issue/API-42/assignee" and method == "PUT":
            self.state["assignee"] = {
                "accountId": kwargs["json"]["accountId"],
                "displayName": "Srishti",
            }
            return ResponseStub(204)
        if path == "/issue/API-42/comment" and method == "POST":
            self.comments["10001"] = kwargs["json"]["body"]
            return ResponseStub(201, {"id": "10001"})
        if path == "/issue/API-42/comment/10001" and method == "GET":
            return ResponseStub(200, {"id": "10001", "body": self.comments["10001"]})
        return ResponseStub(404, {"errorMessages": ["not found"]})


def jira(session: Any | None = None) -> JiraOperatorAdapter:
    return JiraOperatorAdapter(
        base_url="https://demo.atlassian.net",
        email="operator@example.invalid",
        api_token="secret-token",
        demo_issue_key="API-42",
        allowed_account_ids=frozenset({"account-1", "account-2"}),
        session=session or JiraSession(),
    )


def test_jira_inspect_mutations_transition_discovery_and_readback() -> None:
    session = JiraSession()
    adapter = jira(session)
    current = adapter.inspect(target())
    operations = (
        operation(),
        operation("JIRA_SET_PRIORITY", "High"),
        operation("JIRA_SET_DUE_DATE", "2026-09-01"),
        operation("JIRA_ADD_COMMENT", "Backend engineer unavailable."),
    )
    execution = adapter.execute(
        "action-1",
        target(),
        operations,
        current,
        adapter.propose(target(), operations, current),
    )
    observed = adapter.read_back(target(), execution.acknowledgement)
    passed, proof = adapter.verify(execution.expected_state, observed)
    assert current["summary"] == "Demo issue"
    assert observed["status"] == "Blocked" and observed["priority"] == "High"
    assert observed["due_date"] == "2026-09-01"
    assert observed["comment:10001"] == "Backend engineer unavailable."
    assert passed and proof["difference_count"] == "0"
    assert all(call[2].get("allow_redirects") is False for call in session.calls)


def test_jira_assignee_resolution_is_exact_bounded_and_ambiguous_safe() -> None:
    session = JiraSession()
    adapter = jira(session)
    operations = (operation("JIRA_ASSIGN", "Srishti"),)
    current = adapter.inspect(target())
    result = adapter.execute(
        "action-assign",
        target(),
        operations,
        current,
        adapter.propose(target(), operations, current),
    )
    assert result.expected_state["assignee_account_id"] == "account-1"
    session.users.append({"accountId": "account-2", "displayName": "Srishti", "active": True})
    with pytest.raises(OperatorAdapterError, match="jira_assignee_ambiguous"):
        adapter.propose(
            target(),
            operations,
            adapter.inspect(target()),
        )


@pytest.mark.parametrize(
    "status,category",
    [(401, "jira_authentication"), (403, "jira_permission"), (404, "jira_not_found")],
)
def test_jira_error_mapping_has_no_secret_leakage(status: int, category: str) -> None:
    class Failing(JiraSession):
        def request(self, *args: Any, **kwargs: Any) -> ResponseStub:
            return ResponseStub(status, {"secret": "secret-token"})

    with pytest.raises(OperatorAdapterError, match=category) as caught:
        jira(Failing()).inspect(target())
    assert "secret-token" not in str(caught.value)


def test_jira_timeout_invalid_transition_priority_due_date_and_target() -> None:
    class Timeout(JiraSession):
        def request(self, *args: Any, **kwargs: Any) -> ResponseStub:
            raise requests.Timeout("secret-token")

    with pytest.raises(OperatorAdapterError, match="jira_timeout"):
        jira(Timeout()).inspect(target())
    adapter = jira(JiraSession())
    with pytest.raises(OperatorAdapterError, match="jira_transition_unavailable"):
        adapter.propose(
            target(),
            (operation("JIRA_TRANSITION", "Impossible"),),
            adapter.inspect(target()),
        )
    with pytest.raises(OperatorAdapterError, match="jira_priority_not_allowed"):
        adapter.propose(
            target(),
            (operation("JIRA_SET_PRIORITY", "Critical-ish"),),
            adapter.inspect(target()),
        )
    with pytest.raises(OperatorAdapterError, match="jira_due_date_invalid"):
        adapter.propose(
            target(),
            (operation("JIRA_SET_DUE_DATE", "tomorrow"),),
            adapter.inspect(target()),
        )
    assert not adapter.permits_target(target(identifier="API-99"))


class CalendarGatewayStub:
    def __init__(self) -> None:
        self.value: dict[str, Any] | None = {
            "id": "operator-demo",
            "summary": "Reflow Operator Demo — Coordination",
            "description": "Demo",
            "start": {"dateTime": "2026-08-28T15:00:00+05:30"},
            "end": {"dateTime": "2026-08-28T16:00:00+05:30"},
            "status": "confirmed",
            "etag": "before",
            "extendedProperties": {"private": {"reflow_resource": "operator_demo"}},
        }
        self.patches: list[dict[str, object]] = []

    def get_event(self, calendar_id: str, event_id: str) -> dict[str, Any] | None:
        assert calendar_id == "demo-calendar" and event_id == "operator-demo"
        return json.loads(json.dumps(self.value)) if self.value else None

    def patch_event(
        self,
        calendar_id: str,
        event_id: str,
        payload: dict[str, object],
        etag: str | None,
    ) -> dict[str, Any]:
        assert etag == "before"
        self.patches.append(payload)
        assert self.value is not None
        self.value.update(payload)
        self.value["etag"] = "after"
        return self.value


def test_calendar_demo_mutation_independent_readback_and_target_lock() -> None:
    gateway = CalendarGatewayStub()
    adapter = CalendarOperatorAdapter(
        calendar_id="demo-calendar",
        demo_event_id="operator-demo",
        gateway=gateway,  # type: ignore[arg-type]
    )
    current = adapter.inspect(target("GOOGLE_CALENDAR", "operator-demo"))
    execution = adapter.execute(
        "calendar-action",
        target("GOOGLE_CALENDAR", "operator-demo"),
        (
            operation("CALENDAR_RESCHEDULE", "60"),
            operation("CALENDAR_UPDATE_DESCRIPTION", "Updated safely"),
        ),
        current,
        adapter.propose(
            target("GOOGLE_CALENDAR", "operator-demo"),
            (
                operation("CALENDAR_RESCHEDULE", "60"),
                operation("CALENDAR_UPDATE_DESCRIPTION", "Updated safely"),
            ),
            current,
        ),
    )
    observed = adapter.read_back(
        target("GOOGLE_CALENDAR", "operator-demo"), execution.acknowledgement
    )
    passed, _ = adapter.verify(execution.expected_state, observed)
    assert observed["start"] == "2026-08-28T16:00:00+05:30"
    assert observed["end"] == "2026-08-28T17:00:00+05:30"
    assert observed["description"] == "Updated safely" and passed
    assert not adapter.permits_target(target("GOOGLE_CALENDAR", "canonical-p2e-event"))


def test_calendar_missing_resource_and_readback_mismatch_are_not_verified() -> None:
    gateway = CalendarGatewayStub()
    adapter = CalendarOperatorAdapter(
        calendar_id="demo-calendar",
        demo_event_id="operator-demo",
        gateway=gateway,  # type: ignore[arg-type]
    )
    gateway.value = None
    with pytest.raises(OperatorAdapterError, match="calendar_resource_missing"):
        adapter.inspect(target("GOOGLE_CALENDAR", "operator-demo"))
    passed, proof = adapter.verify({"start": "expected"}, {"start": "observed"})
    assert not passed and proof["comparison"] == "FAILED"


def test_partial_write_failure_preserves_ack_and_never_repeats() -> None:
    class Partial(FakeAdapter):
        def execute(self, *args: Any, **kwargs: Any) -> AdapterExecution:
            if self.executions:
                self.executions += 1
                raise OperatorAdapterError("jira_timeout")
            return super().execute(*args, **kwargs)

    adapter = Partial()
    store = InMemoryOperatorActionStore()
    control = OperatorActionCoordinator(CapabilityRegistry((adapter,)), store)
    kwargs: dict[str, Any] = dict(
        request_id=REQUEST,
        idempotency_key="partial-request",
        subject_hash="a" * 64,
        role="OPERATOR",
        target=target(),
        operations=(operation(), operation("JIRA_ADD_COMMENT", "Backend unavailable.")),
    )
    failed = control.request(**kwargs)
    assert failed.lifecycle == "FAILED" and failed.external_effects_possible
    assert failed.observed_state["status"] == "Blocked"
    assert failed.execution_acknowledgement and failed.verification_result != "PASSED"
    restarted = OperatorActionCoordinator(control.registry, store)
    assert restarted.request(**kwargs) == failed
    assert adapter.executions == 2


def test_stale_approval_and_duplicate_operations_do_not_write() -> None:
    adapter = FakeAdapter()
    control = coordinator(adapter)
    kwargs: dict[str, Any] = dict(
        request_id=REQUEST, subject_hash="a" * 64, role="OPERATOR", target=target()
    )
    pending = control.request(
        **kwargs,
        idempotency_key="stale-approval",
        operations=(operation("JIRA_ASSIGN", "Srishti"),),
    )
    adapter.state["status"] = "Different"
    result = control.approve(pending.operator_action_id, "a" * 64, "OPERATOR")
    assert result.lifecycle == "FAILED" and result.error_category == "proposal_stale_request_again"
    assert not result.external_effects_possible
    duplicate = control.request(
        **kwargs, idempotency_key="duplicate-op", operations=(operation(), operation())
    )
    assert duplicate.lifecycle == "DENIED" and adapter.executions == 0


def test_concurrent_duplicate_requests_have_one_owner() -> None:
    from concurrent.futures import ThreadPoolExecutor

    adapter = FakeAdapter()
    control = coordinator(adapter)

    def request() -> Any:
        return control.request(
            request_id=REQUEST,
            subject_hash="a" * 64,
            idempotency_key="concurrent-request",
            role="OPERATOR",
            target=target(),
            operations=(operation(),),
        )

    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(lambda _: request(), range(12)))
    assert len({item.operator_action_id for item in results}) == 1
    assert adapter.executions == 1


def test_unmarked_calendar_and_lossy_comment_verification_are_rejected() -> None:
    gateway = CalendarGatewayStub()
    assert gateway.value is not None
    gateway.value.pop("extendedProperties")
    adapter = CalendarOperatorAdapter(
        calendar_id="demo-calendar", demo_event_id="operator-demo", gateway=cast(Any, gateway)
    )
    with pytest.raises(OperatorAdapterError, match="calendar_not_isolated_operator_demo"):
        adapter.inspect(target("GOOGLE_CALENDAR", "operator-demo"))
    assert not jira().verify({"comment:1": "Secret ABC"}, {"comment:1": "Secret abc"})[0]
    assert adapter.verify(
        {"start": "2026-08-28T16:00:00+05:30"}, {"start": "2026-08-28T10:30:00Z"}
    )[0]


def test_comment_long_text_exact_readback_and_assignment_disabled_by_default() -> None:
    adapter = JiraOperatorAdapter(
        base_url="https://demo.atlassian.net",
        email="operator@example.invalid",
        api_token="not-a-real-secret",
        demo_issue_key="API-42",
        session=JiraSession(),
    )
    assert "JIRA_ASSIGN" not in adapter.operations
    op = operation("JIRA_ADD_COMMENT", "A" * 950)
    current = adapter.inspect(target())
    result = adapter.execute(
        "action", target(), (op,), current, adapter.propose(target(), (op,), current)
    )
    assert adapter.verify(
        result.expected_state, adapter.read_back(target(), result.acknowledgement)
    )[0]


def test_forged_verified_receipt_rejected() -> None:
    from objective_recovery_agent.operator_schemas import OperatorActionView

    from test_operator_api import action_view

    with pytest.raises(ValidationError):
        OperatorActionView.model_validate({**action_view().model_dump(), "lifecycle": "VERIFIED"})


@pytest.mark.asyncio
async def test_browser_replay_reuses_durable_action_without_model_reinterpretation() -> None:
    async def read(_: str) -> Any:
        return snapshot()

    adapter = FakeAdapter()
    agents = FakeAgents(act_intent())
    service = OperatorService(read, read, agents, coordinator(adapter))
    query = OperatorQuery(
        incident_id=INCIDENT,
        message="Mark API-42 blocked",
        idempotency_key="raw-request-idempotency",
    )
    first = await service.query(query, REQUEST, "a" * 64, "OPERATOR")
    second = await service.query(query, REQUEST, "a" * 64, "OPERATOR")
    assert first.action == second.action
    assert len(agents.inputs) == 1 and second.agents == () and adapter.executions == 1
    with pytest.raises(OperatorAdapterError, match="idempotency_conflict"):
        await service.query(
            query.model_copy(update={"message": "Mark API-42 done"}), REQUEST, "a" * 64, "OPERATOR"
        )


def test_firestore_claim_decode_replay_and_transition_guards(monkeypatch: Any) -> None:
    from objective_recovery_agent.operator_actions import FirestoreOperatorActionStore

    from test_operator_api import action_view

    documents: dict[str, Any] = {}

    class Reference:
        def __init__(self, key: str) -> None:
            self.key = key

        def get(self, **kwargs: Any) -> Any:
            from types import SimpleNamespace

            return SimpleNamespace(
                exists=self.key in documents,
                to_dict=lambda: json.loads(json.dumps(documents[self.key])),
            )

    class Transaction:
        def create(self, ref: Reference, value: Any) -> None:
            assert ref.key not in documents
            documents[ref.key] = value

        def update(self, ref: Reference, value: Any) -> None:
            documents[ref.key].update(value)

    class Client:
        def collection(self, name: str) -> Any:
            assert name == "operator_actions"
            return self

        def document(self, key: str) -> Reference:
            return Reference(key)

        def transaction(self) -> Transaction:
            return Transaction()

    monkeypatch.setattr(
        "objective_recovery_agent.operator_actions.firestore.Client", lambda **_: Client()
    )
    monkeypatch.setattr(
        "objective_recovery_agent.operator_actions.firestore.transactional", lambda f: f
    )
    store = FirestoreOperatorActionStore("test-project")
    action = action_view()
    assert store.claim(action, "fingerprint") == (True, action)
    restarted = FirestoreOperatorActionStore("test-project")
    assert restarted.claim(action, "fingerprint") == (False, action)
    assert restarted.get(action.operator_action_id) == action
    with pytest.raises(OperatorAdapterError, match="idempotency_conflict"):
        restarted.claim(action, "changed")
    with pytest.raises(OperatorAdapterError, match="invalid_action_transition"):
        restarted.advance(action, frozenset({"VERIFIED"}))
    approved = action.model_copy(update={"lifecycle": "APPROVED"})
    assert restarted.advance(approved, frozenset({"APPROVAL_REQUIRED"})) == approved
    assert store.get(action.operator_action_id) == approved
