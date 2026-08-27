"""Durable Gmail history synchronization and canonical disruption handoff."""

from __future__ import annotations

import base64
import binascii
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol

from google.cloud.pubsub_v1 import PublisherClient  # type: ignore[import-untyped]
from pydantic import ValidationError

from objective_recovery_agent.gmail_contract import (
    FULL_SYNC_MESSAGE_CAP,
    GmailClaim,
    GmailClaimState,
    GmailClassification,
    GmailIntegrationHealth,
    GmailNotification,
)
from objective_recovery_agent.gmail_gateway import GmailGateway, GmailGatewayError
from objective_recovery_agent.gmail_interpretation import (
    GmailInterpretationError,
    GmailInterpreter,
    validate_interpretation,
)
from objective_recovery_agent.gmail_normalization import (
    GmailMessageNormalizationError,
    normalize_gmail_message,
)
from objective_recovery_agent.gmail_store import GmailStore
from objective_recovery_agent.observability import emit_operational_event
from objective_recovery_agent.schemas import DisruptionEvent, PubSubEnvelope


@dataclass(frozen=True, slots=True)
class GmailIngestionConfiguration:
    mailbox: str
    topic_name: str
    subscription_name: str
    credential_secret_resource: str

    def __post_init__(self) -> None:
        if "@" not in self.mailbox or not self.topic_name or not self.subscription_name:
            raise ValueError("complete Gmail mailbox/topic/subscription configuration is required")


class DisruptionPublisher(Protocol):
    def publish(self, event: DisruptionEvent) -> str: ...


class PubSubDisruptionPublisher:
    def __init__(self, project_id: str, topic: str) -> None:
        self._publisher = PublisherClient()
        self._topic_path = self._publisher.topic_path(project_id, topic)

    def publish(self, event: DisruptionEvent) -> str:
        future = self._publisher.publish(
            self._topic_path,
            event.model_dump_json().encode("utf-8"),
            event_id=event.event_id,
            source="gmail",
        )
        return str(future.result(timeout=30))


def decode_gmail_notification(envelope: PubSubEnvelope) -> GmailNotification:
    value = envelope.message.data
    padded = value + ("=" * (-len(value) % 4))
    try:
        decoded = base64.urlsafe_b64decode(padded.encode("ascii"))
        return GmailNotification.model_validate_json(decoded)
    except (UnicodeEncodeError, binascii.Error, ValidationError, ValueError) as error:
        raise ValueError("invalid Gmail Pub/Sub notification") from error


