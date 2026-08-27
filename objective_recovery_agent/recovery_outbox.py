"""Deterministic recovery handoffs and post-commit Pub/Sub publication."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any, Protocol

from google.cloud.pubsub_v1 import PublisherClient  # type: ignore[import-untyped]


def failed_verification_fingerprint(evidence: dict[str, Any]) -> str:
    encoded = json.dumps(evidence, sort_keys=True, separators=(",", ":"), default=str).encode()
    return hashlib.sha256(encoded).hexdigest()


def handoff_id_for(incident_id: str, verification_fingerprint: str) -> str:
    return hashlib.sha256(f"{incident_id}|{verification_fingerprint}".encode()).hexdigest()


@dataclass(frozen=True, slots=True)
class RecoveryHandoff:
    handoff_id: str
    incident_id: str
    failed_verification_fingerprint: str
    source_revision: int
    event_type: str = "OBJECTIVE_RECOVERY_NEEDED"
    state: str = "PENDING"

    def payload(self) -> dict[str, Any]:
        return {
            "handoff_id": self.handoff_id,
            "incident_id": self.incident_id,
            "failed_verification_fingerprint": self.failed_verification_fingerprint,
            "source_revision": self.source_revision,
            "event_type": self.event_type,
        }


class RecoveryHandoffLedger(Protocol):
    def mark_recovery_handoff_published(self, handoff_id: str, message_id: str) -> None: ...


class RecoveryPublisher(Protocol):
    def publish(self, handoff: RecoveryHandoff) -> str: ...


class PubSubRecoveryPublisher:
    def __init__(self, project_id: str, topic: str) -> None:
        self._publisher = PublisherClient()
        self._topic_path = self._publisher.topic_path(project_id, topic)

    def publish(self, handoff: RecoveryHandoff) -> str:
        future = self._publisher.publish(
            self._topic_path,
            json.dumps(handoff.payload(), sort_keys=True, separators=(",", ":")).encode(),
            handoff_id=handoff.handoff_id,
            event_type=handoff.event_type,
        )
        return str(future.result(timeout=30))


def publish_handoff(
    ledger: RecoveryHandoffLedger,
    publisher: RecoveryPublisher,
    handoff: RecoveryHandoff,
) -> RecoveryHandoff:
    if handoff.state == "PUBLISHED":
        return handoff
    message_id = publisher.publish(handoff)
    ledger.mark_recovery_handoff_published(handoff.handoff_id, message_id)
    return RecoveryHandoff(
        handoff.handoff_id,
        handoff.incident_id,
        handoff.failed_verification_fingerprint,
        handoff.source_revision,
        handoff.event_type,
        "PUBLISHED",
    )
