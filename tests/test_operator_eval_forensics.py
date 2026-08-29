from __future__ import annotations

import asyncio
import json
from typing import Any, cast

import pytest
from google.adk.models.llm_response import LlmResponse
from google.genai import types
from google.genai.models import AsyncModels
from objective_recovery_agent import operator_agents
from objective_recovery_agent.operator_agents import OperatorReasoningError
from objective_recovery_agent.operator_schemas import ConversationEnvelope, OperatorQuery
from objective_recovery_agent.planning import WorkflowResult
from scripts.operator_eval_forensics import Capture, redact, structured_output

from test_operator_runtime import INCIDENT, REQUEST, intent, service, simulated


def test_forensic_capture_excludes_thoughts_and_unexpected_fields() -> None:
    response = LlmResponse(
        content=types.Content(
            parts=[
                types.Part(text="PRIVATE THINKING", thought=True),
                types.Part(text=json.dumps({"scenario_summary": "safe", "unknown": "SECRET"})),
            ]
        )
    )
    result = structured_output(response, {"scenario_summary"})
    assert result["value"] == {"scenario_summary": "safe"}
    assert result["unexpected_field_count"] == 1
    assert "PRIVATE THINKING" not in str(result) and "SECRET" not in str(result)


@pytest.mark.parametrize("text", ["xoxb-test-private-token", "Bearer private-value"])
def test_forensic_capture_redacts_credentials(text: str) -> None:
    assert text not in str(redact({"nested": [text]}))


@pytest.mark.asyncio
async def test_provider_cancellation_is_recorded_and_not_swallowed(monkeypatch: Any) -> None:
    async def fail(instance: Any, **kwargs: Any) -> Any:
        raise asyncio.CancelledError("Bearer private-provider-detail")

    monkeypatch.setattr(AsyncModels, "generate_content", fail)
    with Capture() as capture, pytest.raises(asyncio.CancelledError):
        await AsyncModels.generate_content(
            cast(Any, None), model="gemini-3.7-flash", contents="bounded fixture"
        )
    assert [event["stage"] for event in capture.events] == [
        "provider_request_started",
        "provider_request_failed",
    ]
    assert capture.events[-1]["exception_type"] == "CancelledError"
    assert "private-provider-detail" not in str(capture.events)
    assert vars(AsyncModels)["generate_content"] is fail


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "invalid_refs",
    [
        [],
        ["invented-proof"],
        ["action:calendar-9899dba7a849a328a49d", "action:validate-release-v2"],
    ],
)
async def test_forensic_observers_do_not_change_simulation_validation(
    monkeypatch: Any, invalid_refs: list[str]
) -> None:
    interpretation = intent(
        "SIMULATE",
        hypothetical_changes=[
            {"kind": "CI_PASSED", "target": "action:validate-release-v2", "value": "true"}
        ],
    )
    simulation = simulated(evidence_ids=invalid_refs or ["objective-verification:1"])

    async def run(flow: Any, payload: Any) -> WorkflowResult:
        node = flow.edges[0][1]
        output = (
            ConversationEnvelope(
                mode="TASK",
                user_goal="Simulate a CI pass",
                normalized_request="What if Candidate A had passed CI?",
                requested_capability="RECOVERY_SIMULATE",
                requires_operator=True,
                tone="neutral",
                confidence="HIGH",
            )
            if node.name == "conversation_understanding_agent"
            else simulation
            if node.name == "simulation_agent"
            else interpretation
        )
        await AsyncModels.generate_content(
            cast(Any, None), model="gemini-3.7-flash", contents=output.model_dump_json()
        )
        return WorkflowResult(output, 1, 2, 1, 1)

    async def generate(instance: Any, **kwargs: Any) -> Any:
        return types.GenerateContentResponse(
            candidates=[
                types.Candidate(
                    content=types.Content(parts=[types.Part(text=kwargs["contents"])]),
                    finish_reason=types.FinishReason.STOP,
                )
            ]
        )

    monkeypatch.setattr(AsyncModels, "generate_content", generate)
    monkeypatch.setattr(operator_agents, "run_workflow", run)
    original = operator_agents.AdkOperatorAgents._invoke
    with Capture() as capture:
        runtime = service(cast(Any, operator_agents.AdkOperatorAgents()))
        query = OperatorQuery(incident_id=INCIDENT, message="What if Candidate A had passed CI?")
        if invalid_refs:
            with pytest.raises(
                OperatorReasoningError, match="Simulation cited unavailable evidence"
            ):
                await runtime.query(query, REQUEST)
        else:
            response = await runtime.query(query, REQUEST)
            assert response.provenance == "HYPOTHETICAL_NO_ACTION"
            assert response.external_effects_executed is False
            assert response.simulation == simulation
    assert operator_agents.AdkOperatorAgents._invoke is original
    checks = [event for event in capture.events if event["stage"] == "simulation_reference_check"]
    assert checks[0]["unknown_ids"] == sorted(invalid_refs)
    assert len([e for e in capture.events if e["stage"] == "provider_request_started"]) == 3
    assert any(e["stage"] == "service_rejected" for e in capture.events) is bool(invalid_refs)
