"""Human-first Operator prose derived from validated state, never from technical proof fields."""

from __future__ import annotations

import re
from datetime import datetime
from difflib import SequenceMatcher

from objective_recovery_agent.operator_schemas import (
    ConversationEnvelope,
    HumanResponse,
    OperatorActionView,
    OperatorCapability,
    OperatorFact,
    OperatorInspection,
    OperatorIntent,
    OperatorSnapshot,
    SimulationResult,
)

_ADJACENT_WORD = re.compile(r"\b(?P<word>[A-Za-z][\w'-]*)\s+(?P=word)\b", re.IGNORECASE)
_ADJACENT_PHRASE = re.compile(
    r"\b(?P<phrase>(?:[A-Za-z][\w'-]*\s+){1,3}[A-Za-z][\w'-]*)\s+"
    r"(?P=phrase)\b",
    re.IGNORECASE,
)


def polish_human_text(value: str) -> str:
    """Remove accidental echo from prose without touching receipts, IDs, or evidence."""

    text = re.sub(r"[ \t]+", " ", value).strip()
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)
    for _ in range(3):
        updated = _ADJACENT_WORD.sub(r"\g<word>", text)
        updated = _ADJACENT_PHRASE.sub(r"\g<phrase>", updated)
        if updated == text:
            break
        text = updated
    sentences = re.split(r"(?<=[.!?])\s+", text)
    kept: list[str] = []
    for sentence in sentences:
        normalized = re.sub(r"[^a-z0-9]+", " ", sentence.casefold()).strip()
        previous = re.sub(r"[^a-z0-9]+", " ", kept[-1].casefold()).strip() if kept else ""
        if (
            normalized
            and previous
            and (
                normalized == previous
                or (
                    len(normalized) >= 20
                    and SequenceMatcher(None, previous, normalized).ratio() >= 0.92
                )
            )
        ):
            continue
        kept.append(sentence)
    return " ".join(kept).strip()


def _help_summary(capabilities: tuple[OperatorCapability, ...]) -> str:
    operations = {operation for item in capabilities for operation in item.operations}
    examples: list[str] = []
    if "SLACK_INSPECT_CHANNEL" in operations:
        examples.append("inspect the configured release channel")
    if "CREATE_CALENDAR_EVENT" in operations:
        examples.append("create an event on the configured Calendar")
    elif any(item.startswith("CALENDAR_") for item in operations):
        examples.append("update the configured Calendar event")
    if any(item.startswith("JIRA_") for item in operations):
        examples.append("inspect or update configured Jira work")
    suffix = f" For example, I can {', or '.join(examples[:2])}." if examples else ""
    return polish_human_text(
        "I can investigate recovery history, explain why decisions were made, and simulate "
        "explicit alternatives. I can also request bounded changes in configured connected "
        f"systems when policy allows.{suffix}"
    )


def compose_direct_response(
    envelope: ConversationEnvelope,
    capabilities: tuple[OperatorCapability, ...],
) -> HumanResponse:
    if envelope.mode == "HELP":
        return HumanResponse(
            human_summary=_help_summary(capabilities),
            situation_type="HELP",
            current_state="Ready to help within configured capabilities.",
            next_step="Ask about a recovery or one configured connected resource.",
            truth_boundary="No action was requested or taken.",
            suggestions=(
                "Why did Recovery 1 fail?",
                "Show me the configured release channel",
                "What Calendar actions can you perform?",
            ),
        )
    if envelope.mode == "CLARIFY":
        return HumanResponse(
            human_summary=polish_human_text(envelope.direct_response or "What should I focus on?"),
            situation_type="NEEDS_CLARIFICATION",
            current_state="I understand part of the goal, but one useful detail is missing.",
            next_step=polish_human_text(envelope.missing_information[0]),
            truth_boundary="No action was requested or taken.",
        )
    return HumanResponse(
        human_summary=polish_human_text(envelope.direct_response or "How can I help?"),
        situation_type="GENERAL",
        current_state="No operational request detected.",
        next_step="Ask about the recovery or a configured connected resource.",
        truth_boundary="No action was requested or taken.",
    )


