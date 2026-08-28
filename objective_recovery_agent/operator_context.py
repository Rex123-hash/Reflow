"""Minimize existing presentation truth into immutable, bounded model context."""

import hashlib
import json
import re

from objective_recovery_agent.operator_schemas import (
    OperatorEvidence,
    OperatorFact,
    OperatorSnapshot,
)
from objective_recovery_agent.slack_operator_policy import SLACK_CREDENTIAL
from objective_recovery_agent.ui_schemas import ExecutionEventsView, RecoveryCaseView


def safe_text(value: str, limit: int = 800) -> str:
    value = re.sub(r"[\x00-\x08\x0b-\x1f]", "", value)
    value = re.sub(r"(?i)bearer\s+\S+|AIza[\w-]{20,}|sk-[\w-]{20,}", "[redacted]", value)
    value = SLACK_CREDENTIAL.sub("[redacted]", value)
    value = re.sub(r"-----BEGIN[\s\S]*?-----END[^-]*-----", "[redacted]", value)
    return value.strip()[:limit] or "Unavailable"


def build_snapshot(
    incident_id: str, case: RecoveryCaseView, events: ExecutionEventsView
) -> OperatorSnapshot:
    if case.revision != events.revision:
        raise ValueError("Context changed while reading; retry with one revision")
    facts: list[OperatorFact] = []
    known = {item.evidence_id for item in case.evidence}

    def add(key: str, text: str, refs: tuple[str, ...] = ()) -> None:
        facts.append(
            OperatorFact(
                fact_id=key,
                text=safe_text(text),
                evidence_ids=tuple(ref for ref in refs if ref in known),
            )
        )

    add(
        "objective",
        f"{case.objective.title}: observed objective state {case.objective.health.value}. "
        f"Protected deadline {case.objective.protected_deadline}. "
        "This is recorded state, not a new execution or verification.",
    )
    for attempt in case.attempts:
        add(
            f"recovery:{attempt.attempt_number}",
            f"Recovery {attempt.attempt_number}: {attempt.status.value}. "
            f"{attempt.branch_reason or ''}",
        )
    for action in case.actions:
        add(
            f"action:{action.action_id}",
            f"Recovery {action.recovery_attempt}, {action.system_label}: "
            f"{action.desired_state_summary} Receipt {action.receipt_status.value}; "
            f"write acknowledged {action.write_acknowledged}; independent read-back "
            f"{action.read_back_completed} at {action.read_back_at}; action comparison "
            f"{action.verification_state.value}. "
            "Action verified does not imply objective restored.",
            (action.evidence_id,) if action.evidence_id else (),
        )
    for verification in case.verifications:
        refs = tuple(
            dict.fromkeys(item.evidence_id for item in verification.invariants if item.evidence_id)
        )
        add(
            f"verification:{verification.recovery_attempt}",
            f"Recovery {verification.recovery_attempt} objective verification "
            f"{verification.status.value} at {verification.observed_at}.",
            refs,
        )
        for item in verification.invariants:
            add(
                f"invariant:{verification.recovery_attempt}:{item.invariant_id}",
                f"Recovery {verification.recovery_attempt}: {item.invariant_id} "
                f"{item.status.value}; expected {item.expected}, observed {item.observed}. "
                f"{item.reason or ''}",
                (item.evidence_id,) if item.evidence_id else (),
            )
    for evidence in case.evidence:
        add(
            f"evidence:{evidence.evidence_id}",
            f"{evidence.title}: {evidence.summary} Recorded {evidence.observed_at}; "
            f"status {evidence.semantic_status.value}.",
            (evidence.evidence_id,),
        )
    for event in events.events:
        add(
            f"event:{event.event_id}",
            f"{event.timestamp} — Recovery {event.recovery_attempt}: {event.human_message}",
        )
    for node in case.world.nodes:
        add(f"resource:{node.node_id}", f"Known context resource {node.node_id}: {node.label}.")
    material = {
        "incident_id": incident_id,
        "revision": case.revision,
        "objective_id": case.objective.objective_id,
        "protected_deadline": case.objective.protected_deadline,
        "recovery_attempts": tuple(attempt.attempt_number for attempt in case.attempts),
        "facts": tuple(facts),
        "evidence": tuple(
            OperatorEvidence(
                evidence_id=item.evidence_id,
                title=safe_text(item.title),
                observed_at=item.observed_at,
            )
            for item in case.evidence
        ),
    }
    serialized = json.dumps(material, sort_keys=True, default=lambda item: item.model_dump())
    return OperatorSnapshot.model_validate(
        {**material, "fingerprint": hashlib.sha256(serialized.encode()).hexdigest()}
    )