class GmailIngestionService:
    def __init__(
        self,
        *,
        configuration: GmailIngestionConfiguration,
        gateway: GmailGateway,
        store: GmailStore,
        interpreter: GmailInterpreter,
        disruption_publisher: DisruptionPublisher,
    ) -> None:
        self._configuration = configuration
        self._gateway = gateway
        self._store = store
        self._interpreter = interpreter
        self._publisher = disruption_publisher

    def _verify_profile(self) -> None:
        profile = self._gateway.get_profile()
        if profile.email_address.strip().casefold() != self._configuration.mailbox.casefold():
            self._store.mark_health(
                GmailIntegrationHealth.IDENTITY_MISMATCH.value, "gmail_mailbox_identity_mismatch"
            )
            raise GmailGatewayError("gmail_mailbox_identity_mismatch", retryable=False)

    def _record_gateway_failure(self, error: GmailGatewayError) -> None:
        if error.category in {"oauth_grant_invalid", "gmail_oauth_secret_missing"}:
            health = GmailIntegrationHealth.AUTH_REQUIRED
            emit_operational_event(
                "GMAIL_AUTH_REQUIRED",
                mailbox=self._configuration.mailbox,
                error_category=error.category,
            )
        elif error.category in {"gmail_permission_denied", "invalid_oauth_secret"}:
            health = GmailIntegrationHealth.CONFIG_ERROR
        else:
            state = self._store.load_mailbox()
            expiration = str(state.get("watch_expiration", "0"))
            expired = expiration.isdecimal() and int(expiration) <= int(
                datetime.now(UTC).timestamp() * 1000
            )
            health = (
                GmailIntegrationHealth.WATCH_EXPIRED if expired else GmailIntegrationHealth.ACTIVE
            )
        self._store.mark_health(health.value, error.category)

    async def initialize_watch(self) -> None:
        self._store.begin_initialization(
            topic=self._configuration.topic_name,
            subscription=self._configuration.subscription_name,
            credential_secret_resource=self._configuration.credential_secret_resource,
        )
        try:
            self._verify_profile()
            result = self._gateway.watch(self._configuration.topic_name)
        except GmailGatewayError as error:
            self._record_gateway_failure(error)
            raise
        self._store.activate_initial_watch(result.history_id, result.expiration)
        emit_operational_event(
            "GMAIL_WATCH_ACTIVE",
            mailbox=self._configuration.mailbox,
            history_id=result.history_id,
            expiration=result.expiration,
        )
        await self.synchronize(owner=f"watch-init-{uuid.uuid4()}")

    async def handle_notification(self, envelope: PubSubEnvelope) -> None:
        notification = decode_gmail_notification(envelope)
        if notification.email_address != self._configuration.mailbox.casefold():
            raise ValueError("Gmail notification mailbox does not match configuration")
        self._store.record_notification(notification.history_id, envelope.message.message_id)
        emit_operational_event(
            "GMAIL_NOTIFICATION_RECEIVED",
            mailbox=self._configuration.mailbox,
            message_id=envelope.message.message_id,
            history_id=notification.history_id,
        )
        state = self._store.load_mailbox()
        if state.get("watch_status") == "INITIALIZING":
            return
        await self.synchronize(
            owner=f"push-{envelope.message.message_id}",
            transport_message_id=envelope.message.message_id,
        )

    async def renew_watch(self) -> None:
        owner = f"renew-{uuid.uuid4()}"
        if not self._store.acquire_sync_lease(owner):
            raise GmailGatewayError("gmail_sync_busy", retryable=True)
        try:
            await self._synchronize_locked(owner=owner, transport_message_id=None)
            self._verify_profile()
            result = self._gateway.watch(self._configuration.topic_name)
            self._store.renew_watch(result.history_id, result.expiration)
            emit_operational_event(
                "GMAIL_WATCH_RENEWED",
                mailbox=self._configuration.mailbox,
                history_id=result.history_id,
                expiration=result.expiration,
            )
            await self._synchronize_locked(owner=owner, transport_message_id=None)
        except GmailGatewayError as error:
            self._record_gateway_failure(error)
            raise
        finally:
            self._store.release_sync_lease(owner)

    async def reconcile(self) -> None:
        await self.synchronize(owner=f"reconcile-{uuid.uuid4()}", reconciliation=True)

    async def synchronize(
        self,
        *,
        owner: str,
        transport_message_id: str | None = None,
        reconciliation: bool = False,
    ) -> None:
        if not self._store.acquire_sync_lease(owner):
            return
        try:
            await self._synchronize_locked(owner, transport_message_id)
            self._store.mark_sync_success(reconciliation=reconciliation)
        finally:
            self._store.release_sync_lease(owner)

    async def _synchronize_locked(self, owner: str, transport_message_id: str | None) -> None:
        del owner
        emit_operational_event("GMAIL_HISTORY_SYNC_STARTED", mailbox=self._configuration.mailbox)
        while True:
            state = self._store.load_mailbox()
            cursor = str(state.get("last_committed_history_id", ""))
            if not cursor:
                raise GmailGatewayError("gmail_cursor_missing", retryable=False)
            notified = str(state.get("max_notified_history_id", cursor))
            if transport_message_id is not None and int(notified) <= int(cursor):
                await self._drain_claims()
                emit_operational_event(
                    "GMAIL_HISTORY_SYNCED",
                    mailbox=self._configuration.mailbox,
                    history_id=cursor,
                )
                return
            page_token: str | None = None
            final_history_id = cursor
            try:
                while True:
                    page = self._gateway.list_history(cursor, page_token)
                    message_ids = sorted(
                        {
                            str(message["id"])
                            for history in page.history
                            if isinstance(history, dict)
                            for added in history.get("messagesAdded", [])
                            if isinstance(added, dict)
                            for message in [added.get("message")]
                            if isinstance(message, dict) and message.get("id")
                        }
                    )
                    self._store.persist_discovered_claims(
                        message_ids, page.history_id, transport_message_id
                    )
                    final_history_id = page.history_id
                    page_token = page.next_page_token
                    if not page_token:
                        break
            except GmailGatewayError as error:
                if error.status_code == 404:
                    await self._recover_stale_cursor(cursor, transport_message_id)
                    return
                raise

            self._store.commit_cursor(cursor, final_history_id)
            await self._drain_claims()
            latest = self._store.load_mailbox()
            high_watermark = str(latest.get("max_notified_history_id", final_history_id))
            if int(high_watermark) <= int(final_history_id):
                emit_operational_event(
                    "GMAIL_HISTORY_SYNCED",
                    mailbox=self._configuration.mailbox,
                    history_id=final_history_id,
                )
                return

    async def _drain_claims(self) -> None:
        while True:
            claims = self._store.pending_claims()
            if not claims:
                return
            for claim in claims:
                await self._process_claim(claim)

    async def _process_claim(self, claim: GmailClaim) -> None:
        if claim.state is GmailClaimState.HANDOFF_PENDING and claim.canonical_event is not None:
            event = DisruptionEvent.model_validate(claim.canonical_event)
            message_id = self._publisher.publish(event)
            self._store.update_claim(
                claim.claim_id,
                {
                    "state": GmailClaimState.HANDOFF_PUBLISHED.value,
                    "handoff_message_id": message_id,
                },
            )
            return

        self._store.update_claim(
            claim.claim_id,
            {"state": GmailClaimState.FETCHING.value, "attempts": claim.attempts + 1},
        )
        try:
            raw = self._gateway.get_message(claim.gmail_message_id)
        except GmailGatewayError as error:
            if error.status_code == 404:
                self._store.update_claim(
                    claim.claim_id,
                    {
                        "state": GmailClaimState.SOURCE_UNAVAILABLE.value,
                        "error_category": error.category,
                    },
                )
                return
            self._store.update_claim(
                claim.claim_id,
                {
                    "state": GmailClaimState.RETRYABLE_ERROR.value,
                    "error_category": error.category,
                },
            )
            raise
        try:
            message = normalize_gmail_message(raw, mailbox=self._configuration.mailbox)
        except GmailMessageNormalizationError as error:
            self._store.update_claim(
                claim.claim_id,
                {
                    "state": GmailClaimState.UNSUPPORTED_EMAIL.value,
                    "error_category": str(error)[:200],
                },
            )
            return

        self._store.update_claim(
            claim.claim_id,
            {
                "state": GmailClaimState.INTERPRETING.value,
                "thread_id": message.thread_id,
                "sender": message.sender[:500],
                "subject": message.subject[:500],
                "internal_date": message.internal_date,
                "labels": message.labels,
                "snippet": message.snippet,
                "content_hash": message.content_hash,
                "evidence_excerpt": message.evidence_excerpt,
                "body_truncated": message.body_truncated,
            },
        )
        emit_operational_event(
            "GMAIL_MESSAGE_FETCHED",
            gmail_message_id=message.gmail_message_id,
            content_hash=message.content_hash,
        )
        try:
            interpretation = validate_interpretation(
                message, await self._interpreter.interpret(message)
            )
        except GmailInterpretationError as error:
            self._store.update_claim(
                claim.claim_id,
                {
                    "state": GmailClaimState.RETRYABLE_ERROR.value,
                    "error_category": str(error)[:200],
                },
            )
            raise

        safe_interpretation = interpretation.model_dump(mode="json")
        if interpretation.classification is not GmailClassification.REAL_DISRUPTION:
            terminal = (
                GmailClaimState.NO_RELEVANT_OBJECTIVE_IMPACT
                if interpretation.classification is GmailClassification.NO_RELEVANT_OBJECTIVE_IMPACT
                else GmailClaimState.UNSUPPORTED_EMAIL
            )
            self._store.update_claim(
                claim.claim_id,
                {"state": terminal.value, "interpretation": safe_interpretation},
            )
            emit_operational_event(
                terminal.value,
                gmail_message_id=message.gmail_message_id,
                content_hash=message.content_hash,
            )
            return

        event = DisruptionEvent(
            event_id=f"gmail:{claim.claim_id}",
            event_type=interpretation.event_type,
            occurred_at=message.internal_date,
            source="gmail",
            summary=interpretation.summary,
            disrupted_node_ids=interpretation.candidate_node_ids,
            evidence_references=[
                f"gmail-message:{message.gmail_message_id}",
                f"sha256:{message.content_hash}",
            ],
        )
        self._store.update_claim(
            claim.claim_id,
            {
                "state": GmailClaimState.HANDOFF_PENDING.value,
                "interpretation": safe_interpretation,
                "canonical_event": event.model_dump(mode="json"),
            },
        )
        message_id = self._publisher.publish(event)
        self._store.update_claim(
            claim.claim_id,
            {
                "state": GmailClaimState.HANDOFF_PUBLISHED.value,
                "handoff_message_id": message_id,
            },
        )
        emit_operational_event(
            "RECOVERY_EVENT_PUBLISHED",
            event_id=event.event_id,
            gmail_message_id=message.gmail_message_id,
            pubsub_message_id=message_id,
        )

    async def _recover_stale_cursor(
        self, stale_cursor: str, transport_message_id: str | None
    ) -> None:
        self._store.mark_health(
            GmailIntegrationHealth.RECOVERY_REQUIRED.value, "gmail_history_cursor_stale"
        )
        emit_operational_event(
            "GMAIL_SYNC_RECOVERY_REQUIRED",
            mailbox=self._configuration.mailbox,
            stale_history_id=stale_cursor,
        )
        profile = self._gateway.get_profile()
        existing_pending = {
            claim.claim_id for claim in self._store.pending_claims(limit=FULL_SYNC_MESSAGE_CAP)
        }
        page_token: str | None = None
        discovered: list[str] = []
        while True:
            page = self._gateway.list_messages(page_token)
            discovered.extend(
                str(message["id"])
                for message in page.messages
                if isinstance(message, dict) and message.get("id")
            )
            if len(discovered) > FULL_SYNC_MESSAGE_CAP:
                self._store.mark_health(
                    GmailIntegrationHealth.RECOVERY_REQUIRED.value,
                    "gmail_full_sync_cap_exceeded",
                )
                raise GmailGatewayError("gmail_full_sync_cap_exceeded", retryable=False)
            page_token = page.next_page_token
            if not page_token:
                break
        self._store.persist_discovered_claims(
            sorted(set(discovered)), profile.history_id, transport_message_id
        )
        state = self._store.load_mailbox()
        floor_value = state.get("initial_ingestion_floor_at")
        if isinstance(floor_value, datetime):
            floor_at = floor_value
        elif isinstance(floor_value, str):
            floor_at = datetime.fromisoformat(floor_value.replace("Z", "+00:00"))
        else:
            floor_at = None

        # Exact read-back lets us prove that mail older than the first watch is not a
        # new disruption. Anything else in the unobservable interval remains uncertain.
        for claim in self._store.pending_claims(limit=FULL_SYNC_MESSAGE_CAP):
            if claim.claim_id in existing_pending:
                continue
            try:
                message = normalize_gmail_message(
                    self._gateway.get_message(claim.gmail_message_id),
                    mailbox=self._configuration.mailbox,
                )
            except GmailGatewayError as error:
                if error.status_code != 404:
                    raise
                self._store.update_claim(
                    claim.claim_id,
                    {
                        "state": GmailClaimState.SOURCE_UNAVAILABLE.value,
                        "error_category": error.category,
                    },
                )
                continue
            except GmailMessageNormalizationError as error:
                self._store.update_claim(
                    claim.claim_id,
                    {
                        "state": GmailClaimState.UNSUPPORTED_EMAIL.value,
                        "error_category": str(error)[:200],
                    },
                )
                continue

            message_at = datetime.fromisoformat(message.internal_date.replace("Z", "+00:00"))
            clearly_pre_baseline = floor_at is not None and message_at < floor_at
            self._store.update_claim(
                claim.claim_id,
                {
                    "state": (
                        GmailClaimState.PRE_BASELINE_IGNORED.value
                        if clearly_pre_baseline
                        else GmailClaimState.GAP_UNCERTAIN.value
                    ),
                    "thread_id": message.thread_id,
                    "sender": message.sender[:500],
                    "subject": message.subject[:500],
                    "internal_date": message.internal_date,
                    "labels": message.labels,
                    "content_hash": message.content_hash,
                    "evidence_excerpt": message.evidence_excerpt,
                    "error_category": (
                        "gmail_message_pre_initial_watch"
                        if clearly_pre_baseline
                        else "gmail_history_gap_unprovable"
                    ),
                },
            )
        self._store.commit_cursor(stale_cursor, profile.history_id)

        # Establish the current edge from the new authoritative baseline. Messages
        # added after Hbase use ordinary claims-before-cursor processing.
        recovery_cursor = profile.history_id
        page_token: str | None = None
        final_history_id = recovery_cursor
        try:
            while True:
                page = self._gateway.list_history(recovery_cursor, page_token)
                message_ids = sorted(
                    {
                        str(message["id"])
                        for history in page.history
                        if isinstance(history, dict)
                        for added in history.get("messagesAdded", [])
                        if isinstance(added, dict)
                        for message in [added.get("message")]
                        if isinstance(message, dict) and message.get("id")
                    }
                )
                self._store.persist_discovered_claims(
                    message_ids, page.history_id, transport_message_id
                )
                final_history_id = page.history_id
                page_token = page.next_page_token
                if not page_token:
                    break
        except GmailGatewayError as error:
            if error.status_code == 404:
                raise GmailGatewayError("gmail_recovery_baseline_stale", retryable=True) from error
            raise
        self._store.commit_cursor(recovery_cursor, final_history_id)
        await self._drain_claims()
        self._store.mark_health(GmailIntegrationHealth.ACTIVE.value)
