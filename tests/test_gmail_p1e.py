from __future__ import annotations

import base64
import json
from datetime import UTC, datetime
from typing import Any

import pytest
from google.oauth2.credentials import Credentials
from objective_recovery_agent.gmail_contract import (
    GmailClassification,
    GmailHistoryPage,
    GmailInterpretation,
    GmailMessageListPage,
    GmailProfile,
    GmailWatchResult,
)
from objective_recovery_agent.gmail_gateway import GmailApiGateway, GmailGatewayError
from objective_recovery_agent.gmail_ingestion import (
    GmailIngestionConfiguration,
    GmailIngestionService,
    decode_gmail_notification,
)
from objective_recovery_agent.gmail_interpretation import (
    GmailInterpretationError,
    validate_interpretation,
)
from objective_recovery_agent.gmail_normalization import normalize_gmail_message
from objective_recovery_agent.gmail_store import InMemoryGmailStore, message_claim_id_for
from objective_recovery_agent.schemas import DisruptionEvent, PubSubEnvelope

MAILBOX = "reflow.demo@gmail.com"
TOPIC = "projects/test-project/topics/objective-recovery-gmail"
SUBSCRIPTION = "projects/test-project/subscriptions/objective-recovery-gmail-push"


def encoded(value: str) -> str:
    return base64.urlsafe_b64encode(value.encode()).decode().rstrip("=")


