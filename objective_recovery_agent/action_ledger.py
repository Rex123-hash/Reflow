"""Durable action claim and monotonic P1B receipt persistence."""

from __future__ import annotations

from copy import deepcopy
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from typing import Any, Protocol, cast

from google.cloud import firestore

from objective_recovery.domain.errors import DuplicateIdempotencyKeyError, ReceiptMismatchError
from objective_recovery.domain.models import ActionReceipt, EvidenceKind, ReceiptStatus
from objective_recovery_agent.calendar_contract import CalendarActionIntent, intent_fingerprint


@dataclass(frozen=True, slots=True)
class ActionClaimResult:
    created: bool
    receipt: ActionReceipt


class DurableActionLedger(Protocol):
    def claim(self, intent: CalendarActionIntent) -> ActionClaimResult: ...

    def record_receipt(self, receipt: ActionReceipt) -> None: ...

    def receipt_for(self, idempotency_key: str) -> ActionReceipt | None: ...


_ALLOWED_RECEIPT_TRANSITIONS = {
    ReceiptStatus.PENDING: {
        ReceiptStatus.WRITE_ACKNOWLEDGED,
        ReceiptStatus.FAILED,
    },
    ReceiptStatus.WRITE_ACKNOWLEDGED: {
        ReceiptStatus.VERIFIED,
        ReceiptStatus.VERIFICATION_FAILED,
        ReceiptStatus.FAILED,
    },
    ReceiptStatus.VERIFICATION_FAILED: {ReceiptStatus.VERIFIED},
}


def pending_receipt(intent: CalendarActionIntent, now: datetime) -> ActionReceipt:
    return ActionReceipt(
        receipt_id=intent.receipt_id,
        incident_id=intent.incident_id,
        plan_id=intent.plan_id,
        plan_revision=intent.plan_revision,
        action_id=intent.action.action_id,
        idempotency_key=intent.action.idempotency_key,
        tool="google_calendar",
        operation="events.insert",
        desired_state_fingerprint=intent.desired_state_fingerprint,
        external_calendar_id=intent.calendar_id,
        external_event_id=intent.event_id,
        status=ReceiptStatus.PENDING,
        evidence_kind=EvidenceKind.MISSING,
        observed_at=now,
        compensation_operation=intent.compensation_operation,
        compensation_target=intent.event_id,
    )


def _receipt_dict(receipt: ActionReceipt) -> dict[str, Any]:
    data = asdict(receipt)
    data["status"] = receipt.status.value
    data["evidence_kind"] = receipt.evidence_kind.value
    data["observed_state"] = dict(receipt.observed_state)
    return data


def _intent_dict(intent: CalendarActionIntent) -> dict[str, Any]:
    """Firestore rejects arrays nested directly in arrays; parameters are a map on disk."""

    data = intent.model_dump(mode="json")
    action = data["action"]
    if not isinstance(action, dict):
        raise TypeError("serialized Calendar action must be a mapping")
    action["parameters"] = dict(intent.action.parameters)
    return data


def _receipt_from_dict(data: dict[str, Any]) -> ActionReceipt:
    values = dict(data)
    values["status"] = ReceiptStatus(values["status"])
    values["evidence_kind"] = EvidenceKind(values["evidence_kind"])
    observed_state = values.get("observed_state", {})
    if isinstance(observed_state, dict):
        values["observed_state"] = tuple(
            sorted((str(key), str(value)) for key, value in observed_state.items())
        )
    else:
        values["observed_state"] = tuple(tuple(item) for item in observed_state)
    values["verification_differences"] = tuple(values.get("verification_differences", ()))
    return ActionReceipt(**values)


def _validate_update(existing: ActionReceipt, replacement: ActionReceipt) -> None:
    if existing == replacement:
        return
    if (
        existing.receipt_id != replacement.receipt_id
        or existing.action_id != replacement.action_id
        or existing.idempotency_key != replacement.idempotency_key
        or replacement.status not in _ALLOWED_RECEIPT_TRANSITIONS.get(existing.status, set())
    ):
        raise ReceiptMismatchError(replacement.idempotency_key)


