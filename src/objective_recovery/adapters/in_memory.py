"""Emulated adapters for deterministic tests; never external proof."""

from __future__ import annotations

from datetime import UTC, datetime

from objective_recovery.domain.models import (
    Action,
    ActionReceipt,
    EvidenceKind,
    ReceiptStatus,
)


class InMemoryActionExecutor:
    def __init__(self) -> None:
        self.executed: list[Action] = []

    def execute(self, action: Action) -> ActionReceipt:
        self.executed.append(action)
        return ActionReceipt(
            receipt_id=f"emulated:{action.action_id}",
            action_id=action.action_id,
            idempotency_key=action.idempotency_key,
            status=ReceiptStatus.SUCCEEDED,
            evidence_kind=EvidenceKind.EMULATED,
            observed_at=datetime.now(UTC),
            external_reference=None,
        )
