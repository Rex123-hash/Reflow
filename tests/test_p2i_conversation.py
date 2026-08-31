from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest
from objective_recovery_agent.agent_runtime import AgentId
from objective_recovery_agent.operator_agents import (
    OPERATOR_AGENT_NAMES,
    create_conversation_understanding_workflow,
)
from objective_recovery_agent.operator_human_response import (
    compose_task_response,
    polish_human_text,
)
from objective_recovery_agent.operator_schemas import (
    ConversationContext,
    ConversationEnvelope,
    OperatorActionView,
    OperatorIntent,
    OperatorQuery,
    RequestedOperation,
)
from pydantic import ValidationError

from test_operator_runtime import INCIDENT, REQUEST, FakeAgents, intent, service, snapshot


def envelope(mode: str = "TASK", **changes: Any) -> ConversationEnvelope:
    base: dict[str, Any] = {
        "mode": mode,
        "user_goal": "Understand the request",
        "normalized_request": "Why did Recovery 1 fail?" if mode == "TASK" else None,
        "requested_capability": "RECOVERY_EXPLAIN" if mode == "TASK" else None,
        "entities": [],
        "constraints": [],
        "missing_information": [],
        "requires_operator": mode == "TASK",
        "tone": "neutral",
        "confidence": "HIGH",
        "likely_provider": "REFLOW" if mode == "TASK" else "NONE",
        "referenced_resource": "current-recovery" if mode == "TASK" else None,
        "context_resolution_used": False,
        "context_source": "NONE",
        "ambiguity_flag": mode == "CLARIFY",
        "candidate_interpretations": ["Understand the request"],
        "clarification_required": mode == "CLARIFY",
        "scope_resolution": "AMBIGUOUS" if mode == "CLARIFY" else "EXACT",
        "direct_response": None if mode == "TASK" else "How can I help?",
    }
    base.update(changes)
    return ConversationEnvelope.model_validate(base)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("mode", "summary_text"),
    [("GENERAL", "How can I help?"), ("HELP", "investigate recovery history")],
)
async def test_general_and_help_stop_before_agent6(mode: str, summary_text: str) -> None:
    agents = FakeAgents(intent())
    agents.conversation = envelope(
        mode,
        requested_capability="CAPABILITY_HELP" if mode == "HELP" else None,
        direct_response="I can help." if mode == "HELP" else "How can I help?",
    )
    result = await service(agents).query(
        OperatorQuery(incident_id=INCIDENT, message="what can you do"), REQUEST
    )
    assert result.provenance == "CONVERSATION_ONLY"
    assert result.intent is None
    assert summary_text in result.human_response.human_summary
    assert result.human_response.truth_boundary == "No action was requested or taken."
    assert [item.agent_id for item in result.agents] == ["conversation_understanding_agent"]
    assert agents.inputs == []


@pytest.mark.asyncio
async def test_true_clarification_is_human_readable_and_non_operational() -> None:
    agents = FakeAgents(intent())
    agents.conversation = envelope(
        "CLARIFY",
        missing_information=["Which recovery should I focus on?"],
        direct_response="Which recovery should I focus on?",
    )
    result = await service(agents).query(
        OperatorQuery(incident_id=INCIDENT, message="why did it fail"), REQUEST
    )
    assert result.disposition == "CLARIFICATION_REQUIRED"
    assert result.human_response.situation_type == "NEEDS_CLARIFICATION"
    assert "identifier" not in result.human_response.human_summary.casefold()
    assert agents.inputs == []


@pytest.mark.asyncio
async def test_unsupported_calendar_creation_is_not_recast_as_update() -> None:
    unsupported = OperatorIntent(
        disposition="UNSUPPORTED",
        subject="CALENDAR",
        incident_id=INCIDENT,
        question="Create a new reminder at 6 PM on August 30",
        hypothetical_changes=(),
        constraints=(),
        fact_ids=(),
        clarification="Calendar event creation is unsupported.",
    )
    agents = FakeAgents(unsupported)
    agents.conversation = envelope(
        requested_capability="CALENDAR_CREATE",
        user_goal="Create a new Calendar reminder for August 30 at 6 PM",
        normalized_request="Create a new Calendar reminder for August 30 at 6 PM",
    )
    result = await service(agents).query(
        OperatorQuery(incident_id=INCIDENT, message="set a reminder for 6 pm 30 august"),
        REQUEST,
    )
    assert result.human_response.situation_type == "UNSUPPORTED"
    assert "can't create new Calendar events" in result.human_response.human_summary
    assert result.intent is not None and result.intent.requested_operations == ()
    assert result.external_effects_executed is False


@pytest.mark.asyncio
async def test_bounded_previous_context_reaches_agent8_only_as_data() -> None:
    agents = FakeAgents(intent())
    previous = ConversationContext(
        mode="TASK",
        user_goal="Explain why Recovery 1 failed",
        normalized_request="Why did Recovery 1 fail?",
        human_summary="Recovery 1 failed because CI did not pass.",
    )
    await service(agents).query(
        OperatorQuery(
            incident_id=INCIDENT,
            message="and what happened after that?",
            conversation_context=previous,
        ),
        REQUEST,
    )
    assert agents.conversation_inputs[0].previous == previous
    assert not hasattr(agents.conversation_inputs[0], "role")
    assert not hasattr(agents.conversation_inputs[0], "credential")


