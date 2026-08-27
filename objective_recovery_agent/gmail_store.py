"""Firestore-authoritative Gmail mailbox cursor and source-claim persistence."""

from __future__ import annotations

import hashlib
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol, cast

from google.cloud import firestore

from objective_recovery_agent.gmail_contract import GmailClaim, GmailClaimState


def mailbox_id_for(mailbox: str) -> str:
    return hashlib.sha256(mailbox.strip().casefold().encode()).hexdigest()


def message_claim_id_for(mailbox: str, gmail_message_id: str) -> str:
    return hashlib.sha256(f"{mailbox.strip().casefold()}|{gmail_message_id}".encode()).hexdigest()


class GmailStore(Protocol):
    def load_mailbox(self) -> dict[str, Any]: ...

    def begin_initialization(
        self, *, topic: str, subscription: str, credential_secret_resource: str
    ) -> None: ...

    def activate_initial_watch(self, history_id: str, expiration: str) -> None: ...

    def record_notification(self, history_id: str, transport_message_id: str) -> None: ...

    def acquire_sync_lease(self, owner: str) -> bool: ...

    def release_sync_lease(self, owner: str) -> None: ...

    def persist_discovered_claims(
        self,
        message_ids: list[str],
        history_id: str,
        transport_message_id: str | None,
    ) -> None: ...

    def commit_cursor(self, expected_cursor: str, next_cursor: str) -> None: ...

    def pending_claims(self, limit: int = 100) -> list[GmailClaim]: ...

    def update_claim(self, claim_id: str, fields: dict[str, Any]) -> None: ...

    def renew_watch(self, history_id: str, expiration: str) -> None: ...

    def mark_sync_success(self, *, reconciliation: bool = False) -> None: ...

    def mark_health(self, health: str, error_category: str | None = None) -> None: ...


