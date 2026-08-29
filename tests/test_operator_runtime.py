from __future__ import annotations

import ast
import asyncio
import json
import subprocess
import time
from pathlib import Path
from typing import Any

import pytest
from google.adk.workflow._errors import NodeTimeoutError
from objective_recovery_agent import operator_agents
from objective_recovery_agent.operator_agents import AdkOperatorAgents, OperatorReasoningError
from objective_recovery_agent.operator_context import build_snapshot, safe_text
from objective_recovery_agent.operator_schemas import (
    ConversationEnvelope,
    ConversationInput,
    IntentInput,
    OperatorAgentTrace,
    OperatorIntent,
    OperatorQuery,
    OperatorSnapshot,
    SimulationInput,
    SimulationResult,
)
from objective_recovery_agent.operator_service import (
    OperatorService,
    _finish_sentence,
    validate_intent,
)
from objective_recovery_agent.planning import MODEL_ID, WorkflowResult
from objective_recovery_agent.ui_schemas import ExecutionEventsView, RecoveryCaseView
from pydantic import ValidationError

ROOT = Path(__file__).parents[1]
INCIDENT = "incident-0fc3af5b0bd1ad847aea"
REQUEST = "12345678-1234-1234-1234-123456789abc"


def test_slack_human_summary_does_not_duplicate_terminal_punctuation() -> None:
    message = "Backend engineer unavailable. SCRUM-6 is blocked."
    assert _finish_sentence(message) == message
    assert _finish_sentence("No message observed") == "No message observed."


def snapshot() -> OperatorSnapshot:
    fixtures = ROOT / "docs/ui-fixtures"
    return build_snapshot(
        INCIDENT,
        RecoveryCaseView.model_validate_json((fixtures / "recovery-restored.json").read_bytes()),
        ExecutionEventsView.model_validate_json((fixtures / "events.json").read_bytes()),
    )


def intent(kind: str = "EXPLAIN", **changes: Any) -> OperatorIntent:
    return OperatorIntent.model_validate(
        {
            "disposition": "SUPPORTED",
            "intent_type": kind,
            "subject": "RECOVERY",
            "incident_id": INCIDENT,
            "recovery_attempt": 1,
            "question": "Why did Recovery 1 fail?",
            "hypothetical_changes": (
                [{"kind": "DEADLINE_SHIFT_MINUTES", "target": "release-v2", "value": "120"}]
                if kind == "SIMULATE"
                else []
            ),
            "constraints": [],
            "fact_ids": [
                "action:calendar-9899dba7a849a328a49d",
                "invariant:1:release-validation-green",
                "verification:1",
            ],
            "clarification": None,
            **changes,
        }
    )


def simulated(**changes: Any) -> SimulationResult:
    return SimulationResult.model_validate(
        {
            "provenance": "HYPOTHETICAL_NO_ACTION",
            "scenario_summary": "A later deadline could add margin.",
            "assumptions": ["The protected deadline changes only in this hypothetical."],
            "threatened_invariants": ["release-validation-green"],
            "candidate_futures": [
                {
                    "title": "Keep validation",
                    "consequence": "More time may be available.",
                    "tradeoffs": ["Later delivery"],
                    "required_verification": ["All objective invariants"],
                }
            ],
            "risk_critique": ["CI success is still required."],
            "likely_objective_outcome": "MAY_IMPROVE",
            "unsupported_assumptions": [],
            "evidence_ids": ["objective-verification:1"],
            "external_effects_executed": False,
            **changes,
        }
    )


def trace(
    name: str = "operator_intent_interpreter", request_id: str = REQUEST
) -> OperatorAgentTrace:
    return OperatorAgentTrace.model_validate(
        dict(
            agent_id=name,
            model=MODEL_ID,
            request_id=request_id,
            latency_ms=1,
            attempts=1,
            input_tokens=1,
            output_tokens=1,
            total_tokens=2,
        )
    )


