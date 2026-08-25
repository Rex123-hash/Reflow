"""Firestore-authoritative incident ledger with transactional event deduplication."""

from __future__ import annotations

import hashlib
import json
from copy import deepcopy
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol, cast

from google.cloud import firestore

from objective_recovery_agent.schemas import (
    DisruptionEvent,
    IncidentStage,
    WorkflowEventType,
)


@dataclass(frozen=True, slots=True)
class ClaimResult:
    incident_id: str
    should_process: bool
    deduplicated: bool


class WorkflowLedger(Protocol):
    def claim_event(self, event: DisruptionEvent, message_id: str) -> ClaimResult: ...

    def load_incident(self, incident_id: str) -> dict[str, Any]: ...

    def save_checkpoint(
        self,
        incident_id: str,
        stage: IncidentStage,
        fields: dict[str, Any],
    ) -> None: ...

    def record_event(
        self,
        incident_id: str,
        event_type: WorkflowEventType,
        key: str,
        details: dict[str, Any],
    ) -> None: ...

    def complete_claim(self, event_id: str) -> None: ...

    def release_claim(self, event_id: str, error: str) -> None: ...


def incident_id_for(event_id: str) -> str:
    digest = hashlib.sha256(event_id.encode()).hexdigest()[:20]
    return f"incident-{digest}"


def _json_safe(value: Any) -> Any:
    return json.loads(json.dumps(value, default=str))


class FirestoreWorkflowLedger:
    def __init__(self, project_id: str) -> None:
        self._client = firestore.Client(project=project_id)

    def claim_event(self, event: DisruptionEvent, message_id: str) -> ClaimResult:
        claim_ref = self._client.collection("event_claims").document(event.event_id)
        incident_id = incident_id_for(event.event_id)
        incident_ref = self._client.collection("incidents").document(incident_id)
        transaction = self._client.transaction()
        now = datetime.now(UTC)

        @firestore.transactional
        def claim(transaction: Any) -> ClaimResult:
            snapshot = claim_ref.get(transaction=transaction)
            if snapshot.exists:
                data = snapshot.to_dict() or {}
                if data.get("state") == "completed":
                    return ClaimResult(incident_id, False, True)
                lease_until = data.get("lease_until")
                if isinstance(lease_until, datetime) and lease_until > now:
                    return ClaimResult(incident_id, False, False)
                transaction.update(
                    claim_ref,
                    {
                        "state": "processing",
                        "lease_until": now + timedelta(minutes=10),
                        "last_message_id": message_id,
                        "attempts": firestore.Increment(1),
                        "updated_at": now,
                    },
                )
                return ClaimResult(incident_id, True, False)

            transaction.create(
                claim_ref,
                {
                    "event_id": event.event_id,
                    "incident_id": incident_id,
                    "state": "processing",
                    "lease_until": now + timedelta(minutes=10),
                    "first_message_id": message_id,
                    "last_message_id": message_id,
                    "attempts": 1,
                    "created_at": now,
                    "updated_at": now,
                },
            )
            transaction.create(
                incident_ref,
                {
                    "incident_id": incident_id,
                    "source_event_id": event.event_id,
                    "stage": IncidentStage.EVENT_RECEIVED.value,
                    "status": "detected",
                    "disruption": event.model_dump(mode="json"),
                    "created_at": now,
                    "updated_at": now,
                    "revision": 0,
                },
            )
            return ClaimResult(incident_id, True, False)

        result = cast(ClaimResult, claim(transaction))
        if result.should_process and not result.deduplicated:
            self.record_event(
                incident_id,
                WorkflowEventType.EVENT_RECEIVED,
                "transport",
                {"message_id": message_id, "event_id": event.event_id},
            )
        return result

    def load_incident(self, incident_id: str) -> dict[str, Any]:
        snapshot = self._client.collection("incidents").document(incident_id).get()
        if not snapshot.exists:
            raise KeyError(incident_id)
        return snapshot.to_dict() or {}

    def save_checkpoint(
        self, incident_id: str, stage: IncidentStage, fields: dict[str, Any]
    ) -> None:
        ref = self._client.collection("incidents").document(incident_id)
        ref.set(
            {
                **_json_safe(fields),
                "stage": stage.value,
                "updated_at": datetime.now(UTC),
                "revision": firestore.Increment(1),
            },
            merge=True,
        )

    def record_event(
        self,
        incident_id: str,
        event_type: WorkflowEventType,
        key: str,
        details: dict[str, Any],
    ) -> None:
        safe_key = hashlib.sha256(key.encode()).hexdigest()[:16]
        ref = (
            self._client.collection("incidents")
            .document(incident_id)
            .collection("workflow_events")
            .document(f"{event_type.value}-{safe_key}")
        )
        payload = {
            "incident_id": incident_id,
            "event_type": event_type.value,
            "key": key,
            "details": _json_safe(details),
            "occurred_at": datetime.now(UTC),
        }
        ref.set(payload)
        print(
            json.dumps({**payload, "occurred_at": payload["occurred_at"].isoformat()}), flush=True
        )

    def complete_claim(self, event_id: str) -> None:
        self._client.collection("event_claims").document(event_id).set(
            {
                "state": "completed",
                "lease_until": None,
                "completed_at": datetime.now(UTC),
                "updated_at": datetime.now(UTC),
            },
            merge=True,
        )

    def release_claim(self, event_id: str, error: str) -> None:
        self._client.collection("event_claims").document(event_id).set(
            {
                "state": "retryable",
                "lease_until": datetime.now(UTC),
                "last_error": error[:1000],
                "updated_at": datetime.now(UTC),
            },
            merge=True,
        )


