"""Export sanitized UI fixtures and OpenAPI from authoritative presentation models."""

from __future__ import annotations

import argparse
import json
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any

from objective_recovery_agent.fast_api_app import app
from objective_recovery_agent.presentation import PresentationService
from objective_recovery_agent.ui_store import FirestorePresentationStore, PresentationStore


class HistoricalVerifyingStore:
    """Read-only view of the durable boundary immediately before P1D closure."""

    def __init__(
        self, base: PresentationStore, incident_id: str, *, expected_revision: int | None = None
    ) -> None:
        self._base = base
        self._incident_id = incident_id
        final = base.load_incident(incident_id)
        final_revision = int(final.get("revision", 0) or 0)
        self._revision = final_revision - 1
        if expected_revision is not None and expected_revision != self._revision:
            raise ValueError(
                f"active checkpoint revision mismatch: expected {expected_revision}, "
                f"derived {self._revision}"
            )
        events = base.list_workflow_events(incident_id)
        marker = next(
            (
                item.get("occurred_at")
                for item in events
                if item.get("event_type") == "OBJECTIVE_VERIFICATION_STARTED"
            ),
            None,
        )
        if marker is None:
            raise ValueError("active checkpoint lacks OBJECTIVE_VERIFICATION_STARTED authority")
        self._marker = marker

    @staticmethod
    def _sortable(value: object) -> str:
        if isinstance(value, datetime):
            return value.isoformat()
        return str(value or "")

    def checkpoint_time(self) -> datetime:
        if isinstance(self._marker, datetime):
            return self._marker
        return datetime.fromisoformat(str(self._marker).replace("Z", "+00:00"))

    def _active_incident(self) -> dict[str, Any]:
        value = deepcopy(self._base.load_incident(self._incident_id))
        for field in ("final_verification", "resolved_at", "active_candidate_sha"):
            value.pop(field, None)
        value.update(
            {
                "stage": "VERIFYING",
                "status": "verifying",
                "revision": self._revision,
                "updated_at": self._marker,
            }
        )
        return value

    def list_objectives(self) -> tuple[dict[str, Any], ...]:
        return self._base.list_objectives()

    def list_incidents(self) -> tuple[dict[str, Any], ...]:
        return tuple(
            self._active_incident() if item.get("incident_id") == self._incident_id else item
            for item in self._base.list_incidents()
        )

    def load_incident(self, incident_id: str) -> dict[str, Any]:
        if incident_id != self._incident_id:
            return self._base.load_incident(incident_id)
        return self._active_incident()

    def load_plan_revision(self, incident_id: str, revision: int) -> dict[str, Any] | None:
        value = self._base.load_plan_revision(incident_id, revision)
        if value is not None and incident_id == self._incident_id and revision == 2:
            value = deepcopy(value)
            value.pop("closure_result", None)
        return value

    def list_workflow_events(self, incident_id: str) -> tuple[dict[str, Any], ...]:
        values = self._base.list_workflow_events(incident_id)
        if incident_id != self._incident_id:
            return values
        marker = self._sortable(self._marker)
        return tuple(
            item
            for item in values
            if item.get("event_type") != "OBJECTIVE_RESTORED"
            and self._sortable(item.get("occurred_at")) <= marker
        )

    def load_action_evidence(self, receipt_id: str) -> tuple[dict[str, Any], dict[str, Any]] | None:
        return self._base.load_action_evidence(receipt_id)


def write_json(path: Path, value: Any) -> None:
    path.write_text(
        json.dumps(value, indent=2, sort_keys=True, default=str) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", required=True)
    parser.add_argument("--incident", required=True)
    parser.add_argument("--active-revision", type=int)
    parser.add_argument("--output", type=Path, default=Path("docs/ui-fixtures"))
    args = parser.parse_args()
    store = FirestorePresentationStore(args.project, transport="rest")
    service = PresentationService(store)
    active_store = HistoricalVerifyingStore(
        store,
        args.incident,
        expected_revision=args.active_revision,
    )
    active_service = PresentationService(
        active_store,
        clock=active_store.checkpoint_time,
    )
    args.output.mkdir(parents=True, exist_ok=True)
    views = {
        "overview.json": service.overview(),
        "objectives.json": service.objectives(),
        "recovery-restored.json": service.recovery_case(args.incident),
        "recovery-active.json": active_service.recovery_case(args.incident),
        "evidence.json": service.evidence_page(args.incident),
        "events.json": service.events(args.incident),
        "operator-context.json": service.operator_context(args.incident),
    }
    for name, value in views.items():
        write_json(args.output / name, value.model_dump(mode="json"))
    write_json(Path("docs/ui-openapi.json"), app.openapi())


if __name__ == "__main__":
    main()
