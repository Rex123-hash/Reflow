"""Deterministic translation of one Operator result into what voice may say.

The Operator pipeline is unchanged and remains the only authority. This module reads its
response and produces a spoken result whose opening sentence is server-owned, so a denied,
unsupported, approval-required, or unverified outcome cannot be spoken as a success.
"""

from __future__ import annotations

from objective_recovery_agent.operator_context import safe_text
from objective_recovery_agent.operator_schemas import ConversationContext, OperatorResponse
from objective_recovery_agent.voice_schemas import (
    ACTION_IS_NOT_OBJECTIVE,
    VOICE_RESULT_LEAD,
    VoiceHandoffOutcome,
    VoiceOperatorHandoffResult,
)

_LIFECYCLE_OUTCOME: dict[str, VoiceHandoffOutcome] = {
    "VERIFIED": "ACTION_VERIFIED",
    "DENIED": "DENIED",
    "APPROVAL_REQUIRED": "APPROVAL_REQUIRED",
}

_MAX_SUMMARY = 1200


def _outcome(response: OperatorResponse) -> VoiceHandoffOutcome:
    if response.disposition == "CLARIFICATION_REQUIRED":
        return "CLARIFICATION_REQUIRED"
    if response.disposition == "UNSUPPORTED":
        return "UNSUPPORTED"
    action = response.action
    if action is None:
        return "CONVERSATIONAL"
    if action.authorization_result == "DENIED":
        return "DENIED"
    # Anything short of an independently read-back, passed verification is unverified.
    return _LIFECYCLE_OUTCOME.get(action.lifecycle, "ACTION_UNVERIFIED")


def _spoken(outcome: VoiceHandoffOutcome, response: OperatorResponse, recovered: bool) -> str:
    parts = [
        VOICE_RESULT_LEAD[outcome],
        safe_text(response.human_response.human_summary, _MAX_SUMMARY),
    ]
    if outcome == "ACTION_VERIFIED" and not recovered:
        parts.append(ACTION_IS_NOT_OBJECTIVE)
    return " ".join(part for part in parts if part)


def handoff_result(
    *,
    response: OperatorResponse,
    voice_session_id: str,
    spoken_request: str,
) -> VoiceOperatorHandoffResult:
    outcome = _outcome(response)
    action = response.action
    verified = outcome == "ACTION_VERIFIED"
    # Objective recovery is only ever the Operator's own human-first judgement, never
    # inferred from an action having passed verification.
    recovered = response.human_response.situation_type == "OBJECTIVE_RESTORED" and outcome in {
        "CONVERSATIONAL",
        "ACTION_VERIFIED",
    }
    conversation_context = ConversationContext(
        mode=response.conversation.mode,
        user_goal=safe_text(response.conversation.user_goal, 400),
        normalized_request=(
            safe_text(response.conversation.normalized_request or spoken_request, 800)
            if response.conversation.mode in {"TASK", "CLARIFY"}
            else None
        ),
        human_summary=safe_text(response.human_response.human_summary, 400),
        likely_provider=response.conversation.likely_provider,
        referenced_resource=response.conversation.referenced_resource,
        context_source=response.conversation.context_source,
    )
    return VoiceOperatorHandoffResult(
        voice_session_id=voice_session_id,
        request_id=response.request_id,
        incident_id=response.incident_id,
        outcome=outcome,
        original_request=spoken_request,
        spoken_result=_spoken(outcome, response, recovered),
        truth_boundary=safe_text(response.human_response.truth_boundary),
        action_verified=verified,
        external_effects_executed=response.external_effects_executed
        and outcome in {"CONVERSATIONAL", "ACTION_VERIFIED", "ACTION_UNVERIFIED"},
        objective_recovered=recovered,
        operator_disposition=response.disposition,
        operator_action_lifecycle=action.lifecycle if action else None,
        approval_required_action_id=(
            action.operator_action_id
            if action is not None and outcome == "APPROVAL_REQUIRED"
            else None
        ),
        conversation_context=conversation_context,
        failure=(
            "OPERATOR_HANDOFF_DENIED"
            if outcome == "DENIED"
            else "OPERATOR_HANDOFF_UNSUPPORTED"
            if outcome == "UNSUPPORTED"
            else None
        ),
    )


def failed_handoff_result(
    *,
    voice_session_id: str,
    request_id: str,
    incident_id: str,
    spoken_request: str,
    detail: str,
) -> VoiceOperatorHandoffResult:
    """The Operator pipeline did not produce a result; voice says exactly that."""
    return VoiceOperatorHandoffResult(
        voice_session_id=voice_session_id,
        request_id=request_id,
        incident_id=incident_id,
        outcome="HANDOFF_FAILED",
        original_request=spoken_request,
        spoken_result=f"{VOICE_RESULT_LEAD['HANDOFF_FAILED']} {safe_text(detail, 400)}",
        truth_boundary=(
            "No Operator result was produced, so nothing can be reported as attempted, "
            "changed, or verified."
        ),
        action_verified=False,
        external_effects_executed=False,
        objective_recovered=False,
        failure="OPERATOR_HANDOFF_FAILED",
    )