class FirestoreGmailStore:
    def __init__(self, project_id: str, mailbox: str) -> None:
        self._client = firestore.Client(project=project_id)
        self.mailbox = mailbox.strip().casefold()
        self.mailbox_id = mailbox_id_for(self.mailbox)
        self._mailbox_ref = self._client.collection("gmail_mailboxes").document(self.mailbox_id)

    def _claim_ref(self, claim_id: str) -> Any:
        return self._mailbox_ref.collection("message_claims").document(claim_id)

    def load_mailbox(self) -> dict[str, Any]:
        snapshot = self._mailbox_ref.get()
        if not snapshot.exists:
            raise KeyError(self.mailbox_id)
        return snapshot.to_dict() or {}

    def begin_initialization(
        self, *, topic: str, subscription: str, credential_secret_resource: str
    ) -> None:
        now = datetime.now(UTC)
        self._mailbox_ref.set(
            {
                "mailbox_id": self.mailbox_id,
                "mailbox": self.mailbox,
                "topic": topic,
                "subscription": subscription,
                "watch_status": "INITIALIZING",
                "integration_health": "INITIALIZING",
                "watch_generation": firestore.Increment(1),
                "credential_secret_resource": credential_secret_resource,
                "updated_at": now,
                "version": 1,
            },
            merge=True,
        )

    def activate_initial_watch(self, history_id: str, expiration: str) -> None:
        transaction = self._client.transaction()
        now = datetime.now(UTC)

        @firestore.transactional
        def activate(transaction: Any) -> None:
            snapshot = self._mailbox_ref.get(transaction=transaction)
            if not snapshot.exists:
                raise KeyError(self.mailbox_id)
            state = snapshot.to_dict() or {}
            fields: dict[str, Any] = {
                "watch_status": "ACTIVE",
                "integration_health": "ACTIVE",
                "watch_response_history_id": history_id,
                "watch_expiration": expiration,
                "last_watch_renewal_at": now,
                "updated_at": now,
            }
            if not state.get("last_committed_history_id"):
                fields.update(
                    {
                        "initial_ingestion_floor_history_id": history_id,
                        "initial_ingestion_floor_at": now,
                        "last_committed_history_id": history_id,
                    }
                )
            transaction.set(self._mailbox_ref, fields, merge=True)

        activate(transaction)

    def record_notification(self, history_id: str, transport_message_id: str) -> None:
        transaction = self._client.transaction()

        @firestore.transactional
        def record(transaction: Any) -> None:
            snapshot = self._mailbox_ref.get(transaction=transaction)
            if not snapshot.exists:
                raise KeyError(self.mailbox_id)
            state = snapshot.to_dict() or {}
            maximum = str(state.get("max_notified_history_id", "0"))
            fields: dict[str, Any] = {
                "last_notification_message_id": transport_message_id,
                "last_notification_at": datetime.now(UTC),
                "sync_requested": True,
                "updated_at": datetime.now(UTC),
            }
            if int(history_id) > int(maximum):
                fields["max_notified_history_id"] = history_id
            transaction.set(self._mailbox_ref, fields, merge=True)

        record(transaction)

    def acquire_sync_lease(self, owner: str) -> bool:
        transaction = self._client.transaction()
        now = datetime.now(UTC)

        @firestore.transactional
        def acquire(transaction: Any) -> bool:
            snapshot = self._mailbox_ref.get(transaction=transaction)
            if not snapshot.exists:
                raise KeyError(self.mailbox_id)
            state = snapshot.to_dict() or {}
            lease_until = state.get("sync_lease_until")
            lease_owner = state.get("sync_lease_owner")
            if isinstance(lease_until, datetime) and lease_until > now and lease_owner != owner:
                return False
            transaction.set(
                self._mailbox_ref,
                {
                    "sync_lease_owner": owner,
                    "sync_lease_until": now + timedelta(minutes=10),
                    "updated_at": now,
                },
                merge=True,
            )
            return True

        return cast(bool, acquire(transaction))

    def release_sync_lease(self, owner: str) -> None:
        transaction = self._client.transaction()

        @firestore.transactional
        def release(transaction: Any) -> None:
            snapshot = self._mailbox_ref.get(transaction=transaction)
            if not snapshot.exists:
                return
            state = snapshot.to_dict() or {}
            if state.get("sync_lease_owner") != owner:
                return
            transaction.set(
                self._mailbox_ref,
                {
                    "sync_lease_owner": None,
                    "sync_lease_until": None,
                    "sync_requested": False,
                    "updated_at": datetime.now(UTC),
                },
                merge=True,
            )

        release(transaction)

    def persist_discovered_claims(
        self,
        message_ids: list[str],
        history_id: str,
        transport_message_id: str | None,
    ) -> None:
        now = datetime.now(UTC)
        for message_id in message_ids:
            self._persist_discovered_claim(message_id, history_id, transport_message_id, now)

    def _persist_discovered_claim(
        self,
        message_id: str,
        history_id: str,
        transport_message_id: str | None,
        now: datetime,
    ) -> None:
        claim_id = message_claim_id_for(self.mailbox, message_id)
        claim_ref = self._claim_ref(claim_id)
        transaction = self._client.transaction()

        @firestore.transactional
        def adopt(transaction: Any) -> None:
            snapshot = claim_ref.get(transaction=transaction)
            if snapshot.exists:
                transaction.set(
                    claim_ref,
                    {
                        "last_seen_transport_message_id": transport_message_id,
                        "last_seen_history_id": history_id,
                        "updated_at": now,
                    },
                    merge=True,
                )
                return
            transaction.create(
                claim_ref,
                {
                    "claim_id": claim_id,
                    "mailbox": self.mailbox,
                    "gmail_message_id": message_id,
                    "discovered_history_id": history_id,
                    "state": GmailClaimState.DISCOVERED.value,
                    "first_seen_transport_message_id": transport_message_id,
                    "last_seen_transport_message_id": transport_message_id,
                    "attempts": 0,
                    "created_at": now,
                    "updated_at": now,
                },
            )

        adopt(transaction)

    def commit_cursor(self, expected_cursor: str, next_cursor: str) -> None:
        transaction = self._client.transaction()

        @firestore.transactional
        def commit(transaction: Any) -> None:
            snapshot = self._mailbox_ref.get(transaction=transaction)
            if not snapshot.exists:
                raise KeyError(self.mailbox_id)
            state = snapshot.to_dict() or {}
            current = str(state.get("last_committed_history_id", ""))
            if current != expected_cursor:
                raise ValueError("Gmail cursor changed during synchronization")
            if int(next_cursor) < int(expected_cursor):
                raise ValueError("Gmail cursor cannot move backwards")
            transaction.set(
                self._mailbox_ref,
                {
                    "last_committed_history_id": next_cursor,
                    "updated_at": datetime.now(UTC),
                },
                merge=True,
            )

        commit(transaction)

    def pending_claims(self, limit: int = 100) -> list[GmailClaim]:
        terminal = {
            GmailClaimState.NO_RELEVANT_OBJECTIVE_IMPACT.value,
            GmailClaimState.UNSUPPORTED_EMAIL.value,
            GmailClaimState.HANDOFF_PUBLISHED.value,
            GmailClaimState.SOURCE_UNAVAILABLE.value,
            GmailClaimState.PRE_BASELINE_IGNORED.value,
            GmailClaimState.GAP_UNCERTAIN.value,
        }
        query = self._mailbox_ref.collection("message_claims").limit(limit * 2)
        claims: list[GmailClaim] = []
        for snapshot in query.stream():
            data = snapshot.to_dict() or {}
            if data.get("state") not in terminal:
                claims.append(GmailClaim.model_validate(data))
            if len(claims) >= limit:
                break
        return claims

    def update_claim(self, claim_id: str, fields: dict[str, Any]) -> None:
        forbidden = {"normalized_text", "raw_mime", "access_token", "refresh_token"}
        if forbidden.intersection(fields):
            raise ValueError("sensitive/unbounded Gmail data cannot be persisted")
        self._claim_ref(claim_id).set({**fields, "updated_at": datetime.now(UTC)}, merge=True)

    def renew_watch(self, history_id: str, expiration: str) -> None:
        self._mailbox_ref.set(
            {
                "watch_status": "ACTIVE",
                "integration_health": "ACTIVE",
                "watch_response_history_id": history_id,
                "watch_expiration": expiration,
                "watch_generation": firestore.Increment(1),
                "last_watch_renewal_at": datetime.now(UTC),
                "updated_at": datetime.now(UTC),
            },
            merge=True,
        )

    def mark_sync_success(self, *, reconciliation: bool = False) -> None:
        now = datetime.now(UTC)
        fields: dict[str, Any] = {
            "last_successful_sync_at": now,
            "integration_health": "ACTIVE",
            "last_error_category": None,
            "updated_at": now,
        }
        if reconciliation:
            fields["last_reconciliation_at"] = now
        self._mailbox_ref.set(fields, merge=True)

    def mark_health(self, health: str, error_category: str | None = None) -> None:
        self._mailbox_ref.set(
            {
                "integration_health": health,
                "last_error_category": error_category,
                "updated_at": datetime.now(UTC),
            },
            merge=True,
        )