class InMemoryWorkflowLedger:
    """Deterministic ledger test double; it never claims to be external proof."""

    def __init__(self) -> None:
        self.incidents: dict[str, dict[str, Any]] = {}
        self.claims: dict[str, dict[str, Any]] = {}
        self.events: dict[str, dict[str, dict[str, Any]]] = {}

    def claim_event(self, event: DisruptionEvent, message_id: str) -> ClaimResult:
        incident_id = incident_id_for(event.event_id)
        existing = self.claims.get(event.event_id)
        if existing and existing["state"] == "completed":
            return ClaimResult(incident_id, False, True)
        if existing and existing["state"] == "processing":
            return ClaimResult(incident_id, False, False)
        self.claims[event.event_id] = {"state": "processing", "message_id": message_id}
        if incident_id not in self.incidents:
            self.incidents[incident_id] = {
                "incident_id": incident_id,
                "source_event_id": event.event_id,
                "stage": IncidentStage.EVENT_RECEIVED.value,
                "status": "detected",
                "disruption": event.model_dump(mode="json"),
                "revision": 0,
            }
        self.record_event(
            incident_id,
            WorkflowEventType.EVENT_RECEIVED,
            "transport",
            {"message_id": message_id, "event_id": event.event_id},
        )
        return ClaimResult(incident_id, True, False)

    def load_incident(self, incident_id: str) -> dict[str, Any]:
        return deepcopy(self.incidents[incident_id])

    def save_checkpoint(
        self, incident_id: str, stage: IncidentStage, fields: dict[str, Any]
    ) -> None:
        self.incidents[incident_id].update(deepcopy(_json_safe(fields)))
        self.incidents[incident_id]["stage"] = stage.value
        self.incidents[incident_id]["revision"] += 1

    def record_event(
        self,
        incident_id: str,
        event_type: WorkflowEventType,
        key: str,
        details: dict[str, Any],
    ) -> None:
        event_key = f"{event_type.value}:{key}"
        self.events.setdefault(incident_id, {})[event_key] = {
            "event_type": event_type.value,
            "details": deepcopy(_json_safe(details)),
        }

    def complete_claim(self, event_id: str) -> None:
        self.claims[event_id]["state"] = "completed"

    def release_claim(self, event_id: str, error: str) -> None:
        self.claims[event_id].update({"state": "retryable", "last_error": error})