def _unsupported(envelope: ConversationEnvelope) -> HumanResponse:
    if envelope.requested_capability == "CALENDAR_CREATE":
        return HumanResponse(
            human_summary=(
                "Got it — you want to create a new Calendar reminder or event. "
                "Reflow can't create new Calendar events yet. It can update the time, title, "
                "or description of the configured Operator event."
            ),
            situation_type="UNSUPPORTED",
            current_state="New Calendar event creation is not available.",
            next_step="If you mean the Operator demo event, I can move that instead.",
            truth_boundary="No action was taken.",
            suggestions=(
                "Move the Operator event to 6 PM",
                "Show the configured Calendar event",
                "What Calendar actions can you perform?",
            ),
        )
    if envelope.requested_capability == "SLACK_DM":
        return HumanResponse(
            human_summary=(
                "Got it — you want to send a Slack direct message. Reflow can't send DMs; "
                "it is limited to the configured release channel."
            ),
            situation_type="UNSUPPORTED",
            current_state="Slack direct messages are outside the configured capability.",
            next_step="I can inspect the configured release channel instead.",
            truth_boundary="No action was taken.",
            suggestions=("Show me the configured release channel", "What can you do in Slack?"),
        )
    if envelope.requested_capability == "SLACK_ARBITRARY_TARGET":
        summary = (
            "I understand the Slack request, but Reflow can't use an arbitrary channel or member "
            "target. It is limited to the server-configured release channel."
        )
    else:
        summary = "I understand the request, but Reflow can't perform that kind of action yet."
    return HumanResponse(
        human_summary=summary,
        situation_type="UNSUPPORTED",
        current_state="The requested capability is not available.",
        next_step="Ask what bounded actions are currently supported.",
        truth_boundary="No action was taken.",
        suggestions=("What can you do?",),
    )


def _clarification(intent: OperatorIntent) -> HumanResponse:
    clarification = polish_human_text(intent.clarification or "Which configured item do you mean?")
    clarification = re.sub(
        r"(?i)^please clarify (?:the )?request[.:]?\s*", "I understand the goal. ", clarification
    )
    return HumanResponse(
        human_summary=clarification,
        situation_type="NEEDS_CLARIFICATION",
        current_state="One meaningful detail is still needed.",
        next_step="Reply with that detail and I can reassess the request.",
        truth_boundary="No action was taken.",
    )


def _action_response(action: OperatorActionView) -> HumanResponse:
    if action.lifecycle == "VERIFIED":
        create = next(
            (
                item.calendar_event
                for item in action.operations
                if item.operation == "CREATE_CALENDAR_EVENT"
            ),
            None,
        )
        if create is not None:
            start = datetime.fromisoformat(create.start.replace("Z", "+00:00"))
            end = datetime.fromisoformat(create.end.replace("Z", "+00:00"))
            date = start.strftime("%A, %d %B %Y").replace(" 0", " ")
            start_time = start.strftime("%I:%M %p").lstrip("0")
            end_time = end.strftime("%I:%M %p").lstrip("0")
            if create.reminders.use_default:
                reminder = "using the calendar's default reminders"
            elif not create.reminders.overrides:
                reminder = "with reminders disabled"
            else:
                values = ", ".join(
                    f"a {item.minutes}-minute {item.method} reminder"
                    for item in create.reminders.overrides
                )
                reminder = f"with {values}"
            return HumanResponse(
                human_summary=(
                    f"Created {create.summary} for {date}, {start_time} to {end_time} "
                    f"{create.timezone}, {reminder}."
                ),
                situation_type="SUCCESS",
                current_state="The new Calendar event was independently read back and verified.",
                next_step="You can open the technical details to inspect the event receipt.",
                truth_boundary=(
                    "The Calendar action is verified; this does not by itself prove the "
                    "objective recovered."
                ),
                suggestions=("Show verification details",),
            )
        return HumanResponse(
            human_summary="Done — the action was independently read back and verified.",
            situation_type="SUCCESS",
            current_state="The requested action is verified.",
            next_step="You can open the technical details to inspect the receipt.",
            truth_boundary=(
                "The action is verified; this does not by itself prove the objective recovered."
            ),
            suggestions=("Show verification details",),
        )
    if action.lifecycle == "DENIED":
        return HumanResponse(
            human_summary=(
                "I understand what you want, but deterministic policy does not allow this action."
            ),
            situation_type="DENIED",
            current_state="The request was denied before execution.",
            next_step="Ask what bounded action is allowed for this configured resource.",
            truth_boundary="No action was taken.",
        )
    if action.lifecycle == "VERIFICATION_FAILED":
        return HumanResponse(
            human_summary=(
                "I sent the change, but the independent read-back did not match, so I am leaving "
                "it unconfirmed."
            ),
            situation_type="UNCERTAIN",
            current_state="The write was acknowledged but verification failed.",
            next_step="Review the receipt before deciding what to do next.",
            truth_boundary="A change may have occurred; it is not verified.",
        )
    if action.lifecycle == "FAILED":
        return HumanResponse(
            human_summary="The change did not complete cleanly, so I am not treating it as done.",
            situation_type="FAILED",
            current_state="The action failed without a verified final state.",
            next_step="Review the receipt; replaying the same request will not repeat writes.",
            truth_boundary=(
                "Some operations may have taken effect. No verified outcome is claimed."
                if action.external_effects_possible
                else "No verified external change is claimed."
            ),
        )
    return HumanResponse(
        human_summary="I understood the change, but it has not reached a verified result yet.",
        situation_type="UNCERTAIN",
        current_state=f"Current action state: {action.lifecycle.replace('_', ' ').lower()}.",
        next_step="Review the action details before proceeding.",
        truth_boundary="No verified outcome is claimed.",
    )


