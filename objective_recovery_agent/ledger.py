"""Firestore-authoritative incident ledger with transactional event deduplication."""

from __future__ import annotations

import hashlib
import json
from copy import deepcopy
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol, cast

from google.cloud import firestore

from objective_recovery_agent.observability import emit_operational_event
from objective_recovery_agent.recovery_outbox import (
    P1CContinuationHandoff,
    RecoveryHandoff,
    handoff_id_for,
    p1c_handoff_id_for,
)
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
    attempt: int = 1
    resumed: bool = False


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

    def persist_recovery_needed(
        self,
        incident_id: str,
        fields: dict[str, Any],
        failed_verification_fingerprint: str,
    ) -> RecoveryHandoff | None: ...

    def persist_p1c_continuation(
        self,
        incident_id: str,
        fields: dict[str, Any],
        verified_effect_fingerprint: str,
    ) -> P1CContinuationHandoff: ...

    def mark_recovery_handoff_published(self, handoff_id: str, message_id: str) -> None: ...


def incident_id_for(event_id: str) -> str:
    digest = hashlib.sha256(event_id.encode()).hexdigest()[:20]
    return f"incident-{digest}"


def _json_safe(value: Any) -> Any:
    return json.loads(json.dumps(value, default=str))


def _recovery_handoff(expected: dict[str, Any], state: str = "PENDING") -> RecoveryHandoff:
    return RecoveryHandoff(
        handoff_id=str(expected["handoff_id"]),
        incident_id=str(expected["incident_id"]),
        failed_verification_fingerprint=str(expected["failed_verification_fingerprint"]),
        source_revision=int(expected["source_revision"]),
        event_type=str(expected["event_type"]),
        state=state,
    )


