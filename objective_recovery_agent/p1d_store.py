"""Transactional P1D reopen, immutable revision checkpoints, and closure persistence."""

from __future__ import annotations

from copy import deepcopy
from datetime import UTC, datetime, timedelta
from typing import Any, Literal, Protocol, cast

from google.cloud import firestore

from objective_recovery.domain.models import IncidentStatus
from objective_recovery.domain.state_machine import Incident
from objective_recovery_agent.ledger import _json_safe
from objective_recovery_agent.schemas import IncidentStage, P1DContinuation

PhaseClaim = Literal["acquired", "completed", "busy"]


class P1DStore(Protocol):
    def load_incident(self, incident_id: str) -> dict[str, Any]: ...
    def reopen(self, handoff: P1DContinuation) -> dict[str, Any]: ...
    def load_revision(self, incident_id: str) -> dict[str, Any]: ...
    def claim_phase(self, incident_id: str, phase: str) -> PhaseClaim: ...
    def checkpoint(
        self,
        incident_id: str,
        phase: str,
        value: Any,
        *,
        stage: IncidentStage | None = None,
        status: str | None = None,
    ) -> dict[str, Any]: ...
    def release_phase(self, incident_id: str, phase: str, error: str) -> None: ...
    def load_action_evidence(self, receipt_id: str) -> tuple[dict[str, Any], dict[str, Any]]: ...
    def finalize(
        self,
        incident_id: str,
        *,
        passed: bool,
        verification: dict[str, Any],
        active_candidate_sha: str,
        resolved_at: datetime,
    ) -> dict[str, Any]: ...


