from datetime import UTC, datetime

import pytest

from objective_recovery.adapters.in_memory import InMemoryActionExecutor
from objective_recovery.domain.actions import ActionLedger, derive_idempotency_key
from objective_recovery.domain.errors import (
    DuplicateIdempotencyKeyError,
    ReceiptMismatchError,
)
from objective_recovery.domain.models import (
    Action,
    ActionReceipt,
    EvidenceKind,
    ReceiptStatus,
)

NOW = datetime(2026, 8, 25, 12, tzinfo=UTC)


def make_action(action_id: str = "action-1", key: str = "stable-key") -> Action:
    return Action(
        action_id=action_id,
        action_type="calendar.update",
        target="event:release-review",
        parameters=(("attendee", "engineer-b"),),
        idempotency_key=key,
    )


def make_receipt(
    action_id: str = "action-1", key: str = "stable-key", receipt_id: str = "receipt-1"
) -> ActionReceipt:
    return ActionReceipt(
        receipt_id=receipt_id,
        action_id=action_id,
        idempotency_key=key,
        status=ReceiptStatus.SUCCEEDED,
        evidence_kind=EvidenceKind.EXTERNAL,
        observed_at=NOW,
        external_reference="calendar:event:release-review",
    )


def test_idempotency_key_is_stable_and_revision_sensitive() -> None:
    first = derive_idempotency_key(
        incident_id="incident-1",
        revision=0,
        action_type="calendar.update",
        target="event:1",
        desired_state="attendee=engineer-b",
    )
    second = derive_idempotency_key(
        incident_id="incident-1",
        revision=0,
        action_type="calendar.update",
        target="event:1",
        desired_state="attendee=engineer-b",
    )
    changed = derive_idempotency_key(
        incident_id="incident-1",
        revision=1,
        action_type="calendar.update",
        target="event:1",
        desired_state="attendee=engineer-b",
    )
    assert first == second
    assert first != changed
    assert len(first) == 64


def test_duplicate_idempotency_key_is_rejected() -> None:
    ledger = ActionLedger()
    action = make_action()
    assert ledger.claim(action)
    assert not ledger.claim(action)
    with pytest.raises(DuplicateIdempotencyKeyError):
        ledger.claim(make_action(action_id="different"))


def test_receipt_must_match_claimed_intention_and_is_idempotent() -> None:
    ledger = ActionLedger()
    action = make_action()
    receipt = make_receipt()

    with pytest.raises(ReceiptMismatchError):
        ledger.record_receipt(receipt)
    ledger.claim(action)
    with pytest.raises(ReceiptMismatchError):
        ledger.record_receipt(make_receipt(action_id="different"))
    ledger.record_receipt(receipt)
    ledger.record_receipt(receipt)
    assert ledger.receipt_for("stable-key") == receipt
    assert ledger.receipt_for("absent") is None
    with pytest.raises(ReceiptMismatchError):
        ledger.record_receipt(make_receipt(receipt_id="conflict"))


def test_in_memory_adapter_is_truthfully_emulated() -> None:
    executor = InMemoryActionExecutor()
    action = make_action()
    receipt = executor.execute(action)
    assert executor.executed == [action]
    assert receipt.status is ReceiptStatus.SUCCEEDED
    assert receipt.evidence_kind is EvidenceKind.EMULATED
    assert receipt.external_reference is None