def action(lifecycle: str, **changes: Any) -> OperatorActionView:
    now = datetime.now(UTC).isoformat()
    base: dict[str, Any] = {
        "operator_action_id": "a" * 64,
        "request_id": REQUEST,
        "authenticated_subject_hash": "b" * 64,
        "authority": "SLACK",
        "resource_type": "CHANNEL",
        "resource_identifier": "configured-release-channel",
        "operations": [RequestedOperation(operation="SLACK_POST_MESSAGE", value="Blocked.")],
        "authorization_result": "AUTO_EXECUTABLE",
        "lifecycle": lifecycle,
        "created_at": now,
        "updated_at": now,
    }
    base.update(changes)
    return OperatorActionView.model_validate(base)


@pytest.mark.parametrize(
    ("value", "situation", "boundary"),
    [
        (
            action(
                "VERIFIED",
                expected_state={"text": "Blocked."},
                execution_acknowledgement={"message_ts": "1787988861.978999"},
                observed_state={"text": "Blocked."},
                verification_result="PASSED",
            ),
            "SUCCESS",
            "does not by itself prove the objective recovered",
        ),
        (action("DENIED", authorization_result="DENIED"), "DENIED", "No action was taken"),
        (
            action(
                "VERIFICATION_FAILED",
                execution_acknowledgement={"message_ts": "1787988861.978999"},
                external_effects_possible=True,
                verification_result="FAILED",
            ),
            "UNCERTAIN",
            "not verified",
        ),
        (action("FAILED"), "FAILED", "No verified external change"),
    ],
)
def test_action_truth_language_preserves_verified_failed_uncertain_states(
    value: OperatorActionView, situation: str, boundary: str
) -> None:
    result = compose_task_response(
        envelope=envelope(requested_capability="SLACK_POST"),
        intent=intent(
            "ACT",
            subject="SLACK",
            fact_ids=[],
            recovery_attempt=None,
            target={
                "authority": "SLACK",
                "resource_type": "CHANNEL",
                "resource_identifier": "configured-release-channel",
            },
            requested_operations=value.operations,
        ),
        snapshot=snapshot(),
        answer="Technical answer",
        facts=(),
        simulation=None,
        inspection=None,
        action=value,
        response_disposition="SUPPORTED",
    )
    assert result.situation_type == situation
    assert boundary in result.truth_boundary


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("proof proof remains available.", "proof remains available."),
        ("I can I can inspect it.", "I can inspect it."),
        ("The event the event changed.", "The event changed."),
        ("It failed. It failed.", "It failed."),
    ],
)
def test_human_prose_guard_removes_accidental_echo(value: str, expected: str) -> None:
    assert polish_human_text(value) == expected


def test_conversation_contract_rejects_authority_shaped_non_task_outputs() -> None:
    with pytest.raises(ValidationError):
        envelope("HELP", requires_operator=True, normalized_request="Post to Slack")
    with pytest.raises(ValidationError):
        envelope("TASK", direct_response="I already did it")


@pytest.mark.parametrize(
    "changes",
    [
        {"context_resolution_used": True, "context_source": "NONE"},
        {"ambiguity_flag": True},
        {"clarification_required": True},
        {"scope_resolution": "AMBIGUOUS"},
        {"candidate_interpretations": []},
    ],
)
def test_conversation_interpretation_metadata_fails_closed(changes: dict[str, Any]) -> None:
    with pytest.raises(ValidationError):
        envelope("TASK", **changes)


def test_nearest_authorized_slack_inspection_explains_the_boundary_and_still_helps() -> None:
    conversation = envelope(
        normalized_request="Inspect the configured Reflow release channel instead.",
        requested_capability="SLACK_INSPECT",
        constraints=("Personal unread state is unavailable.",),
        likely_provider="SLACK",
        referenced_resource="configured-release-channel",
        context_resolution_used=True,
        context_source="CAPABILITY",
        candidate_interpretations=("Inspect the configured Reflow release channel.",),
        scope_resolution="NEAREST_AUTHORIZED",
    )
    interpretation = OperatorIntent.model_validate(
        {
            "disposition": "SUPPORTED",
            "intent_type": "INSPECT",
            "subject": "SLACK",
            "incident_id": INCIDENT,
            "recovery_attempt": None,
            "question": "Inspect the configured Reflow release channel.",
            "hypothetical_changes": [],
            "constraints": ["Personal unread state is unavailable."],
            "fact_ids": [],
            "target": {
                "authority": "SLACK",
                "resource_type": "CHANNEL",
                "resource_identifier": "configured-release-channel",
            },
            "requested_operations": [],
            "clarification": None,
        }
    )
    result = compose_task_response(
        envelope=conversation,
        intent=interpretation,
        snapshot=snapshot(),
        answer="Latest Reflow-bot message: Release validation passed.",
        facts=(),
        simulation=None,
        inspection=None,
        action=None,
        response_disposition="SUPPORTED",
    )
    assert "can't inspect personal Slack unread or private messages" in result.human_summary
    assert "configured Reflow release channel" in result.human_summary
    assert "Release validation passed" in result.human_summary
    assert result.truth_boundary == "Nothing was changed."


def test_agent8_is_one_real_zero_tool_adk_node_and_total_agent_count_is_eight() -> None:
    workflow = create_conversation_understanding_workflow()
    edges: Any = workflow.edges
    node: Any = edges[0][1]
    assert node.name == "conversation_understanding_agent"
    assert node.tools == []
    assert node.output_schema is ConversationEnvelope
    assert len([item.value for item in AgentId] + list(OPERATOR_AGENT_NAMES)) == 8
    assert OPERATOR_AGENT_NAMES.count("conversation_understanding_agent") == 1