class FakeAgents:
    def __init__(self, interpretation: OperatorIntent) -> None:
        self.intent = interpretation
        self.inputs: list[object] = []
        self.conversation_inputs: list[ConversationInput] = []
        self.result = simulated()
        self.conversation: ConversationEnvelope | None = None

    async def understand(
        self, payload: ConversationInput, request_id: str
    ) -> tuple[ConversationEnvelope, OperatorAgentTrace]:
        self.conversation_inputs.append(payload)
        if self.conversation is not None:
            return self.conversation, trace("conversation_understanding_agent", request_id)
        capability = {
            "SLACK": "SLACK_POST" if self.intent.intent_type == "ACT" else "SLACK_INSPECT",
            "JIRA": "JIRA_UPDATE" if self.intent.intent_type == "ACT" else "JIRA_INSPECT",
            "CALENDAR": (
                "CALENDAR_UPDATE" if self.intent.intent_type == "ACT" else "CALENDAR_INSPECT"
            ),
        }.get(self.intent.subject, "RECOVERY_EXPLAIN")
        return (
            ConversationEnvelope.model_validate(
                {
                    "mode": "TASK",
                    "user_goal": payload.message,
                    "normalized_request": payload.message,
                    "requested_capability": capability,
                    "requires_operator": True,
                    "tone": "neutral",
                    "confidence": "HIGH",
                }
            ),
            trace("conversation_understanding_agent", request_id),
        )

    async def interpret(
        self, payload: IntentInput, request_id: str
    ) -> tuple[OperatorIntent, OperatorAgentTrace]:
        self.inputs.append(payload)
        return self.intent, trace(request_id=request_id)

    async def simulate(
        self, payload: SimulationInput, request_id: str
    ) -> tuple[SimulationResult, OperatorAgentTrace]:
        self.inputs.append(payload)
        return self.result, trace("simulation_agent", request_id)


def service(agents: FakeAgents) -> OperatorService:
    async def read(_: str) -> OperatorSnapshot:
        return snapshot()

    async def calendar(_: str) -> Any:
        from objective_recovery_agent.external_reality_schemas import ExternalRealityView

        value = json.loads((ROOT / "docs/ui-fixtures/external-reality.json").read_bytes())
        value["resources"][0]["fresh_read_status"] = "READ_BACK"
        value["resources"][0]["latest_readback"]["source_freshness"] = "FRESH_READ"
        return ExternalRealityView.model_validate(value)

    return OperatorService(read, calendar, agents)


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", ["EXPLAIN", "INSPECT", "SIMULATE"])
async def test_grounded_paths_and_immutable_value_only_simulation(kind: str) -> None:
    agents = FakeAgents(intent(kind))
    before = snapshot().model_dump_json()
    result = await service(agents).query(
        OperatorQuery(incident_id=INCIDENT, message="Bounded request"), REQUEST
    )
    assert result.external_effects_executed is False
    assert snapshot().model_dump_json() == before
    assert len(agents.inputs) == (2 if kind == "SIMULATE" else 1)
    assert all(
        item.evidence_id in {e.evidence_id for e in snapshot().evidence} for item in result.evidence
    )
    if kind == "SIMULATE":
        assert result.provenance == "HYPOTHETICAL_NO_ACTION"
        assert result.hypothetical_deadline == "2026-08-28T19:00:00+00:00"
        payload = agents.inputs[-1]
        assert isinstance(payload, SimulationInput)
        assert payload.snapshot.protected_deadline == "2026-08-28T17:00:00+00:00"
        assert set(SimulationInput.model_fields) == {
            "provenance",
            "snapshot",
            "intent",
            "hypothetical_deadline",
        }
        with pytest.raises(ValidationError):
            payload.snapshot.revision = 99
    else:
        assert "Action verified does not imply objective restored" in result.answer
        assert "release-validation-green FAILED" in result.answer
        assert result.simulation is None


@pytest.mark.asyncio
async def test_inspect_calendar_uses_existing_fresh_read_contract() -> None:
    result = await service(FakeAgents(intent("INSPECT", subject="CALENDAR"))).query(
        OperatorQuery(incident_id=INCIDENT, message="Show Calendar"), REQUEST
    )
    assert "Fresh Google Calendar read-back" in result.answer
    assert "2026-08-28T13:00:00" in result.answer


@pytest.mark.asyncio
@pytest.mark.parametrize("disposition", ["UNSUPPORTED", "CLARIFICATION_REQUIRED"])
async def test_mutation_or_ambiguity_never_reaches_simulation(disposition: str) -> None:
    agents = FakeAgents(
        intent(
            disposition=disposition,
            intent_type=None,
            fact_ids=[],
            clarification="Specify an inspection or hypothetical.",
        )
    )
    result = await service(agents).query(
        OperatorQuery(incident_id=INCIDENT, message="Fix everything"), REQUEST
    )
    assert result.disposition == disposition
    assert result.facts == () and result.evidence == () and result.simulation is None
    assert len(agents.inputs) == 1


