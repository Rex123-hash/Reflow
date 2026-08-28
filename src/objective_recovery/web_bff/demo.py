"""Bounded, sanitized, read-only guest representation of the canonical story."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from objective_recovery_agent.ui_schemas import (
    EvidencePageView,
    ExecutionEventsView,
    ObjectiveFilter,
    ObjectivesView,
    OperatorContextView,
    OverviewView,
    PresentationModel,
    RecoveryCaseView,
)

CANONICAL_INCIDENT_ID = "incident-0fc3af5b0bd1ad847aea"


class DemoResourceNotFoundError(KeyError):
    pass


class DemoStore:
    """Loads only the reviewed P2B presentation exports shipped in the BFF image."""

    def __init__(self, root: Path) -> None:
        self.overview = OverviewView.model_validate_json(self._read(root / "overview.json"))
        self.objectives = ObjectivesView.model_validate_json(self._read(root / "objectives.json"))
        self.recovery = RecoveryCaseView.model_validate_json(
            self._read(root / "recovery-restored.json")
        )
        self.evidence = EvidencePageView.model_validate_json(self._read(root / "evidence.json"))
        self.events = ExecutionEventsView.model_validate_json(self._read(root / "events.json"))
        self.operator = OperatorContextView.model_validate_json(
            self._read(root / "operator-context.json")
        )
        if {
            self.evidence.incident_id,
            self.events.incident_id,
        } != {CANONICAL_INCIDENT_ID}:
            raise RuntimeError("Guest demo exports do not describe the canonical incident.")

    @staticmethod
    def _read(path: Path) -> str:
        return path.read_text(encoding="utf-8")

    @staticmethod
    def _payload(value: Any) -> bytes:
        return json.dumps(
            value.model_dump(mode="json"), separators=(",", ":"), ensure_ascii=False
        ).encode("utf-8")

    def get(
        self,
        resource: str,
        *,
        incident_id: str | None = None,
        selected_filter: ObjectiveFilter = ObjectiveFilter.ALL,
        after: int = 0,
        limit: int = 100,
    ) -> tuple[int, bytes]:
        if incident_id is not None and incident_id != CANONICAL_INCIDENT_ID:
            raise DemoResourceNotFoundError(incident_id)
        value: PresentationModel
        if resource == "overview":
            value = self.overview
        elif resource == "objectives":
            items = self.objectives.items
            if selected_filter is ObjectiveFilter.RESTORED:
                items = [item for item in items if item.health.value == "RESTORED"]
            elif selected_filter is ObjectiveFilter.ACTIVE:
                items = [item for item in items if item.health.value != "RESTORED"]
            value = self.objectives.model_copy(update={"filter": selected_filter, "items": items})
        elif resource == "recovery":
            value = self.recovery
        elif resource == "evidence":
            value = self.evidence
        elif resource == "events":
            if after < 0 or limit < 1 or limit > 200:
                raise ValueError("Cursor or limit is invalid.")
            page = self.events.events[after : after + limit]
            next_cursor = after + len(page)
            value = self.events.model_copy(
                update={
                    "events": page,
                    "next_cursor": str(next_cursor),
                    "terminal": self.events.terminal and next_cursor >= len(self.events.events),
                }
            )
        elif resource == "operator":
            value = self.operator
        else:
            raise DemoResourceNotFoundError(resource)
        return value.revision, self._payload(value)
