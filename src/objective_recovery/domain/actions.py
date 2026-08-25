"""Stable action identity and receipt ledger."""

from __future__ import annotations

import hashlib
import json

from objective_recovery.domain.errors import (
    DuplicateIdempotencyKeyError,
    ReceiptMismatchError,
)
from objective_recovery.domain.models import Action, ActionReceipt


def derive_idempotency_key(
    *, incident_id: str, revision: int, action_type: str, target: str, desired_state: str
) -> str:
    canonical = json.dumps(
        {
            "action_type": action_type,
            "desired_state": desired_state,
            "incident_id": incident_id,
            "revision": revision,
            "target": target,
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode()).hexdigest()


class ActionLedger:
    """In-process contract model; Firestore will implement durable claims in P1."""

    def __init__(self) -> None:
        self._actions_by_key: dict[str, Action] = {}
        self._receipts_by_key: dict[str, ActionReceipt] = {}

    def claim(self, action: Action) -> bool:
        """Claim an action once; return False for an identical redelivery."""

        existing = self._actions_by_key.get(action.idempotency_key)
        if existing is not None and existing != action:
            raise DuplicateIdempotencyKeyError(action.idempotency_key)
        if existing is not None:
            return False
        self._actions_by_key[action.idempotency_key] = action
        return True

    def record_receipt(self, receipt: ActionReceipt) -> None:
        action = self._actions_by_key.get(receipt.idempotency_key)
        if action is None or action.action_id != receipt.action_id:
            raise ReceiptMismatchError(receipt.idempotency_key)
        existing = self._receipts_by_key.get(receipt.idempotency_key)
        if existing is not None and existing != receipt:
            raise ReceiptMismatchError(receipt.idempotency_key)
        self._receipts_by_key[receipt.idempotency_key] = receipt

    def receipt_for(self, idempotency_key: str) -> ActionReceipt | None:
        return self._receipts_by_key.get(idempotency_key)
