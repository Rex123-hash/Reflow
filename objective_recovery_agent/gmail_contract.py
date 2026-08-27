"""Typed contracts for the single-mailbox P1E Gmail source boundary."""

from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"
MAX_DECODED_TEXT_BYTES = 64 * 1024
MAX_INTERPRETER_TEXT_CHARS = 12 * 1024
MAX_PERSISTED_EXCERPT_CHARS = 4 * 1024
FULL_SYNC_MESSAGE_CAP = 5000


class GmailModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class GmailClassification(StrEnum):
    REAL_DISRUPTION = "REAL_DISRUPTION"
    NO_RELEVANT_OBJECTIVE_IMPACT = "NO_RELEVANT_OBJECTIVE_IMPACT"
    UNSUPPORTED_EMAIL = "UNSUPPORTED_EMAIL"


class GmailClaimState(StrEnum):
    DISCOVERED = "DISCOVERED"
    FETCHING = "FETCHING"
    FETCHED = "FETCHED"
    INTERPRETING = "INTERPRETING"
    NO_RELEVANT_OBJECTIVE_IMPACT = "NO_RELEVANT_OBJECTIVE_IMPACT"
    UNSUPPORTED_EMAIL = "UNSUPPORTED_EMAIL"
    HANDOFF_PENDING = "HANDOFF_PENDING"
    HANDOFF_PUBLISHED = "HANDOFF_PUBLISHED"
    SOURCE_UNAVAILABLE = "SOURCE_UNAVAILABLE"
    RETRYABLE_ERROR = "RETRYABLE_ERROR"
    PRE_BASELINE_IGNORED = "PRE_BASELINE_IGNORED"
    GAP_UNCERTAIN = "GAP_UNCERTAIN"


class GmailIntegrationHealth(StrEnum):
    INITIALIZING = "INITIALIZING"
    ACTIVE = "ACTIVE"
    AUTH_REQUIRED = "AUTH_REQUIRED"
    CONFIG_ERROR = "CONFIG_ERROR"
    IDENTITY_MISMATCH = "IDENTITY_MISMATCH"
    WATCH_EXPIRED = "WATCH_EXPIRED"
    RECOVERY_REQUIRED = "RECOVERY_REQUIRED"


class GmailNotification(GmailModel):
    email_address: str = Field(alias="emailAddress")
    history_id: str = Field(alias="historyId")

    @field_validator("email_address")
    @classmethod
    def normalize_mailbox(cls, value: str) -> str:
        normalized = value.strip().casefold()
        if "@" not in normalized:
            raise ValueError("invalid Gmail mailbox identity")
        return normalized

    @field_validator("history_id", mode="before")
    @classmethod
    def validate_history_id(cls, value: object) -> str:
        if isinstance(value, bool) or not isinstance(value, (str, int)):
            raise ValueError("Gmail history ID must be a non-negative decimal string")
        normalized = str(value)
        if not normalized.isdecimal() or int(normalized) < 0:
            raise ValueError("Gmail history ID must be a non-negative decimal string")
        return normalized


class GmailWatchResult(GmailModel):
    history_id: str = Field(alias="historyId")
    expiration: str

    @field_validator("history_id")
    @classmethod
    def validate_history_id(cls, value: str) -> str:
        if not value.isdecimal():
            raise ValueError("Gmail watch history ID must be decimal")
        return value

    @field_validator("expiration")
    @classmethod
    def validate_expiration(cls, value: str) -> str:
        if not value.isdecimal():
            raise ValueError("Gmail watch expiration must be epoch milliseconds")
        return value


class GmailProfile(GmailModel):
    email_address: str = Field(alias="emailAddress")
    history_id: str = Field(alias="historyId")
    messages_total: int = Field(default=0, alias="messagesTotal")
    threads_total: int = Field(default=0, alias="threadsTotal")