class FirestoreP1DStore:
    def __init__(self, project_id: str) -> None:
        self._client = firestore.Client(project=project_id)

    def _incident_ref(self, incident_id: str) -> Any:
        return self._client.collection("incidents").document(incident_id)

    def _revision_ref(self, incident_id: str) -> Any:
        return self._incident_ref(incident_id).collection("plan_revisions").document("0002")

    def load_incident(self, incident_id: str) -> dict[str, Any]:
        snapshot = self._incident_ref(incident_id).get()
        if not snapshot.exists:
            raise KeyError(incident_id)
        return snapshot.to_dict() or {}

    def reopen(self, handoff: P1DContinuation) -> dict[str, Any]:
        incident_ref = self._incident_ref(handoff.incident_id)
        revision_ref = self._revision_ref(handoff.incident_id)
        outbox_ref = self._client.collection("recovery_outbox").document(handoff.handoff_id)
        transaction = self._client.transaction()

        @firestore.transactional
        def reopen(transaction: Any) -> dict[str, Any]:
            incident_snapshot = incident_ref.get(transaction=transaction)
            outbox_snapshot = outbox_ref.get(transaction=transaction)
            revision_snapshot = revision_ref.get(transaction=transaction)
            if not incident_snapshot.exists or not outbox_snapshot.exists:
                raise KeyError(handoff.incident_id)
            incident = incident_snapshot.to_dict() or {}
            outbox = outbox_snapshot.to_dict() or {}
            expected = handoff.model_dump(mode="json")
            if any(outbox.get(key) != value for key, value in expected.items()):
                raise ValueError("P1D message does not match its durable outbox")
            if (
                incident.get("stage") == "RESOLVED"
                and incident.get("status") == "objective_restored"
            ):
                return incident
            if revision_snapshot.exists:
                return incident
            if (
                incident.get("stage") != "VERIFICATION_FAILED"
                or incident.get("status") != "recovery_incomplete"
                or int(incident.get("revision", -1)) != handoff.source_revision
            ):
                raise ValueError("incident is not at the exact P1D reopen boundary")
            domain = Incident(
                incident_id=handoff.incident_id,
                objective_id=str(incident.get("objective_id", "release-v2")),
                status=IncidentStatus.VERIFICATION_FAILED,
                plan_revision=1,
                history=[IncidentStatus.VERIFICATION_FAILED],
            )
            domain.transition_to(IncidentStatus.REPLANNING)
            if domain.plan_revision != 2:
                raise AssertionError("P1D must enter plan revision 2")
            now = datetime.now(UTC)
            transaction.create(
                revision_ref,
                {
                    "incident_id": handoff.incident_id,
                    "plan_revision": 2,
                    "handoff_id": handoff.handoff_id,
                    "failed_verification_fingerprint": handoff.failed_verification_fingerprint,
                    "source_revision": handoff.source_revision,
                    "created_at": now,
                    "phase_leases": {},
                },
            )
            transaction.set(
                incident_ref,
                {
                    "stage": IncidentStage.REPLANNING.value,
                    "status": "replanning",
                    "replan_count": 1,
                    "active_plan_revision": 2,
                    "objective_version": 1,
                    "updated_at": now,
                    "revision": firestore.Increment(1),
                },
                merge=True,
            )
            transaction.set(
                outbox_ref,
                {"state": "CONSUMED", "consumed_at": now, "plan_revision": 2},
                merge=True,
            )
            return {**incident, "stage": "REPLANNING", "status": "replanning"}

        return cast(dict[str, Any], reopen(transaction))

    def load_revision(self, incident_id: str) -> dict[str, Any]:
        snapshot = self._revision_ref(incident_id).get()
        if not snapshot.exists:
            raise KeyError(f"{incident_id}:0002")
        return snapshot.to_dict() or {}

    def claim_phase(self, incident_id: str, phase: str) -> PhaseClaim:
        ref = self._revision_ref(incident_id)
        transaction = self._client.transaction()
        now = datetime.now(UTC)

        @firestore.transactional
        def claim(transaction: Any) -> PhaseClaim:
            snapshot = ref.get(transaction=transaction)
            if not snapshot.exists:
                raise KeyError(f"{incident_id}:0002")
            data = snapshot.to_dict() or {}
            if phase in data:
                return "completed"
            leases = data.get("phase_leases", {})
            lease = leases.get(phase) if isinstance(leases, dict) else None
            if isinstance(lease, datetime) and lease > now:
                return "busy"
            transaction.set(
                ref,
                {"phase_leases": {phase: now + timedelta(minutes=10)}, "updated_at": now},
                merge=True,
            )
            return "acquired"

        return cast(PhaseClaim, claim(transaction))

    def checkpoint(
        self,
        incident_id: str,
        phase: str,
        value: Any,
        *,
        stage: IncidentStage | None = None,
        status: str | None = None,
    ) -> dict[str, Any]:
        revision_ref = self._revision_ref(incident_id)
        incident_ref = self._incident_ref(incident_id)
        transaction = self._client.transaction()
        safe_value = _json_safe(value)
        now = datetime.now(UTC)

        @firestore.transactional
        def save(transaction: Any) -> dict[str, Any]:
            revision_snapshot = revision_ref.get(transaction=transaction)
            if not revision_snapshot.exists:
                raise KeyError(f"{incident_id}:0002")
            revision = revision_snapshot.to_dict() or {}
            if phase in revision:
                if revision[phase] != safe_value:
                    raise ValueError(f"immutable P1D checkpoint conflict: {phase}")
                return revision
            transaction.set(
                revision_ref,
                {phase: safe_value, "updated_at": now},
                merge=True,
            )
            transaction.update(
                revision_ref,
                {f"phase_leases.{phase}": firestore.DELETE_FIELD},
            )
            if stage is not None:
                update: dict[str, Any] = {
                    "stage": stage.value,
                    "updated_at": now,
                    "revision": firestore.Increment(1),
                }
                if status is not None:
                    update["status"] = status
                transaction.set(incident_ref, update, merge=True)
            return {**revision, phase: safe_value}

        return cast(dict[str, Any], save(transaction))

    def release_phase(self, incident_id: str, phase: str, error: str) -> None:
        self._revision_ref(incident_id).set(
            {
                "phase_leases": {phase: datetime.now(UTC)},
                "last_phase_error": {"phase": phase, "error": error[:500]},
                "updated_at": datetime.now(UTC),
            },
            merge=True,
        )

    def load_action_evidence(self, receipt_id: str) -> tuple[dict[str, Any], dict[str, Any]]:
        receipt = self._client.collection("action_receipts").document(receipt_id).get()
        if not receipt.exists:
            raise KeyError(receipt_id)
        receipt_data = receipt.to_dict() or {}
        idempotency_key = receipt_data.get("idempotency_key")
        if not isinstance(idempotency_key, str):
            raise ValueError("receipt lacks an idempotency key")
        claim = self._client.collection("action_claims").document(idempotency_key).get()
        if not claim.exists:
            raise KeyError(idempotency_key)
        return claim.to_dict() or {}, receipt_data

    def finalize(
        self,
        incident_id: str,
        *,
        passed: bool,
        verification: dict[str, Any],
        active_candidate_sha: str,
        resolved_at: datetime,
    ) -> dict[str, Any]:
        incident_ref = self._incident_ref(incident_id)
        revision_ref = self._revision_ref(incident_id)
        transaction = self._client.transaction()

        @firestore.transactional
        def finalize(transaction: Any) -> dict[str, Any]:
            snapshot = incident_ref.get(transaction=transaction)
            if not snapshot.exists:
                raise KeyError(incident_id)
            incident = snapshot.to_dict() or {}
            if (
                incident.get("stage") == "RESOLVED"
                and incident.get("status") == "objective_restored"
            ):
                return incident
            if incident.get("stage") != "VERIFYING":
                raise ValueError("closure requires the persisted VERIFYING stage")
            stage = "RESOLVED" if passed else "VERIFICATION_FAILED"
            status = "objective_restored" if passed else "recovery_incomplete"
            update = {
                "stage": stage,
                "status": status,
                "active_candidate_sha": active_candidate_sha,
                "active_plan_revision": 2,
                "final_verification": _json_safe(verification),
                "resolved_at": resolved_at if passed else None,
                "updated_at": resolved_at,
                "revision": firestore.Increment(1),
            }
            transaction.set(incident_ref, update, merge=True)
            transaction.set(
                revision_ref,
                {"closure_result": _json_safe(update), "updated_at": resolved_at},
                merge=True,
            )
            return {**incident, **update}

        return cast(dict[str, Any], finalize(transaction))


