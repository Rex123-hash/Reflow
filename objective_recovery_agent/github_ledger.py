"""P1C durable state stored in the existing action claim and receipt collections."""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Protocol, cast

from google.cloud import firestore

from objective_recovery.domain.errors import DuplicateIdempotencyKeyError, ReceiptMismatchError
from objective_recovery.domain.models import ActionReceipt, EvidenceKind, ReceiptStatus
from objective_recovery_agent.action_ledger import _receipt_dict, _receipt_from_dict
from objective_recovery_agent.github_contract import GitHubReleaseIntent, intent_fingerprint


@dataclass(frozen=True, slots=True)
class GitHubClaim:
    created: bool
    receipt: ActionReceipt
    progress: dict[str, Any]


class GitHubActionLedger(Protocol):
    def claim(self, intent: GitHubReleaseIntent) -> GitHubClaim: ...
    def save_progress(self, intent: GitHubReleaseIntent, fields: dict[str, Any]) -> None: ...
    def record_receipt(self, receipt: ActionReceipt) -> None: ...
    def load(self, intent: GitHubReleaseIntent) -> GitHubClaim: ...


def _pending(intent: GitHubReleaseIntent, now: datetime) -> ActionReceipt:
    return ActionReceipt(
        receipt_id=intent.receipt_id,
        incident_id=intent.incident_id,
        plan_id=intent.plan_id,
        plan_revision=intent.plan_revision,
        action_id=intent.action.action_id,
        idempotency_key=intent.action.idempotency_key,
        tool="github",
        operation="releases.create_or_adopt",
        desired_state_fingerprint=intent_fingerprint(intent),
        status=ReceiptStatus.PENDING,
        evidence_kind=EvidenceKind.MISSING,
        observed_at=now,
    )


def _intent_dict(intent: GitHubReleaseIntent) -> dict[str, Any]:
    return {
        "incident_id": intent.incident_id,
        "plan_id": intent.plan_id,
        "plan_revision": intent.plan_revision,
        "repository": intent.repository,
        "candidate_sha": intent.candidate_sha,
        "workflow_id": intent.workflow_id,
        "workflow_path": intent.workflow_path,
        "invariant_id": intent.invariant_id,
        "tag": intent.tag,
        "action": {
            "action_id": intent.action.action_id,
            "action_type": intent.action.action_type,
            "target": intent.action.target,
            "parameters": dict(intent.action.parameters),
            "idempotency_key": intent.action.idempotency_key,
        },
    }


def _validate(existing: ActionReceipt, replacement: ActionReceipt) -> None:
    if existing == replacement:
        return
    allowed = {
        ReceiptStatus.PENDING: {ReceiptStatus.WRITE_ACKNOWLEDGED, ReceiptStatus.FAILED},
        ReceiptStatus.WRITE_ACKNOWLEDGED: {ReceiptStatus.VERIFIED, ReceiptStatus.FAILED},
    }
    if (
        existing.receipt_id != replacement.receipt_id
        or existing.action_id != replacement.action_id
        or existing.idempotency_key != replacement.idempotency_key
        or replacement.status not in allowed.get(existing.status, set())
    ):
        raise ReceiptMismatchError(replacement.idempotency_key)


class InMemoryGitHubActionLedger:
    def __init__(self) -> None:
        self.claims: dict[str, dict[str, Any]] = {}
        self.receipts: dict[str, ActionReceipt] = {}

    def claim(self, intent: GitHubReleaseIntent) -> GitHubClaim:
        key = intent.action.idempotency_key
        fingerprint = intent_fingerprint(intent)
        existing = self.claims.get(key)
        if existing is not None:
            if existing["intent_fingerprint"] != fingerprint:
                raise DuplicateIdempotencyKeyError(key)
            return self.load(intent)
        receipt = _pending(intent, datetime.now(UTC))
        self.claims[key] = {"intent_fingerprint": fingerprint, "progress": {}}
        self.receipts[key] = receipt
        return GitHubClaim(True, deepcopy(receipt), {})

    def save_progress(self, intent: GitHubReleaseIntent, fields: dict[str, Any]) -> None:
        claim = self.claims.get(intent.action.idempotency_key)
        if claim is None or claim["intent_fingerprint"] != intent_fingerprint(intent):
            raise ReceiptMismatchError(intent.action.idempotency_key)
        claim["progress"].update(deepcopy(fields))

    def record_receipt(self, receipt: ActionReceipt) -> None:
        existing = self.receipts.get(receipt.idempotency_key)
        if existing is None:
            raise ReceiptMismatchError(receipt.idempotency_key)
        _validate(existing, receipt)
        self.receipts[receipt.idempotency_key] = deepcopy(receipt)

    def load(self, intent: GitHubReleaseIntent) -> GitHubClaim:
        key = intent.action.idempotency_key
        claim = self.claims.get(key)
        if claim is None or claim["intent_fingerprint"] != intent_fingerprint(intent):
            raise ReceiptMismatchError(key)
        return GitHubClaim(False, deepcopy(self.receipts[key]), deepcopy(claim["progress"]))