class InMemoryGmailStore:
    def __init__(self, mailbox: str) -> None:
        self.mailbox = mailbox.casefold()
        self.mailbox_id = mailbox_id_for(self.mailbox)
        self.state: dict[str, Any] = {}
        self.claims: dict[str, dict[str, Any]] = {}

    def load_mailbox(self) -> dict[str, Any]:
        if not self.state:
            raise KeyError(self.mailbox_id)
        return deepcopy(self.state)

    def begin_initialization(
        self, *, topic: str, subscription: str, credential_secret_resource: str
    ) -> None:
        self.state.update(
            {
                "mailbox_id": self.mailbox_id,
                "mailbox": self.mailbox,
                "topic": topic,
                "subscription": subscription,
                "watch_status": "INITIALIZING",
                "integration_health": "INITIALIZING",
                "watch_generation": int(self.state.get("watch_generation", 0)) + 1,
                "credential_secret_resource": credential_secret_resource,
                "version": 1,
            }
        )

    def activate_initial_watch(self, history_id: str, expiration: str) -> None:
        now = datetime.now(UTC)
        self.state.update(
            {
                "watch_status": "ACTIVE",
                "integration_health": "ACTIVE",
                "watch_response_history_id": history_id,
                "watch_expiration": expiration,
            }
        )
        if not self.state.get("last_committed_history_id"):
            self.state.update(
                {
                    "initial_ingestion_floor_history_id": history_id,
                    "initial_ingestion_floor_at": now,
                    "last_committed_history_id": history_id,
                }
            )

    def record_notification(self, history_id: str, transport_message_id: str) -> None:
        maximum = str(self.state.get("max_notified_history_id", "0"))
        if int(history_id) > int(maximum):
            self.state["max_notified_history_id"] = history_id
        self.state.update(
            {"last_notification_message_id": transport_message_id, "sync_requested": True}
        )

    def acquire_sync_lease(self, owner: str) -> bool:
        current = self.state.get("sync_lease_owner")
        if current and current != owner:
            return False
        self.state["sync_lease_owner"] = owner
        return True

    def release_sync_lease(self, owner: str) -> None:
        if self.state.get("sync_lease_owner") == owner:
            self.state["sync_lease_owner"] = None
            self.state["sync_requested"] = False

    def persist_discovered_claims(
        self,
        message_ids: list[str],
        history_id: str,
        transport_message_id: str | None,
    ) -> None:
        for message_id in message_ids:
            claim_id = message_claim_id_for(self.mailbox, message_id)
            existing = self.claims.get(claim_id)
            if existing is None:
                self.claims[claim_id] = {
                    "claim_id": claim_id,
                    "mailbox": self.mailbox,
                    "gmail_message_id": message_id,
                    "discovered_history_id": history_id,
                    "state": GmailClaimState.DISCOVERED.value,
                    "attempts": 0,
                    "first_seen_transport_message_id": transport_message_id,
                }
            else:
                existing["last_seen_transport_message_id"] = transport_message_id

    def commit_cursor(self, expected_cursor: str, next_cursor: str) -> None:
        if self.state.get("last_committed_history_id") != expected_cursor:
            raise ValueError("Gmail cursor changed during synchronization")
        if int(next_cursor) < int(expected_cursor):
            raise ValueError("Gmail cursor cannot move backwards")
        self.state["last_committed_history_id"] = next_cursor

    def pending_claims(self, limit: int = 100) -> list[GmailClaim]:
        terminal = {
            GmailClaimState.NO_RELEVANT_OBJECTIVE_IMPACT.value,
            GmailClaimState.UNSUPPORTED_EMAIL.value,
            GmailClaimState.HANDOFF_PUBLISHED.value,
            GmailClaimState.SOURCE_UNAVAILABLE.value,
            GmailClaimState.PRE_BASELINE_IGNORED.value,
            GmailClaimState.GAP_UNCERTAIN.value,
        }
        return [
            GmailClaim.model_validate(value)
            for value in self.claims.values()
            if value["state"] not in terminal
        ][:limit]

    def update_claim(self, claim_id: str, fields: dict[str, Any]) -> None:
        forbidden = {"normalized_text", "raw_mime", "access_token", "refresh_token"}
        if forbidden.intersection(fields):
            raise ValueError("sensitive/unbounded Gmail data cannot be persisted")
        self.claims[claim_id].update(deepcopy(fields))

    def renew_watch(self, history_id: str, expiration: str) -> None:
        self.state.update(
            {
                "watch_status": "ACTIVE",
                "integration_health": "ACTIVE",
                "watch_response_history_id": history_id,
                "watch_expiration": expiration,
                "watch_generation": int(self.state.get("watch_generation", 0)) + 1,
            }
        )

    def mark_sync_success(self, *, reconciliation: bool = False) -> None:
        self.state.update({"integration_health": "ACTIVE", "last_error_category": None})
        if reconciliation:
            self.state["reconciled"] = True

    def mark_health(self, health: str, error_category: str | None = None) -> None:
        self.state.update({"integration_health": health, "last_error_category": error_category})