class InMemoryActionReceiptLedger:
    def __init__(self) -> None:
        self.claims: dict[str, dict[str, Any]] = {}
        self.receipts: dict[str, ActionReceipt] = {}

    def claim(self, intent: CalendarActionIntent) -> ActionClaimResult:
        key = intent.action.idempotency_key
        fingerprint = intent_fingerprint(intent)
        existing = self.claims.get(key)
        if existing is not None:
            if existing["intent_fingerprint"] != fingerprint:
                raise DuplicateIdempotencyKeyError(key)
            return ActionClaimResult(False, deepcopy(self.receipts[key]))
        receipt = pending_receipt(intent, datetime.now(UTC))
        self.claims[key] = {"intent_fingerprint": fingerprint, "intent": intent}
        self.receipts[key] = receipt
        return ActionClaimResult(True, deepcopy(receipt))

    def record_receipt(self, receipt: ActionReceipt) -> None:
        existing = self.receipts.get(receipt.idempotency_key)
        if existing is None:
            raise ReceiptMismatchError(receipt.idempotency_key)
        _validate_update(existing, receipt)
        self.receipts[receipt.idempotency_key] = deepcopy(receipt)

    def receipt_for(self, idempotency_key: str) -> ActionReceipt | None:
        receipt = self.receipts.get(idempotency_key)
        return deepcopy(receipt) if receipt is not None else None


class FirestoreActionReceiptLedger:
    def __init__(self, project_id: str) -> None:
        self._client = firestore.Client(project=project_id)

    def claim(self, intent: CalendarActionIntent) -> ActionClaimResult:
        key = intent.action.idempotency_key
        claim_ref = self._client.collection("action_claims").document(key)
        receipt_ref = self._client.collection("action_receipts").document(intent.receipt_id)
        transaction = self._client.transaction()
        fingerprint = intent_fingerprint(intent)

        @firestore.transactional
        def create_claim(transaction: Any) -> ActionClaimResult:
            existing_claim = claim_ref.get(transaction=transaction)
            if existing_claim.exists:
                claim_data = existing_claim.to_dict() or {}
                if claim_data.get("intent_fingerprint") != fingerprint:
                    raise DuplicateIdempotencyKeyError(key)
                receipt_snapshot = receipt_ref.get(transaction=transaction)
                if not receipt_snapshot.exists:
                    raise ReceiptMismatchError(key)
                return ActionClaimResult(
                    False, _receipt_from_dict(receipt_snapshot.to_dict() or {})
                )
            now = datetime.now(UTC)
            receipt = pending_receipt(intent, now)
            transaction.create(
                claim_ref,
                {
                    "idempotency_key": key,
                    "intent_fingerprint": fingerprint,
                    "intent": _intent_dict(intent),
                    "receipt_id": intent.receipt_id,
                    "created_at": now,
                    "updated_at": now,
                },
            )
            transaction.create(receipt_ref, _receipt_dict(receipt))
            return ActionClaimResult(True, receipt)

        return cast(ActionClaimResult, create_claim(transaction))

    def record_receipt(self, receipt: ActionReceipt) -> None:
        receipt_ref = self._client.collection("action_receipts").document(receipt.receipt_id)
        claim_ref = self._client.collection("action_claims").document(receipt.idempotency_key)
        transaction = self._client.transaction()

        @firestore.transactional
        def update_receipt(transaction: Any) -> None:
            snapshot = receipt_ref.get(transaction=transaction)
            if not snapshot.exists:
                raise ReceiptMismatchError(receipt.idempotency_key)
            existing = _receipt_from_dict(snapshot.to_dict() or {})
            _validate_update(existing, receipt)
            if existing != receipt:
                transaction.set(receipt_ref, _receipt_dict(receipt))
                transaction.update(claim_ref, {"updated_at": datetime.now(UTC)})

        update_receipt(transaction)

    def receipt_for(self, idempotency_key: str) -> ActionReceipt | None:
        claim = self._client.collection("action_claims").document(idempotency_key).get()
        if not claim.exists:
            return None
        receipt_id = (claim.to_dict() or {}).get("receipt_id")
        if not isinstance(receipt_id, str):
            raise ReceiptMismatchError(idempotency_key)
        receipt = self._client.collection("action_receipts").document(receipt_id).get()
        if not receipt.exists:
            raise ReceiptMismatchError(idempotency_key)
        return _receipt_from_dict(receipt.to_dict() or {})