def _explanation(
    intent: OperatorIntent,
    snapshot: OperatorSnapshot,
    facts: tuple[OperatorFact, ...],
    answer: str,
) -> HumanResponse:
    selected = " ".join(item.text for item in facts).casefold()
    restored = any(
        item.fact_id == "objective" and "restored" in item.text.casefold()
        for item in snapshot.facts
    )
    first_failure = intent.recovery_attempt == 1 and (
        "failed" in selected or "false" in selected or "failure" in selected
    )
    if first_failure:
        summary = "Recovery 1 failed because the replacement did not pass CI."
        if restored:
            summary += (
                " Reflow reopened the recovery, tried a revised plan, and the objective is healthy "
                "now."
            )
        return HumanResponse(
            human_summary=summary,
            situation_type="OBJECTIVE_RESTORED" if restored else "EXPLANATION",
            current_state=(
                "The objective is restored after a second recovery."
                if restored
                else "The first recovery did not restore the objective."
            ),
            why="Independent release validation failed even though coordination work succeeded.",
            next_step="Open the technical details to inspect the evidence and recovery sequence.",
            truth_boundary="This explains recorded recovery state; nothing was changed.",
            suggestions=("Show the evidence", "What happened next?", "Simulate another outcome"),
        )
    return HumanResponse(
        human_summary=polish_human_text(answer),
        situation_type="OBJECTIVE_RESTORED" if restored else "EXPLANATION",
        current_state=(
            "The objective is currently restored."
            if restored
            else "This answer reflects the recorded recovery state."
        ),
        next_step="Open the technical details for exact evidence and provenance.",
        truth_boundary="This is an explanation of recorded state; nothing was changed.",
        suggestions=("Show the evidence", "What happened next?", "Simulate another outcome"),
    )


def compose_task_response(
    *,
    envelope: ConversationEnvelope,
    intent: OperatorIntent,
    snapshot: OperatorSnapshot,
    answer: str,
    facts: tuple[OperatorFact, ...],
    simulation: SimulationResult | None,
    inspection: OperatorInspection | None,
    action: OperatorActionView | None,
    response_disposition: str,
) -> HumanResponse:
    if response_disposition == "CLARIFICATION_REQUIRED":
        return _clarification(intent)
    if intent.disposition == "UNSUPPORTED":
        return _unsupported(envelope)
    if action is not None:
        return _action_response(action)
    if simulation is not None:
        return HumanResponse(
            human_summary=polish_human_text(
                f"This is hypothetical — nothing was changed. {simulation.scenario_summary}"
            ),
            situation_type="SIMULATION",
            current_state="The scenario is a simulation, not an observed outcome.",
            next_step="Review what would still need independent verification.",
            truth_boundary="No external action occurred.",
            suggestions=("Show the evidence", "Simulate another outcome"),
        )
    if intent.intent_type == "EXPLAIN":
        return _explanation(intent, snapshot, facts, answer)
    if inspection is not None or intent.intent_type == "INSPECT":
        boundary = (
            "I can't inspect personal Slack unread or private messages, so I checked the "
            "configured Reflow release channel instead. "
            if envelope.likely_provider == "SLACK"
            and envelope.scope_resolution == "NEAREST_AUTHORIZED"
            else ""
        )
        return HumanResponse(
            human_summary=polish_human_text(f"{boundary}Here's what I found. {answer}"),
            situation_type="INSPECTION",
            current_state="The configured resource was inspected.",
            next_step="Open the technical details for exact provenance.",
            truth_boundary="Nothing was changed.",
            suggestions=("Explain the latest update", "Show verification details"),
        )
    return HumanResponse(
        human_summary=polish_human_text(answer),
        situation_type="EXPLANATION",
        current_state="This reflects the current authoritative record.",
        truth_boundary="Nothing was changed.",
    )


__all__ = ["compose_direct_response", "compose_task_response", "polish_human_text"]