class GmailHistoryPage(GmailModel):
    history: list[dict[str, Any]] = Field(default_factory=list)
    history_id: str = Field(alias="historyId")
    next_page_token: str | None = Field(default=None, alias="nextPageToken")


class GmailMessageListPage(GmailModel):
    messages: list[dict[str, str]] = Field(default_factory=list)
    next_page_token: str | None = Field(default=None, alias="nextPageToken")


class NormalizedGmailMessage(GmailModel):
    gmail_message_id: str
    thread_id: str
    mailbox: str
    sender: str
    to: str
    cc: str = ""
    subject: str
    internal_date: str
    labels: list[str]
    snippet: str
    normalized_text: str
    content_hash: str
    evidence_excerpt: str
    body_truncated: bool = False


class ObjectiveNodeContext(GmailModel):
    node_id: str
    kind: str
    label: str


class DisruptionFactsInput(GmailModel):
    mailbox: str
    gmail_message_id: str
    sender: str
    subject: str
    internal_date: str
    normalized_text: Annotated[str, Field(max_length=MAX_INTERPRETER_TEXT_CHARS)]


class DisruptionFacts(GmailModel):
    classification: GmailClassification
    event_type: Annotated[str, Field(min_length=3, max_length=80)] = "unsupported-email"
    summary: Annotated[str, Field(min_length=3, max_length=1000)]
    mentioned_entities: Annotated[list[str], Field(max_length=20)] = Field(default_factory=list)
    grounded_excerpts: Annotated[list[str], Field(max_length=10)] = Field(default_factory=list)
    unknowns: Annotated[list[str], Field(max_length=10)] = Field(default_factory=list)

    @model_validator(mode="after")
    def require_grounded_real_disruption(self) -> DisruptionFacts:
        if self.classification is GmailClassification.REAL_DISRUPTION and (
            not self.mentioned_entities or not self.grounded_excerpts
        ):
            raise ValueError("a real disruption requires mentioned entities and evidence")
        return self


class GmailInterpretationInput(GmailModel):
    mailbox: str
    gmail_message_id: str
    sender: str
    subject: str
    internal_date: str
    normalized_text: Annotated[str, Field(max_length=MAX_INTERPRETER_TEXT_CHARS)]
    known_nodes: list[ObjectiveNodeContext]


class ImpactAnalysisInput(GmailModel):
    disruption: DisruptionFacts
    known_nodes: list[ObjectiveNodeContext]


class GmailInterpretation(GmailModel):
    classification: GmailClassification
    event_type: Annotated[str, Field(min_length=3, max_length=80)] = "unsupported-email"
    summary: Annotated[str, Field(min_length=3, max_length=1000)]
    candidate_node_ids: Annotated[list[str], Field(max_length=20)] = Field(default_factory=list)
    grounded_excerpts: Annotated[list[str], Field(max_length=10)] = Field(default_factory=list)
    unknowns: Annotated[list[str], Field(max_length=10)] = Field(default_factory=list)

    @model_validator(mode="after")
    def require_grounded_disruption_shape(self) -> GmailInterpretation:
        if self.classification is GmailClassification.REAL_DISRUPTION and (
            not self.candidate_node_ids or not self.grounded_excerpts
        ):
            raise ValueError("a real disruption requires nodes and grounded excerpts")
        return self


class GmailClaim(GmailModel):
    model_config = ConfigDict(extra="ignore", frozen=True)

    claim_id: str
    mailbox: str
    gmail_message_id: str
    discovered_history_id: str
    state: GmailClaimState
    thread_id: str | None = None
    content_hash: str | None = None
    interpretation: dict[str, Any] | None = None
    canonical_event: dict[str, Any] | None = None
    handoff_message_id: str | None = None
    attempts: int = 0


def compare_history_ids(left: str, right: str) -> int:
    """Compare increasing, non-contiguous Gmail history identifiers exactly."""

    left_value = int(left)
    right_value = int(right)
    return (left_value > right_value) - (left_value < right_value)