def _p1c_handoff(expected: dict[str, Any], state: str = "PENDING") -> P1CContinuationHandoff:
    return P1CContinuationHandoff(
        handoff_id=str(expected["handoff_id"]),
        incident_id=str(expected["incident_id"]),
        verified_effect_fingerprint=str(expected["verified_effect_fingerprint"]),
        source_revision=int(expected["source_revision"]),
        event_type=str(expected["event_type"]),
        state=state,
    )


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
                attempt = int(data.get("attempts", 1))
                if data.get("state") == "completed":
                    return ClaimResult(incident_id, False, True, attempt)
                lease_until = data.get("lease_until")
                if isinstance(lease_until, datetime) and lease_until > now:
                    return ClaimResult(incident_id, False, False, attempt)
                next_attempt = attempt + 1
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
                return ClaimResult(incident_id, True, False, next_attempt, True)

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
                    "objective_id": event.objective_id,
                    "objective_version": event.objective_version,
                    "stage": IncidentStage.EVENT_RECEIVED.value,
                    "status": "detected",
                    "disruption": event.model_dump(mode="json"),
                    "created_at": now,
                    "updated_at": now,
                    "revision": 0,
                },
            )
            return ClaimResult(incident_id, True, False, 1, False)

        result = cast(ClaimResult, claim(transaction))
        if result.should_process and not result.deduplicated and not result.resumed:
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
        emit_operational_event(
            event_type.value,
            incident_id=incident_id,
            workflow_event=event_type.value,
            workflow_key=key,
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

    def persist_recovery_needed(
        self,
        incident_id: str,
        fields: dict[str, Any],
        failed_verification_fingerprint: str,
    ) -> RecoveryHandoff | None:
        incident_ref = self._client.collection("incidents").document(incident_id)
        handoff_id = handoff_id_for(incident_id, failed_verification_fingerprint)
        outbox_ref = self._client.collection("recovery_outbox").document(handoff_id)
        transaction = self._client.transaction()
        now = datetime.now(UTC)

        @firestore.transactional
        def persist(transaction: Any) -> RecoveryHandoff | None:
            incident_snapshot = incident_ref.get(transaction=transaction)
            if not incident_snapshot.exists:
                raise KeyError(incident_id)
            incident = incident_snapshot.to_dict() or {}
            if (
                incident.get("stage") == IncidentStage.RESOLVED.value
                and incident.get("status") == "objective_restored"
            ):
                return None
            already_terminal = (
                incident.get("stage") == IncidentStage.VERIFICATION_FAILED.value
                and incident.get("status") == "recovery_incomplete"
            )
            if incident.get("stage") not in {
                IncidentStage.VERIFYING.value,
                IncidentStage.VERIFICATION_FAILED.value,
            }:
                raise ValueError("incident is not eligible for a recovery handoff")
            source_revision = int(incident.get("revision", 0)) + (0 if already_terminal else 1)
            outbox_snapshot = outbox_ref.get(transaction=transaction)
            expected = {
                "handoff_id": handoff_id,
                "incident_id": incident_id,
                "failed_verification_fingerprint": failed_verification_fingerprint,
                "source_revision": source_revision,
                "event_type": "OBJECTIVE_RECOVERY_NEEDED",
            }
            if outbox_snapshot.exists:
                outbox = outbox_snapshot.to_dict() or {}
                if any(outbox.get(key) != value for key, value in expected.items()):
                    raise ValueError("recovery handoff identity collision")
                return _recovery_handoff(expected, str(outbox.get("state", "PENDING")))
            if not already_terminal:
                transaction.set(
                    incident_ref,
                    {
                        **_json_safe(fields),
                        "stage": IncidentStage.VERIFICATION_FAILED.value,
                        "status": "recovery_incomplete",
                        "updated_at": now,
                        "revision": firestore.Increment(1),
                    },
                    merge=True,
                )
            transaction.create(outbox_ref, {**expected, "state": "PENDING", "created_at": now})
            return _recovery_handoff(expected)

        return cast(RecoveryHandoff | None, persist(transaction))

    def persist_p1c_continuation(
        self,
        incident_id: str,
        fields: dict[str, Any],
        verified_effect_fingerprint: str,
    ) -> P1CContinuationHandoff:
        """Atomically persist the verified P1B terminal state and P1C outbox."""

        if fields.get("action_receipt_status") != "verified":
            raise ValueError("P1C continuation requires a VERIFIED P1B receipt")
        incident_ref = self._client.collection("incidents").document(incident_id)
        handoff_id = p1c_handoff_id_for(incident_id, verified_effect_fingerprint)
        outbox_ref = self._client.collection("recovery_outbox").document(handoff_id)
        transaction = self._client.transaction()
        now = datetime.now(UTC)

        @firestore.transactional
        def persist(transaction: Any) -> P1CContinuationHandoff:
            incident_snapshot = incident_ref.get(transaction=transaction)
            if not incident_snapshot.exists:
                raise KeyError(incident_id)
            incident = incident_snapshot.to_dict() or {}
            if not incident.get("selected_plan_id"):
                raise ValueError("P1C continuation requires the persisted selected plan")
            if incident.get("stage") not in {
                IncidentStage.EXECUTING.value,
                IncidentStage.VERIFYING.value,
            }:
                raise ValueError("incident is not eligible for a P1C continuation")

            outbox_snapshot = outbox_ref.get(transaction=transaction)
            if outbox_snapshot.exists:
                outbox = outbox_snapshot.to_dict() or {}
                stable = {
                    "handoff_id": handoff_id,
                    "incident_id": incident_id,
                    "verified_effect_fingerprint": verified_effect_fingerprint,
                    "event_type": "P1C_RECOVERY_CONTINUATION_NEEDED",
                }
                if any(outbox.get(key) != value for key, value in stable.items()):
                    raise ValueError("P1C continuation handoff identity collision")
                if not (
                    incident.get("stage") == IncidentStage.VERIFYING.value
                    and incident.get("action_receipt_status") == "verified"
                ):
                    transaction.set(
                        incident_ref,
                        {
                            **_json_safe(fields),
                            "stage": IncidentStage.VERIFYING.value,
                            "updated_at": now,
                            "revision": firestore.Increment(1),
                        },
                        merge=True,
                    )
                return _p1c_handoff(outbox, str(outbox.get("state", "PENDING")))

            already_terminal = (
                incident.get("stage") == IncidentStage.VERIFYING.value
                and incident.get("action_receipt_status") == "verified"
            )
            source_revision = int(incident.get("revision", 0)) + (0 if already_terminal else 1)
            expected = {
                "handoff_id": handoff_id,
                "incident_id": incident_id,
                "verified_effect_fingerprint": verified_effect_fingerprint,
                "source_revision": source_revision,
                "event_type": "P1C_RECOVERY_CONTINUATION_NEEDED",
            }
            if not already_terminal:
                transaction.set(
                    incident_ref,
                    {
                        **_json_safe(fields),
                        "stage": IncidentStage.VERIFYING.value,
                        "updated_at": now,
                        "revision": firestore.Increment(1),
                    },
                    merge=True,
                )
            transaction.create(outbox_ref, {**expected, "state": "PENDING", "created_at": now})
            return _p1c_handoff(expected)

        return cast(P1CContinuationHandoff, persist(transaction))

    def mark_recovery_handoff_published(self, handoff_id: str, message_id: str) -> None:
        ref = self._client.collection("recovery_outbox").document(handoff_id)
        transaction = self._client.transaction()

        @firestore.transactional
        def mark(transaction: Any) -> None:
            snapshot = ref.get(transaction=transaction)
            if not snapshot.exists:
                raise KeyError(handoff_id)
            data = snapshot.to_dict() or {}
            if data.get("state") == "PUBLISHED":
                return
            if data.get("state") != "PENDING":
                raise ValueError("recovery handoff has an unsupported state")
            transaction.update(
                ref,
                {
                    "state": "PUBLISHED",
                    "pubsub_message_id": message_id,
                    "published_at": datetime.now(UTC),
                },
            )

        mark(transaction)


class InMemoryWorkflowLedger:
    """Deterministic ledger test double; it never claims to be external proof."""

    def __init__(self) -> None:
        self.incidents: dict[str, dict[str, Any]] = {}
        self.claims: dict[str, dict[str, Any]] = {}
        self.events: dict[str, dict[str, dict[str, Any]]] = {}
        self.recovery_outbox: dict[str, dict[str, Any]] = {}

    def claim_event(self, event: DisruptionEvent, message_id: str) -> ClaimResult:
        incident_id = incident_id_for(event.event_id)
        existing = self.claims.get(event.event_id)
        if existing and existing["state"] == "completed":
            return ClaimResult(incident_id, False, True, int(existing["attempts"]))
        if existing and existing["state"] == "processing":
            return ClaimResult(incident_id, False, False, int(existing["attempts"]))
        attempt = int(existing["attempts"]) + 1 if existing else 1
        resumed = existing is not None
        self.claims[event.event_id] = {
            "state": "processing",
            "message_id": message_id,
            "attempts": attempt,
        }
        if incident_id not in self.incidents:
            self.incidents[incident_id] = {
                "incident_id": incident_id,
                "source_event_id": event.event_id,
                "objective_id": event.objective_id,
                "objective_version": event.objective_version,
                "stage": IncidentStage.EVENT_RECEIVED.value,
                "status": "detected",
                "disruption": event.model_dump(mode="json"),
                "revision": 0,
            }
        if not resumed:
            self.record_event(
                incident_id,
                WorkflowEventType.EVENT_RECEIVED,
                "transport",
                {"message_id": message_id, "event_id": event.event_id},
            )
        return ClaimResult(incident_id, True, False, attempt, resumed)

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

    def persist_recovery_needed(
        self,
        incident_id: str,
        fields: dict[str, Any],
        failed_verification_fingerprint: str,
    ) -> RecoveryHandoff | None:
        incident = self.incidents[incident_id]
        if incident.get("stage") == "RESOLVED" and incident.get("status") == "objective_restored":
            return None
        already_terminal = (
            incident.get("stage") == "VERIFICATION_FAILED"
            and incident.get("status") == "recovery_incomplete"
        )
        if incident.get("stage") not in {"VERIFYING", "VERIFICATION_FAILED"}:
            raise ValueError("incident is not eligible for a recovery handoff")
        source_revision = int(incident.get("revision", 0)) + (0 if already_terminal else 1)
        handoff_id = handoff_id_for(incident_id, failed_verification_fingerprint)
        expected = {
            "handoff_id": handoff_id,
            "incident_id": incident_id,
            "failed_verification_fingerprint": failed_verification_fingerprint,
            "source_revision": source_revision,
            "event_type": "OBJECTIVE_RECOVERY_NEEDED",
        }
        existing = self.recovery_outbox.get(handoff_id)
        if existing is not None:
            if any(existing.get(key) != value for key, value in expected.items()):
                raise ValueError("recovery handoff identity collision")
            return _recovery_handoff(expected, str(existing.get("state", "PENDING")))
        if not already_terminal:
            incident.update(deepcopy(_json_safe(fields)))
            incident.update(
                {
                    "stage": "VERIFICATION_FAILED",
                    "status": "recovery_incomplete",
                    "revision": source_revision,
                }
            )
        self.recovery_outbox[handoff_id] = {**expected, "state": "PENDING"}
        return _recovery_handoff(expected)

    def persist_p1c_continuation(
        self,
        incident_id: str,
        fields: dict[str, Any],
        verified_effect_fingerprint: str,
    ) -> P1CContinuationHandoff:
        if fields.get("action_receipt_status") != "verified":
            raise ValueError("P1C continuation requires a VERIFIED P1B receipt")
        incident = self.incidents[incident_id]
        if not incident.get("selected_plan_id"):
            raise ValueError("P1C continuation requires the persisted selected plan")
        if incident.get("stage") not in {"EXECUTING", "VERIFYING"}:
            raise ValueError("incident is not eligible for a P1C continuation")
        handoff_id = p1c_handoff_id_for(incident_id, verified_effect_fingerprint)
        existing = self.recovery_outbox.get(handoff_id)
        stable = {
            "handoff_id": handoff_id,
            "incident_id": incident_id,
            "verified_effect_fingerprint": verified_effect_fingerprint,
            "event_type": "P1C_RECOVERY_CONTINUATION_NEEDED",
        }
        if existing is not None:
            if any(existing.get(key) != value for key, value in stable.items()):
                raise ValueError("P1C continuation handoff identity collision")
            if not (
                incident.get("stage") == "VERIFYING"
                and incident.get("action_receipt_status") == "verified"
            ):
                source_revision = int(incident.get("revision", 0)) + 1
                incident.update(deepcopy(_json_safe(fields)))
                incident.update({"stage": "VERIFYING", "revision": source_revision})
            return _p1c_handoff(existing, str(existing.get("state", "PENDING")))
        already_terminal = (
            incident.get("stage") == "VERIFYING"
            and incident.get("action_receipt_status") == "verified"
        )
        source_revision = int(incident.get("revision", 0)) + (0 if already_terminal else 1)
        expected = {**stable, "source_revision": source_revision}
        if not already_terminal:
            incident.update(deepcopy(_json_safe(fields)))
            incident.update({"stage": "VERIFYING", "revision": source_revision})
        self.recovery_outbox[handoff_id] = {**expected, "state": "PENDING"}
        return _p1c_handoff(expected)

    def mark_recovery_handoff_published(self, handoff_id: str, message_id: str) -> None:
        outbox = self.recovery_outbox[handoff_id]
        if outbox.get("state") == "PUBLISHED":
            return
        if outbox.get("state") != "PENDING":
            raise ValueError("recovery handoff has an unsupported state")
        outbox.update({"state": "PUBLISHED", "pubsub_message_id": message_id})
