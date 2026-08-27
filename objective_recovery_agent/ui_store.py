"""Internal persistence adapter for presentation-only reads."""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Literal, Protocol, cast

from google.cloud import firestore
from google.cloud.firestore_v1.services.firestore import FirestoreClient


class PresentationStore(Protocol):
    def list_objectives(self) -> tuple[dict[str, Any], ...]: ...

    def list_incidents(self) -> tuple[dict[str, Any], ...]: ...

    def load_incident(self, incident_id: str) -> dict[str, Any]: ...

    def load_plan_revision(self, incident_id: str, revision: int) -> dict[str, Any] | None: ...

    def list_workflow_events(self, incident_id: str) -> tuple[dict[str, Any], ...]: ...

    def load_action_evidence(
        self, receipt_id: str
    ) -> tuple[dict[str, Any], dict[str, Any]] | None: ...


def _document(snapshot: Any) -> dict[str, Any]:
    value = snapshot.to_dict() or {}
    return {**value, "_document_id": snapshot.id}


class FirestorePresentationStore:
    """Keeps Firestore layout private behind the semantic presentation service."""

    def __init__(self, project_id: str, *, transport: Literal["grpc", "rest"] = "grpc") -> None:
        self._client = firestore.Client(project=project_id)
        if transport == "rest":
            # The export path uses bounded REST reads so it exits cleanly in CLI environments
            # where the default Firestore streaming transport can leave a live gRPC worker.
            client = cast(Any, self._client)
            client._firestore_api_internal = FirestoreClient(
                credentials=client._credentials,
                transport="rest",
            )

    def list_objectives(self) -> tuple[dict[str, Any], ...]:
        return tuple(_document(item) for item in self._client.collection("objectives").stream())

    def list_incidents(self) -> tuple[dict[str, Any], ...]:
        return tuple(_document(item) for item in self._client.collection("incidents").stream())

    def load_incident(self, incident_id: str) -> dict[str, Any]:
        snapshot = self._client.collection("incidents").document(incident_id).get()
        if not snapshot.exists:
            raise KeyError(incident_id)
        return _document(snapshot)

    def load_plan_revision(self, incident_id: str, revision: int) -> dict[str, Any] | None:
        snapshot = (
            self._client.collection("incidents")
            .document(incident_id)
            .collection("plan_revisions")
            .document(f"{revision:04d}")
            .get()
        )
        return _document(snapshot) if snapshot.exists else None

    def list_workflow_events(self, incident_id: str) -> tuple[dict[str, Any], ...]:
        query = (
            self._client.collection("incidents").document(incident_id).collection("workflow_events")
        )
        return tuple(_document(item) for item in query.stream())

    def load_action_evidence(self, receipt_id: str) -> tuple[dict[str, Any], dict[str, Any]] | None:
        receipt_snapshot = self._client.collection("action_receipts").document(receipt_id).get()
        if not receipt_snapshot.exists:
            return None
        receipt = _document(receipt_snapshot)
        key = receipt.get("idempotency_key")
        if not isinstance(key, str):
            return {}, receipt
        claim_snapshot = self._client.collection("action_claims").document(key).get()
        claim = _document(claim_snapshot) if claim_snapshot.exists else {}
        return claim, receipt


class InMemoryPresentationStore:
    def __init__(self) -> None:
        self.objectives: dict[str, dict[str, Any]] = {}
        self.incidents: dict[str, dict[str, Any]] = {}
        self.revisions: dict[tuple[str, int], dict[str, Any]] = {}
        self.events: dict[str, list[dict[str, Any]]] = {}
        self.receipts: dict[str, dict[str, Any]] = {}
        self.claims: dict[str, dict[str, Any]] = {}

    def list_objectives(self) -> tuple[dict[str, Any], ...]:
        return tuple(deepcopy(value) for value in self.objectives.values())

    def list_incidents(self) -> tuple[dict[str, Any], ...]:
        return tuple(deepcopy(value) for value in self.incidents.values())

    def load_incident(self, incident_id: str) -> dict[str, Any]:
        if incident_id not in self.incidents:
            raise KeyError(incident_id)
        return deepcopy(self.incidents[incident_id])

    def load_plan_revision(self, incident_id: str, revision: int) -> dict[str, Any] | None:
        value = self.revisions.get((incident_id, revision))
        return deepcopy(value) if value is not None else None

    def list_workflow_events(self, incident_id: str) -> tuple[dict[str, Any], ...]:
        return tuple(deepcopy(value) for value in self.events.get(incident_id, []))

    def load_action_evidence(self, receipt_id: str) -> tuple[dict[str, Any], dict[str, Any]] | None:
        receipt = self.receipts.get(receipt_id)
        if receipt is None:
            return None
        key = receipt.get("idempotency_key")
        claim = self.claims.get(str(key), {})
        return deepcopy(claim), deepcopy(receipt)
