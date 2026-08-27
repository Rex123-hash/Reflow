"""Durable product-owner objective authority and immutable recovery artifacts."""

from __future__ import annotations

from copy import deepcopy
from datetime import UTC, datetime
from typing import Any, Protocol, cast

from google.cloud import firestore

from objective_recovery_agent.schemas import ObjectiveRecord, RecoveryArtifact

CANONICAL_OBJECTIVE = ObjectiveRecord(
    objective_id="release-v2",
    label="SHIP RELEASE V2",
    deadline_local="2026-08-28 17:00:00",
    deadline_timezone="Etc/UTC",
    deadline_at_utc="2026-08-28T17:00:00Z",
    objective_version=1,
    protected_commitment=True,
)

CANDIDATE_B_ARTIFACT = RecoveryArtifact(
    artifact_id="release-v2-candidate-b",
    artifact_type="github_commit",
    repository="Rex123-hash/EXperiments",
    candidate_sha="7b7881ed1785cc37e038c44193ff2373badf54e7",
    parent_sha="5353cf7c664f384d6642b5348c7f190187b06b4c",
    state="AVAILABLE",
    production_diff=(
        '-    return payload.get("accountId")\n'
        '+    return payload.get("accountId") or payload.get("customerId")'
    ),
    unchanged_proof={
        "tests/test_release_compatibility.py": "58f295e1bf4b4fa7eb8c10e894d1ce0be3e0408c",
        "release/compatibility.json": "e0404b6821167471f074c127847dbfad095fa497",
        ".github/workflows/release-validation.yml": ("1a4b72799ca92038ee4b1a626a047c4bd175eb1c"),
    },
)


class ObjectiveStore(Protocol):
    def ensure_objective(self, objective: ObjectiveRecord) -> ObjectiveRecord: ...
    def load_objective(self, objective_id: str) -> ObjectiveRecord: ...
    def ensure_artifact(self, artifact: RecoveryArtifact) -> RecoveryArtifact: ...
    def list_available_artifacts(self, objective_id: str) -> tuple[RecoveryArtifact, ...]: ...


def _without_timestamps(data: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in data.items() if key not in {"created_at", "updated_at"}}


class FirestoreObjectiveStore:
    def __init__(self, project_id: str) -> None:
        self._client = firestore.Client(project=project_id)

    def ensure_objective(self, objective: ObjectiveRecord) -> ObjectiveRecord:
        ref = self._client.collection("objectives").document(objective.objective_id)
        transaction = self._client.transaction()
        expected = objective.model_dump(mode="json")

        @firestore.transactional
        def ensure(transaction: Any) -> ObjectiveRecord:
            snapshot = ref.get(transaction=transaction)
            if snapshot.exists:
                existing = _without_timestamps(snapshot.to_dict() or {})
                if existing != expected:
                    raise ValueError("persisted objective conflicts with product-owner authority")
                return ObjectiveRecord.model_validate(existing)
            transaction.create(ref, {**expected, "created_at": datetime.now(UTC)})
            return objective

        return cast(ObjectiveRecord, ensure(transaction))

    def load_objective(self, objective_id: str) -> ObjectiveRecord:
        snapshot = self._client.collection("objectives").document(objective_id).get()
        if not snapshot.exists:
            raise KeyError(objective_id)
        return ObjectiveRecord.model_validate(snapshot.to_dict() or {})

    def ensure_artifact(self, artifact: RecoveryArtifact) -> RecoveryArtifact:
        ref = self._client.collection("recovery_artifacts").document(artifact.artifact_id)
        transaction = self._client.transaction()
        expected = {**artifact.model_dump(mode="json"), "objective_id": "release-v2"}

        @firestore.transactional
        def ensure(transaction: Any) -> RecoveryArtifact:
            snapshot = ref.get(transaction=transaction)
            if snapshot.exists:
                existing = _without_timestamps(snapshot.to_dict() or {})
                if existing != expected:
                    raise ValueError("persisted recovery artifact conflicts with immutable proof")
                return RecoveryArtifact.model_validate(existing)
            transaction.create(ref, {**expected, "created_at": datetime.now(UTC)})
            return artifact

        return cast(RecoveryArtifact, ensure(transaction))

    def list_available_artifacts(self, objective_id: str) -> tuple[RecoveryArtifact, ...]:
        query = (
            self._client.collection("recovery_artifacts")
            .where("objective_id", "==", objective_id)
            .where("state", "==", "AVAILABLE")
        )
        return tuple(
            RecoveryArtifact.model_validate(snapshot.to_dict() or {}) for snapshot in query.stream()
        )


class InMemoryObjectiveStore:
    def __init__(self) -> None:
        self.objectives: dict[str, dict[str, Any]] = {}
        self.artifacts: dict[str, dict[str, Any]] = {}

    def ensure_objective(self, objective: ObjectiveRecord) -> ObjectiveRecord:
        expected = objective.model_dump(mode="json")
        existing = self.objectives.get(objective.objective_id)
        if existing is not None and existing != expected:
            raise ValueError("persisted objective conflicts with product-owner authority")
        self.objectives.setdefault(objective.objective_id, deepcopy(expected))
        return ObjectiveRecord.model_validate(self.objectives[objective.objective_id])

    def load_objective(self, objective_id: str) -> ObjectiveRecord:
        return ObjectiveRecord.model_validate(deepcopy(self.objectives[objective_id]))

    def ensure_artifact(self, artifact: RecoveryArtifact) -> RecoveryArtifact:
        expected = artifact.model_dump(mode="json")
        existing = self.artifacts.get(artifact.artifact_id)
        if existing is not None and existing != expected:
            raise ValueError("persisted recovery artifact conflicts with immutable proof")
        self.artifacts.setdefault(artifact.artifact_id, deepcopy(expected))
        return RecoveryArtifact.model_validate(self.artifacts[artifact.artifact_id])

    def list_available_artifacts(self, objective_id: str) -> tuple[RecoveryArtifact, ...]:
        del objective_id
        return tuple(
            RecoveryArtifact.model_validate(deepcopy(value))
            for value in self.artifacts.values()
            if value.get("state") == "AVAILABLE"
        )