class FirestoreGitHubActionLedger:
    def __init__(self, project_id: str) -> None:
        self._client = firestore.Client(project=project_id)

    def claim(self, intent: GitHubReleaseIntent) -> GitHubClaim:
        key = intent.action.idempotency_key
        claim_ref = self._client.collection("action_claims").document(key)
        receipt_ref = self._client.collection("action_receipts").document(intent.receipt_id)
        transaction = self._client.transaction()
        fingerprint = intent_fingerprint(intent)

        @firestore.transactional
        def create(transaction: Any) -> GitHubClaim:
            snapshot = claim_ref.get(transaction=transaction)
            if snapshot.exists:
                data = snapshot.to_dict() or {}
                if data.get("intent_fingerprint") != fingerprint:
                    raise DuplicateIdempotencyKeyError(key)
                receipt_snapshot = receipt_ref.get(transaction=transaction)
                if not receipt_snapshot.exists:
                    raise ReceiptMismatchError(key)
                return GitHubClaim(
                    False,
                    _receipt_from_dict(receipt_snapshot.to_dict() or {}),
                    cast(dict[str, Any], data.get("github_progress", {})),
                )
            now = datetime.now(UTC)
            receipt = _pending(intent, now)
            transaction.create(
                claim_ref,
                {
                    "idempotency_key": key,
                    "intent_fingerprint": fingerprint,
                    "intent_kind": "github_release_validation",
                    "intent": _intent_dict(intent),
                    "receipt_id": intent.receipt_id,
                    "github_progress": {},
                    "created_at": now,
                    "updated_at": now,
                },
            )
            transaction.create(receipt_ref, _receipt_dict(receipt))
            return GitHubClaim(True, receipt, {})

        return cast(GitHubClaim, create(transaction))

    def save_progress(self, intent: GitHubReleaseIntent, fields: dict[str, Any]) -> None:
        ref = self._client.collection("action_claims").document(intent.action.idempotency_key)
        ref.set(
            {"github_progress": fields, "updated_at": datetime.now(UTC)},
            merge=True,
        )

    def record_receipt(self, receipt: ActionReceipt) -> None:
        ref = self._client.collection("action_receipts").document(receipt.receipt_id)
        transaction = self._client.transaction()

        @firestore.transactional
        def update(transaction: Any) -> None:
            snapshot = ref.get(transaction=transaction)
            if not snapshot.exists:
                raise ReceiptMismatchError(receipt.idempotency_key)
            existing = _receipt_from_dict(snapshot.to_dict() or {})
            _validate(existing, receipt)
            if existing != receipt:
                transaction.set(ref, _receipt_dict(receipt))

        update(transaction)

    def load(self, intent: GitHubReleaseIntent) -> GitHubClaim:
        key = intent.action.idempotency_key
        claim = self._client.collection("action_claims").document(key).get()
        if not claim.exists:
            raise ReceiptMismatchError(key)
        data = claim.to_dict() or {}
        if data.get("intent_fingerprint") != intent_fingerprint(intent):
            raise DuplicateIdempotencyKeyError(key)
        receipt = self._client.collection("action_receipts").document(intent.receipt_id).get()
        if not receipt.exists:
            raise ReceiptMismatchError(key)
        return GitHubClaim(
            False,
            _receipt_from_dict(receipt.to_dict() or {}),
            cast(dict[str, Any], data.get("github_progress", {})),
        )