def raw_message(
    message_id: str,
    body: str,
    *,
    mime_type: str = "text/plain",
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    message_payload = payload or {
        "mimeType": mime_type,
        "filename": "",
        "headers": [
            {"name": "From", "value": "Delivery Ops <ops@example.com>"},
            {"name": "To", "value": MAILBOX},
            {"name": "Subject", "value": "Operational update"},
            {"name": "Content-Type", "value": f"{mime_type}; charset=utf-8"},
        ],
        "body": {"data": encoded(body), "size": len(body)},
    }
    return {
        "id": message_id,
        "threadId": f"thread-{message_id}",
        "internalDate": "1787846400000",
        "labelIds": ["INBOX"],
        "snippet": body[:80],
        "payload": message_payload,
    }


def history_page(history_id: str, *message_ids: str) -> GmailHistoryPage:
    return GmailHistoryPage.model_validate(
        {
            "historyId": history_id,
            "history": [
                {
                    "id": history_id,
                    "messagesAdded": [
                        {"message": {"id": message_id, "threadId": f"thread-{message_id}"}}
                        for message_id in message_ids
                    ],
                }
            ]
            if message_ids
            else [],
        }
    )


class FakeGateway:
    def __init__(self) -> None:
        self.profile = GmailProfile.model_validate(
            {"emailAddress": MAILBOX, "historyId": "100", "messagesTotal": 0}
        )
        self.watch_results = [
            GmailWatchResult.model_validate({"historyId": "100", "expiration": "1788451200000"})
        ]
        self.history_by_start: dict[str, list[GmailHistoryPage | GmailGatewayError]] = {
            "100": [history_page("100")]
        }
        self.messages: dict[str, dict[str, Any] | Exception] = {}
        self.listed_messages: list[str] = []
        self.history_calls: list[tuple[str, str | None]] = []
        self.message_get_calls: list[str] = []

    def get_profile(self) -> GmailProfile:
        return self.profile

    def watch(self, topic_name: str) -> GmailWatchResult:
        assert topic_name == TOPIC
        return self.watch_results.pop(0)

    def list_history(self, start_history_id: str, page_token: str | None) -> GmailHistoryPage:
        self.history_calls.append((start_history_id, page_token))
        pages = self.history_by_start[start_history_id]
        index = int(page_token or "0")
        value = pages[index]
        if isinstance(value, GmailGatewayError):
            raise value
        if index + 1 < len(pages):
            return value.model_copy(update={"next_page_token": str(index + 1)})
        return value

    def get_message(self, message_id: str) -> dict[str, Any]:
        self.message_get_calls.append(message_id)
        value = self.messages[message_id]
        if isinstance(value, Exception):
            raise value
        return value

    def list_messages(self, page_token: str | None) -> GmailMessageListPage:
        assert page_token is None
        return GmailMessageListPage(
            messages=[{"id": message_id} for message_id in self.listed_messages]
        )


class FakeInterpreter:
    def __init__(self, classification: GmailClassification) -> None:
        self.classification = classification
        self.calls: list[str] = []

    async def interpret(self, message: Any) -> GmailInterpretation:
        self.calls.append(message.gmail_message_id)
        if self.classification is GmailClassification.REAL_DISRUPTION:
            return GmailInterpretation(
                classification=self.classification,
                event_type="resource-unavailable",
                summary="The backend lead is unavailable and API migration is blocked.",
                candidate_node_ids=["person-backend-lead", "work-api-migration"],
                grounded_excerpts=["backend lead is unavailable"],
                unknowns=[],
            )
        return GmailInterpretation(
            classification=self.classification,
            event_type="irrelevant-email",
            summary="No relevant objective impact is grounded in this message.",
        )


class FakePublisher:
    def __init__(self) -> None:
        self.events: list[DisruptionEvent] = []
        self.fail_once = False

    def publish(self, event: DisruptionEvent) -> str:
        self.events.append(event)
        if self.fail_once:
            self.fail_once = False
            raise RuntimeError("publish uncertainty")
        return f"disruption-message-{len(self.events)}"


def service(
    gateway: FakeGateway,
    store: InMemoryGmailStore,
    interpreter: FakeInterpreter,
    publisher: FakePublisher,
) -> GmailIngestionService:
    return GmailIngestionService(
        configuration=GmailIngestionConfiguration(
            mailbox=MAILBOX,
            topic_name=TOPIC,
            subscription_name=SUBSCRIPTION,
            credential_secret_resource="projects/test/secrets/gmail",
        ),
        gateway=gateway,
        store=store,
        interpreter=interpreter,
        disruption_publisher=publisher,
    )


def envelope(
    history_id: str, *, mailbox: str = MAILBOX, message_id: str = "push-1"
) -> PubSubEnvelope:
    data = encoded(json.dumps({"emailAddress": mailbox, "historyId": history_id}))
    return PubSubEnvelope.model_validate(
        {
            "message": {"data": data, "messageId": message_id},
            "subscription": SUBSCRIPTION,
        }
    )


@pytest.mark.asyncio
async def test_initial_watch_baseline_and_immediate_notification_are_safe() -> None:
    gateway = FakeGateway()
    store = InMemoryGmailStore(MAILBOX)
    runner = service(
        gateway,
        store,
        FakeInterpreter(GmailClassification.NO_RELEVANT_OBJECTIVE_IMPACT),
        FakePublisher(),
    )
    await runner.initialize_watch()
    assert store.state["last_committed_history_id"] == "100"
    assert store.state["initial_ingestion_floor_history_id"] == "100"
    assert store.claims == {}

    initializing = InMemoryGmailStore(MAILBOX)
    initializing.begin_initialization(
        topic=TOPIC,
        subscription=SUBSCRIPTION,
        credential_secret_resource="projects/test/secrets/gmail",
    )
    early_runner = service(
        gateway,
        initializing,
        FakeInterpreter(GmailClassification.UNSUPPORTED_EMAIL),
        FakePublisher(),
    )
    await early_runner.handle_notification(envelope("100", message_id="immediate"))
    assert initializing.state["max_notified_history_id"] == "100"
    assert initializing.claims == {}


def test_real_notification_decoding_and_validation() -> None:
    notification = decode_gmail_notification(envelope("12345678901234567890"))
    assert notification.email_address == MAILBOX
    assert notification.history_id == "12345678901234567890"
    numeric_data = encoded(json.dumps({"emailAddress": MAILBOX, "historyId": 1234567890}))
    numeric_envelope = PubSubEnvelope.model_validate(
        {
            "message": {"data": numeric_data, "messageId": "numeric-push"},
            "subscription": SUBSCRIPTION,
        }
    )
    assert decode_gmail_notification(numeric_envelope).history_id == "1234567890"
    bad = envelope("2").model_copy(
        update={"message": envelope("2").message.model_copy(update={"data": "%%%"})}
    )
    with pytest.raises(ValueError, match="invalid Gmail"):
        decode_gmail_notification(bad)


@pytest.mark.asyncio
async def test_history_claims_before_cursor_exact_fetch_and_irrelevant_terminal() -> None:
    gateway = FakeGateway()
    gateway.history_by_start["100"] = [history_page("101", "m-1", "m-1", "m-2")]
    gateway.messages = {
        "m-1": raw_message("m-1", "A weekly product newsletter with no release impact."),
        "m-2": raw_message("m-2", "Lunch menu and office social update."),
    }
    store = InMemoryGmailStore(MAILBOX)
    store.begin_initialization(
        topic=TOPIC, subscription=SUBSCRIPTION, credential_secret_resource="secret"
    )
    store.activate_initial_watch("100", "999")
    interpreter = FakeInterpreter(GmailClassification.NO_RELEVANT_OBJECTIVE_IMPACT)
    publisher = FakePublisher()
    runner = service(gateway, store, interpreter, publisher)
    await runner.handle_notification(envelope("101"))

    assert store.state["last_committed_history_id"] == "101"
    assert len(store.claims) == 2
    assert gateway.message_get_calls == ["m-1", "m-2"]
    assert {claim["state"] for claim in store.claims.values()} == {"NO_RELEVANT_OBJECTIVE_IMPACT"}
    assert publisher.events == []

    await runner.handle_notification(envelope("101", message_id="push-duplicate"))
    assert gateway.message_get_calls == ["m-1", "m-2"]
    assert len(store.claims) == 2


@pytest.mark.asyncio
async def test_grounded_disruption_publishes_one_deterministic_canonical_event() -> None:
    body = "The backend lead is unavailable. API migration is blocked for Release V2."
    gateway = FakeGateway()
    gateway.history_by_start["100"] = [history_page("110", "gmail-message-a")]
    gateway.messages["gmail-message-a"] = raw_message("gmail-message-a", body)
    store = InMemoryGmailStore(MAILBOX)
    store.begin_initialization(
        topic=TOPIC, subscription=SUBSCRIPTION, credential_secret_resource="secret"
    )
    store.activate_initial_watch("100", "999")
    publisher = FakePublisher()
    runner = service(
        gateway,
        store,
        FakeInterpreter(GmailClassification.REAL_DISRUPTION),
        publisher,
    )
    await runner.handle_notification(envelope("110"))
    claim_id = message_claim_id_for(MAILBOX, "gmail-message-a")
    assert len(publisher.events) == 1
    assert publisher.events[0].event_id == f"gmail:{claim_id}"
    assert publisher.events[0].disrupted_node_ids == [
        "person-backend-lead",
        "work-api-migration",
    ]
    assert store.claims[claim_id]["state"] == "HANDOFF_PUBLISHED"
    assert "normalized_text" not in store.claims[claim_id]


@pytest.mark.asyncio
async def test_publish_crash_leaves_handoff_pending_and_retry_republishes_same_event() -> None:
    gateway = FakeGateway()
    gateway.history_by_start["100"] = [history_page("111", "gmail-message-b")]
    gateway.messages["gmail-message-b"] = raw_message(
        "gmail-message-b", "The backend lead is unavailable and API migration is blocked."
    )
    store = InMemoryGmailStore(MAILBOX)
    store.begin_initialization(
        topic=TOPIC, subscription=SUBSCRIPTION, credential_secret_resource="secret"
    )
    store.activate_initial_watch("100", "999")
    publisher = FakePublisher()
    publisher.fail_once = True
    runner = service(
        gateway, store, FakeInterpreter(GmailClassification.REAL_DISRUPTION), publisher
    )
    with pytest.raises(RuntimeError, match="publish uncertainty"):
        await runner.handle_notification(envelope("111"))
    claim_id = message_claim_id_for(MAILBOX, "gmail-message-b")
    assert store.claims[claim_id]["state"] == "HANDOFF_PENDING"
    assert store.state["last_committed_history_id"] == "111"

    await runner.handle_notification(envelope("111", message_id="push-retry"))
    assert [event.event_id for event in publisher.events] == [f"gmail:{claim_id}"] * 2
    assert gateway.message_get_calls == ["gmail-message-b"]


def test_mime_normalization_plain_multipart_html_oversize_and_attachments() -> None:
    plain = normalize_gmail_message(
        raw_message("plain", "Hello  world\n\n\nRelease update"), mailbox=MAILBOX
    )
    assert plain.normalized_text == "Hello world\n\nRelease update"

    multipart_payload = {
        "mimeType": "multipart/alternative",
        "headers": [
            {"name": "From", "value": "ops@example.com"},
            {"name": "To", "value": MAILBOX},
            {"name": "Subject", "value": "Multipart"},
        ],
        "body": {},
        "parts": [
            {
                "mimeType": "text/plain",
                "filename": "",
                "headers": [],
                "body": {"data": encoded("Plain truth")},
            },
            {
                "mimeType": "text/html",
                "filename": "",
                "headers": [],
                "body": {"data": encoded("<p>HTML fallback</p>")},
            },
            {
                "mimeType": "application/pdf",
                "filename": "secret.pdf",
                "body": {"attachmentId": "a-1"},
            },
        ],
    }
    multipart = normalize_gmail_message(
        raw_message("multi", "", payload=multipart_payload), mailbox=MAILBOX
    )
    assert multipart.normalized_text == "Plain truth"

    html_message = raw_message("html", "", mime_type="text/html")
    html_message["payload"]["body"]["data"] = encoded("<style>x</style><p>Safe <b>text</b></p>")
    normalized_html = normalize_gmail_message(html_message, mailbox=MAILBOX)
    assert normalized_html.normalized_text == "Safe text"

    oversized = normalize_gmail_message(raw_message("large", "x" * 70000), mailbox=MAILBOX)
    assert oversized.body_truncated is True
    assert len(oversized.normalized_text.encode()) <= 64 * 1024
    assert len(oversized.evidence_excerpt) == 4 * 1024


def test_interpretation_rejects_fabricated_nodes_and_ungrounded_evidence() -> None:
    message = normalize_gmail_message(
        raw_message("ground", "The backend lead is unavailable."), mailbox=MAILBOX
    )
    fabricated = GmailInterpretation(
        classification=GmailClassification.REAL_DISRUPTION,
        event_type="resource-unavailable",
        summary="A disruption occurred.",
        candidate_node_ids=["person-invented"],
        grounded_excerpts=["backend lead is unavailable"],
    )
    with pytest.raises(GmailInterpretationError, match="unknown graph node"):
        validate_interpretation(message, fabricated)
    ungrounded = fabricated.model_copy(
        update={
            "candidate_node_ids": ["person-backend-lead"],
            "grounded_excerpts": ["fabricated quote"],
        }
    )
    with pytest.raises(GmailInterpretationError, match="ungrounded"):
        validate_interpretation(message, ungrounded)


@pytest.mark.asyncio
async def test_daily_renewal_preserves_cursor_and_syncs_both_sides() -> None:
    gateway = FakeGateway()
    gateway.watch_results = [
        GmailWatchResult.model_validate({"historyId": "200", "expiration": "999999"})
    ]
    gateway.history_by_start = {
        "100": [history_page("150")],
        "150": [history_page("200")],
    }
    store = InMemoryGmailStore(MAILBOX)
    store.begin_initialization(
        topic=TOPIC, subscription=SUBSCRIPTION, credential_secret_resource="secret"
    )
    store.activate_initial_watch("100", "111")
    runner = service(
        gateway,
        store,
        FakeInterpreter(GmailClassification.NO_RELEVANT_OBJECTIVE_IMPACT),
        FakePublisher(),
    )
    await runner.renew_watch()
    assert gateway.history_calls == [("100", None), ("150", None)]
    assert store.state["last_committed_history_id"] == "200"
    assert store.state["watch_response_history_id"] == "200"


@pytest.mark.asyncio
async def test_stale_cursor_marks_new_full_sync_messages_uncertain() -> None:
    gateway = FakeGateway()
    gateway.profile = GmailProfile.model_validate(
        {"emailAddress": MAILBOX, "historyId": "300", "messagesTotal": 1}
    )
    gateway.history_by_start["100"] = [
        GmailGatewayError("gmail_not_found", retryable=False, status_code=404)
    ]
    gateway.listed_messages = ["gap-message"]
    gateway.messages["gap-message"] = raw_message(
        "gap-message", "A message in an unobservable Gmail history interval."
    )
    gateway.history_by_start["300"] = [history_page("300")]
    store = InMemoryGmailStore(MAILBOX)
    store.begin_initialization(
        topic=TOPIC, subscription=SUBSCRIPTION, credential_secret_resource="secret"
    )
    store.activate_initial_watch("100", "111")
    store.state["initial_ingestion_floor_at"] = datetime(2026, 8, 26, tzinfo=UTC)
    runner = service(
        gateway,
        store,
        FakeInterpreter(GmailClassification.REAL_DISRUPTION),
        FakePublisher(),
    )
    await runner.reconcile()
    claim_id = message_claim_id_for(MAILBOX, "gap-message")
    assert store.claims[claim_id]["state"] == "GAP_UNCERTAIN"
    assert store.state["last_committed_history_id"] == "300"
    assert store.state["integration_health"] == "ACTIVE"


@pytest.mark.asyncio
async def test_stale_cursor_ignores_exact_messages_clearly_before_initial_watch() -> None:
    gateway = FakeGateway()
    gateway.profile = GmailProfile.model_validate(
        {"emailAddress": MAILBOX, "historyId": "300", "messagesTotal": 1}
    )
    gateway.history_by_start["100"] = [
        GmailGatewayError("gmail_not_found", retryable=False, status_code=404)
    ]
    gateway.history_by_start["300"] = [history_page("300")]
    gateway.listed_messages = ["old-message"]
    gateway.messages["old-message"] = raw_message("old-message", "Old inbox mail.")
    store = InMemoryGmailStore(MAILBOX)
    store.begin_initialization(
        topic=TOPIC, subscription=SUBSCRIPTION, credential_secret_resource="secret"
    )
    store.activate_initial_watch("100", "111")
    store.state["initial_ingestion_floor_at"] = datetime(2026, 8, 28, tzinfo=UTC)
    publisher = FakePublisher()
    runner = service(
        gateway,
        store,
        FakeInterpreter(GmailClassification.REAL_DISRUPTION),
        publisher,
    )

    await runner.reconcile()

    claim_id = message_claim_id_for(MAILBOX, "old-message")
    assert store.claims[claim_id]["state"] == "PRE_BASELINE_IGNORED"
    assert store.claims[claim_id]["gmail_message_id"] == "old-message"
    assert publisher.events == []
    assert gateway.history_calls == [("100", None), ("300", None)]


@pytest.mark.asyncio
async def test_cursor_does_not_advance_when_claim_commit_crashes() -> None:
    class CommitCrashStore(InMemoryGmailStore):
        fail_commit = True

        def commit_cursor(self, expected_cursor: str, next_cursor: str) -> None:
            if self.fail_commit:
                self.fail_commit = False
                raise RuntimeError("simulated crash after durable claims")
            super().commit_cursor(expected_cursor, next_cursor)

    gateway = FakeGateway()
    gateway.history_by_start["100"] = [history_page("120", "claim-before-cursor")]
    gateway.messages["claim-before-cursor"] = raw_message(
        "claim-before-cursor", "An unrelated operational FYI."
    )
    store = CommitCrashStore(MAILBOX)
    store.begin_initialization(
        topic=TOPIC, subscription=SUBSCRIPTION, credential_secret_resource="secret"
    )
    store.activate_initial_watch("100", "999")
    runner = service(
        gateway,
        store,
        FakeInterpreter(GmailClassification.NO_RELEVANT_OBJECTIVE_IMPACT),
        FakePublisher(),
    )
    with pytest.raises(RuntimeError, match="durable claims"):
        await runner.handle_notification(envelope("120"))
    claim_id = message_claim_id_for(MAILBOX, "claim-before-cursor")
    assert claim_id in store.claims
    assert store.state["last_committed_history_id"] == "100"

    await runner.handle_notification(envelope("120", message_id="retry-after-crash"))
    assert store.state["last_committed_history_id"] == "120"
    assert store.claims[claim_id]["state"] == "NO_RELEVANT_OBJECTIVE_IMPACT"


@pytest.mark.asyncio
async def test_paginated_history_is_fully_claimed_before_final_cursor() -> None:
    gateway = FakeGateway()
    gateway.history_by_start["100"] = [
        history_page("121", "page-one"),
        history_page("122", "page-two"),
    ]
    gateway.messages = {
        "page-one": raw_message("page-one", "Routine status email."),
        "page-two": raw_message("page-two", "Another routine status email."),
    }
    store = InMemoryGmailStore(MAILBOX)
    store.begin_initialization(
        topic=TOPIC, subscription=SUBSCRIPTION, credential_secret_resource="secret"
    )
    store.activate_initial_watch("100", "999")
    runner = service(
        gateway,
        store,
        FakeInterpreter(GmailClassification.NO_RELEVANT_OBJECTIVE_IMPACT),
        FakePublisher(),
    )
    await runner.handle_notification(envelope("122"))
    assert gateway.history_calls == [("100", None), ("100", "1")]
    assert store.state["last_committed_history_id"] == "122"
    assert len(store.claims) == 2


@pytest.mark.asyncio
async def test_wrong_mailbox_out_of_order_notification_and_busy_lease_are_safe() -> None:
    gateway = FakeGateway()
    store = InMemoryGmailStore(MAILBOX)
    store.begin_initialization(
        topic=TOPIC, subscription=SUBSCRIPTION, credential_secret_resource="secret"
    )
    store.activate_initial_watch("100", "999")
    runner = service(
        gateway,
        store,
        FakeInterpreter(GmailClassification.REAL_DISRUPTION),
        FakePublisher(),
    )
    with pytest.raises(ValueError, match="mailbox"):
        await runner.handle_notification(envelope("101", mailbox="other@gmail.com"))

    await runner.handle_notification(envelope("99", message_id="out-of-order"))
    assert store.state["last_committed_history_id"] == "100"
    assert gateway.history_calls == []

    assert store.acquire_sync_lease("active-worker")
    await runner.synchronize(owner="overlapping-worker")
    assert store.state["sync_lease_owner"] == "active-worker"


@pytest.mark.asyncio
async def test_disappeared_source_and_unsupported_mime_are_terminal_without_handoff() -> None:
    gateway = FakeGateway()
    gateway.history_by_start["100"] = [history_page("130", "gone", "attachment-only")]
    gateway.messages["gone"] = GmailGatewayError(
        "gmail_not_found", retryable=False, status_code=404
    )
    gateway.messages["attachment-only"] = raw_message(
        "attachment-only",
        "",
        payload={
            "mimeType": "multipart/mixed",
            "headers": [],
            "body": {},
            "parts": [
                {
                    "mimeType": "application/pdf",
                    "filename": "private.pdf",
                    "body": {"attachmentId": "attachment"},
                }
            ],
        },
    )
    store = InMemoryGmailStore(MAILBOX)
    store.begin_initialization(
        topic=TOPIC, subscription=SUBSCRIPTION, credential_secret_resource="secret"
    )
    store.activate_initial_watch("100", "999")
    publisher = FakePublisher()
    runner = service(
        gateway,
        store,
        FakeInterpreter(GmailClassification.REAL_DISRUPTION),
        publisher,
    )
    await runner.handle_notification(envelope("130"))
    assert {
        store.claims[message_claim_id_for(MAILBOX, "gone")]["state"],
        store.claims[message_claim_id_for(MAILBOX, "attachment-only")]["state"],
    } == {"SOURCE_UNAVAILABLE", "UNSUPPORTED_EMAIL"}
    assert publisher.events == []


def test_gateway_retries_429_and_5xx_but_fails_closed_on_credential_error() -> None:
    class Response:
        def __init__(self, status_code: int, payload: dict[str, Any]) -> None:
            self.status_code = status_code
            self._payload = payload

        def json(self) -> dict[str, Any]:
            return self._payload

    class Session:
        def __init__(self, responses: list[Response]) -> None:
            self.responses = responses
            self.calls = 0

        def request(self, *args: object, **kwargs: object) -> Response:
            del args, kwargs
            response = self.responses[self.calls]
            self.calls += 1
            return response

    sleeps: list[float] = []
    retry_session = Session(
        [
            Response(429, {}),
            Response(503, {}),
            Response(
                200,
                {
                    "emailAddress": MAILBOX,
                    "historyId": "100",
                    "messagesTotal": 0,
                    "threadsTotal": 0,
                },
            ),
        ]
    )
    gateway = GmailApiGateway(
        Credentials(token="test"),  # type: ignore[no-untyped-call]
        session=retry_session,
        sleep=sleeps.append,
        jitter=lambda: 0,
    )
    profile = gateway.get_profile()
    assert profile.email_address == MAILBOX
    assert profile.threads_total == 0
    assert retry_session.calls == 3
    assert sleeps == [1, 2]

    denied = GmailApiGateway(
        Credentials(token="test"),  # type: ignore[no-untyped-call]
        session=Session([Response(401, {})]),
        sleep=lambda _: None,
    )
    with pytest.raises(GmailGatewayError) as captured:
        denied.get_profile()
    assert captured.value.category == "oauth_grant_invalid"
    assert captured.value.retryable is False


@pytest.mark.asyncio
async def test_revoked_grant_marks_connector_auth_required_not_objective_failure() -> None:
    class RevokedGateway(FakeGateway):
        def get_profile(self) -> GmailProfile:
            raise GmailGatewayError("oauth_grant_invalid", retryable=False)

    store = InMemoryGmailStore(MAILBOX)
    runner = service(
        RevokedGateway(),
        store,
        FakeInterpreter(GmailClassification.REAL_DISRUPTION),
        FakePublisher(),
    )
    with pytest.raises(GmailGatewayError, match="oauth_grant_invalid"):
        await runner.initialize_watch()
    assert store.state["integration_health"] == "AUTH_REQUIRED"
    assert store.claims == {}