@pytest.mark.parametrize(
    "changes",
    [
        {"intent_type": "EXECUTE"},
        {"disposition": "UNSUPPORTED"},
        {"extra_permission": True},
        {"intent_type": "SIMULATE"},
        {"clarification": "Ambiguous"},
    ],
)
def test_schema_rejects_unsupported_authority(changes: dict[str, Any]) -> None:
    with pytest.raises(ValidationError):
        intent(**changes)


@pytest.mark.parametrize(
    "changes",
    [
        {"incident_id": "incident-other"},
        {"recovery_attempt": 99},
        {"fact_ids": ["made-up"]},
        {
            "hypothetical_changes": [
                {"kind": "DEADLINE_SHIFT_MINUTES", "target": "other", "value": "120"}
            ]
        },
        {
            "hypothetical_changes": [
                {"kind": "DEADLINE_SHIFT_MINUTES", "target": "release-v2", "value": "9999"}
            ]
        },
        {
            "hypothetical_changes": [
                {"kind": "DEADLINE_SHIFT_MINUTES", "target": "release-v2", "value": "tomorrow"}
            ]
        },
        {"hypothetical_changes": [{"kind": "CI_PASSED", "target": "nonexistent", "value": "true"}]},
        {
            "hypothetical_changes": [
                {
                    "kind": "RESOURCE_AVAILABLE_AT",
                    "target": "person-backend-lead",
                    "value": "tomorrow",
                }
            ]
        },
    ],
)
def test_semantic_grounding_rejects_unknown_scope_or_hypotheticals(changes: dict[str, Any]) -> None:
    with pytest.raises(OperatorReasoningError):
        validate_intent(intent("SIMULATE", **changes), snapshot())


@pytest.mark.asyncio
async def test_invalid_simulation_fails_before_response() -> None:
    agents = FakeAgents(intent("SIMULATE"))
    agents.result = simulated(evidence_ids=["invented-proof"])
    with pytest.raises(OperatorReasoningError):
        await service(agents).query(
            OperatorQuery(incident_id=INCIDENT, message="What if?"), REQUEST
        )
    with pytest.raises(ValidationError):
        simulated(external_effects_executed=True)
    with pytest.raises(ValidationError):
        simulated(provenance="OBSERVED")


def test_simulation_output_schema_is_vertex_compatible() -> None:
    # google-genai's Vertex transformer only accepts string enum values; the
    # false-only safety invariant is enforced by the model validator instead.
    assert SimulationResult.model_json_schema()["properties"]["external_effects_executed"] == {
        "title": "External Effects Executed",
        "type": "boolean",
    }