class InMemoryP1DStore:
    def __init__(self) -> None:
        self.incidents: dict[str, dict[str, Any]] = {}
        self.outbox: dict[str, dict[str, Any]] = {}
        self.revisions: dict[str, dict[str, Any]] = {}
        self.claims: dict[str, dict[str, Any]] = {}
        self.receipts: dict[str, dict[str, Any]] = {}
        self.busy: set[tuple[str, str]] = set()

    def load_incident(self, incident_id: str) -> dict[str, Any]:
        return deepcopy(self.incidents[incident_id])

    def reopen(self, handoff: P1DContinuation) -> dict[str, Any]:
        incident = self.incidents[handoff.incident_id]
        if incident.get("stage") == "RESOLVED":
            return deepcopy(incident)
        if handoff.incident_id in self.revisions:
            return deepcopy(incident)
        if incident.get("stage") != "VERIFICATION_FAILED":
            raise ValueError("incident is not at the exact P1D reopen boundary")
        self.revisions[handoff.incident_id] = {
            "incident_id": handoff.incident_id,
            "plan_revision": 2,
            "handoff_id": handoff.handoff_id,
        }
        incident.update(
            {
                "stage": "REPLANNING",
                "status": "replanning",
                "replan_count": 1,
                "active_plan_revision": 2,
                "objective_version": 1,
                "revision": int(incident.get("revision", 0)) + 1,
            }
        )
        return deepcopy(incident)

    def load_revision(self, incident_id: str) -> dict[str, Any]:
        return deepcopy(self.revisions[incident_id])

    def claim_phase(self, incident_id: str, phase: str) -> PhaseClaim:
        if phase in self.revisions[incident_id]:
            return "completed"
        key = (incident_id, phase)
        if key in self.busy:
            return "busy"
        self.busy.add(key)
        return "acquired"

    def checkpoint(
        self,
        incident_id: str,
        phase: str,
        value: Any,
        *,
        stage: IncidentStage | None = None,
        status: str | None = None,
    ) -> dict[str, Any]:
        revision = self.revisions[incident_id]
        safe = deepcopy(_json_safe(value))
        if phase in revision and revision[phase] != safe:
            raise ValueError(f"immutable P1D checkpoint conflict: {phase}")
        revision.setdefault(phase, safe)
        self.busy.discard((incident_id, phase))
        if stage is not None:
            incident = self.incidents[incident_id]
            incident["stage"] = stage.value
            if status is not None:
                incident["status"] = status
            incident["revision"] = int(incident.get("revision", 0)) + 1
        return deepcopy(revision)

    def release_phase(self, incident_id: str, phase: str, error: str) -> None:
        del error
        self.busy.discard((incident_id, phase))

    def load_action_evidence(self, receipt_id: str) -> tuple[dict[str, Any], dict[str, Any]]:
        receipt = deepcopy(self.receipts[receipt_id])
        return deepcopy(self.claims[str(receipt["idempotency_key"])]), receipt

    def finalize(
        self,
        incident_id: str,
        *,
        passed: bool,
        verification: dict[str, Any],
        active_candidate_sha: str,
        resolved_at: datetime,
    ) -> dict[str, Any]:
        incident = self.incidents[incident_id]
        if incident.get("stage") == "RESOLVED":
            return deepcopy(incident)
        if incident.get("stage") != "VERIFYING":
            raise ValueError("closure requires the persisted VERIFYING stage")
        incident.update(
            {
                "stage": "RESOLVED" if passed else "VERIFICATION_FAILED",
                "status": "objective_restored" if passed else "recovery_incomplete",
                "active_candidate_sha": active_candidate_sha,
                "active_plan_revision": 2,
                "final_verification": deepcopy(verification),
                "resolved_at": resolved_at if passed else None,
                "revision": int(incident.get("revision", 0)) + 1,
            }
        )
        self.revisions[incident_id]["closure_result"] = deepcopy(incident)
        return deepcopy(incident)