@pytest.mark.asyncio
@pytest.mark.parametrize("agent_name", ["operator_intent_interpreter", "simulation_agent"])
async def test_real_adk_workflow_boundary_and_safe_metadata(
    monkeypatch: Any, capsys: Any, agent_name: str
) -> None:
    calls: list[Any] = []
    output = intent() if agent_name == "operator_intent_interpreter" else simulated()

    async def run(workflow: Any, payload: Any) -> WorkflowResult:
        node = workflow.edges[0][1]
        assert node.name == agent_name and node.model.model == MODEL_ID
        expected_timeout = 30 if agent_name == "simulation_agent" else 25
        assert node.timeout == expected_timeout and workflow.timeout == expected_timeout
        assert node.tools == [] and not node.sub_agents
        assert node.input_schema is not None and node.output_schema is not None
        calls.append(payload)
        return WorkflowResult(output, 3, 12, 8, 4)

    monkeypatch.setattr(operator_agents, "run_workflow", run)
    agents = AdkOperatorAgents()
    value: OperatorIntent | SimulationResult
    if agent_name == "operator_intent_interpreter":
        value, metadata = await agents.interpret(
            IntentInput(
                request=OperatorQuery(incident_id=INCIDENT, message="Secret request content"),
                snapshot=snapshot(),
            ),
            REQUEST,
        )
    else:
        value, metadata = await agents.simulate(
            SimulationInput(snapshot=snapshot(), intent=intent("SIMULATE")), REQUEST
        )
    assert value == output and len(calls) == 1
    assert metadata.attempts == 1 and metadata.total_tokens == 12
    log = capsys.readouterr().out
    assert agent_name in log and REQUEST in log and MODEL_ID in log
    assert "Secret request content" not in log and "system_prompt" not in log


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "error,expected",
    [
        (ValueError("bad JSON"), 2),
        # A timeout is retried only when a whole further provider attempt still fits in the
        # node budget. These mocks raise immediately, so the budget is untouched and the
        # single permitted retry is taken. The no-budget case is covered separately by
        # test_watchdog_timeout_is_not_retried, and two attempts remains the hard ceiling.
        (TimeoutError(), 2),
        (NodeTimeoutError(node_name="simulation_agent_workflow", timeout=30.0), 2),
        (RuntimeError("network secret"), 1),
    ],
)
async def test_bounded_attempts_and_safe_failure(
    monkeypatch: Any, error: Exception, expected: int
) -> None:
    calls = 0

    async def run(*args: Any, **kwargs: Any) -> Any:
        nonlocal calls
        calls += 1
        raise error

    monkeypatch.setattr(operator_agents, "run_workflow", run)
    with pytest.raises(OperatorReasoningError, match="Operator reasoning unavailable") as caught:
        await AdkOperatorAgents().interpret(
            IntentInput(
                request=OperatorQuery(incident_id=INCIDENT, message="Request"), snapshot=snapshot()
            ),
            REQUEST,
        )
    assert calls == expected
    assert caught.value.agent_name == "operator_intent_interpreter"
    expected_category = (
        "timeout"
        if isinstance(error, TimeoutError | NodeTimeoutError)
        else "validation"
        if isinstance(error, ValueError)
        else "runtime"
    )
    assert caught.value.category == expected_category
    assert caught.value.elapsed_ms is not None


@pytest.mark.asyncio
async def test_watchdog_timeout_is_not_retried(monkeypatch: Any) -> None:
    """A watchdog that has already spent the node budget must not start another attempt.

    This is what keeps the bounded retry from becoming retry-until-green: the decision is
    made from the remaining budget, not from the error type alone.
    """
    calls = 0

    async def run(*args: Any, **kwargs: Any) -> Any:
        nonlocal calls
        calls += 1
        # Consume the whole node budget, as a real watchdog firing would.
        await asyncio.sleep(0)
        raise NodeTimeoutError(node_name="simulation_agent_workflow", timeout=30.0)

    monkeypatch.setattr(operator_agents, "run_workflow", run)
    monkeypatch.setattr(operator_agents, "PROVIDER_REQUEST_TIMEOUT_SECONDS", 10**6)
    with pytest.raises(OperatorReasoningError) as caught:
        await AdkOperatorAgents().simulate(
            SimulationInput(snapshot=snapshot(), intent=intent("SIMULATE")), REQUEST
        )
    assert calls == 1
    assert caught.value.category == "timeout"


def test_provider_request_deadline_sits_below_the_node_watchdog() -> None:
    """Two provider attempts must fit beneath the node watchdog.

    Before this bound existed the provider call had no deadline of its own — the genai
    default is None and neither ADK nor this module set one — so a stalled request ran until
    the ADK node watchdog. That is the P2G stall signature, and it is why raising the
    watchdog from 25s to 30s did not help.
    """
    provider = operator_agents.PROVIDER_REQUEST_TIMEOUT_SECONDS
    node = operator_agents.SIMULATION_AGENT_TIMEOUT_SECONDS
    assert 0 < provider < node
    assert provider * 2 <= node
    # The SDK must still never retry underneath us, so a recorded attempt count stays a
    # real provider request count.
    edges: Any = operator_agents.create_simulation_workflow().edges
    model = edges[0][1].model
    assert model.retry_options is not None and model.retry_options.attempts == 1


@pytest.mark.asyncio
async def test_each_attempt_is_bounded_by_the_provider_deadline(monkeypatch: Any) -> None:
    """A hung provider call is abandoned at the provider deadline, not at the watchdog."""
    monkeypatch.setattr(operator_agents, "PROVIDER_REQUEST_TIMEOUT_SECONDS", 0.05)
    attempts = 0

    async def run(*args: Any, **kwargs: Any) -> Any:
        nonlocal attempts
        attempts += 1
        await asyncio.sleep(30)  # never completes; must be cancelled by our deadline

    monkeypatch.setattr(operator_agents, "run_workflow", run)
    started = time.perf_counter()
    with pytest.raises(OperatorReasoningError) as caught:
        await AdkOperatorAgents().simulate(
            SimulationInput(snapshot=snapshot(), intent=intent("SIMULATE")), REQUEST
        )
    elapsed = time.perf_counter() - started
    # Two bounded attempts, and nowhere near the 30s node watchdog.
    assert attempts == 2
    assert elapsed < 5
    assert caught.value.category == "timeout"


def test_simulation_transitive_project_imports_have_no_effect_module() -> None:
    pending = ["objective_recovery_agent.operator_agents"]
    seen: set[str] = set()
    forbidden = {
        "calendar_gateway",
        "github_gateway",
        "gmail_gateway",
        "calendar_execution",
        "github_execution",
        "ledger",
        "action_ledger",
        "p1d_store",
        "p1d",
        "orchestrator",
        "recovery_outbox",
        "gmail_ingestion",
        "operator_quota",
        "ui_store",
        "operator_api",
    }
    while pending:
        module = pending.pop()
        if module in seen:
            continue
        seen.add(module)
        assert module.split(".")[-1] not in forbidden
        path = ROOT / (module.replace(".", "/") + ".py")
        if not path.exists():
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if (
                isinstance(node, ast.ImportFrom)
                and node.module
                and node.module.startswith("objective_recovery_agent")
            ):
                pending.append(node.module)
    assert "objective_recovery_agent.planning" in seen


def test_snapshot_bounds_and_secret_redaction() -> None:
    value = snapshot()
    assert len(value.model_dump_json()) < 25000
    assert safe_text("Bearer sensitive-token") == "[redacted]"
    assert safe_text("AIza" + "x" * 30) == "[redacted]"
    with pytest.raises(ValidationError):
        OperatorQuery(incident_id=INCIDENT, message="x" * 1201)


def test_frozen_calendar_and_existing_five_agent_semantics_unchanged() -> None:
    assert (
        subprocess.run(
            [
                "git",
                "diff",
                "6b9b6f1",
                "--exit-code",
                "--",
                "objective_recovery_agent/calendar_gateway.py",
                "objective_recovery_agent/calendar_execution.py",
                "objective_recovery_agent/external_reality.py",
                "objective_recovery_agent/external_reality_schemas.py",
                "objective_recovery_agent/gmail_interpretation.py",
                "objective_recovery_agent/planning.py",
                "objective_recovery_agent/agent_runtime.py",
                "src/objective_recovery/web_bff/auth.py",
                "src/objective_recovery/web_bff/demo.py",
                "docs/ui-openapi.json",
                "frontend/src/app/contract",
                "frontend/src/app/data",
                "frontend/src/app/components/CalendarMiniTimeline.tsx",
            ],
            capture_output=True,
        ).returncode
        == 0
    )

    def function(source: str, name: str) -> str:
        tree = ast.parse(source)
        node = next(
            item
            for item in tree.body
            if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)) and item.name == name
        )
        return ast.dump(node, include_attributes=False)

    old = subprocess.check_output(
        ["git", "show", "6b9b6f1:objective_recovery_agent/fast_api_app.py"], text=True
    )
    current = (ROOT / "objective_recovery_agent/fast_api_app.py").read_text()
    for name in (
        "get_external_reality_service",
        "ui_external_reality",
        "get_orchestrator",
        "get_p1c_service",
        "get_p1d_service",
    ):
        assert function(old, name) == function(current, name)


@pytest.mark.asyncio
async def test_runner_actually_calls_gemini_model_interface(monkeypatch: Any) -> None:
    from google.adk.models import Gemini
    from google.adk.models.llm_response import LlmResponse
    from google.genai import types

    calls: list[Any] = []

    async def generate(self: Any, llm_request: Any, stream: bool = False) -> Any:
        calls.append(llm_request)
        yield LlmResponse(
            content=types.Content(
                role="model", parts=[types.Part.from_text(text=intent().model_dump_json())]
            )
        )

    monkeypatch.setattr(Gemini, "generate_content_async", generate)
    result = await AdkOperatorAgents().interpret(
        IntentInput(
            request=OperatorQuery(incident_id=INCIDENT, message="Explain recovery"),
            snapshot=snapshot(),
        ),
        REQUEST,
    )
    assert result[0] == intent() and calls
    assert "Explain recovery" in str(calls[0].contents)
