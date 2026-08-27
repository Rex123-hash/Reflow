"""Export sanitized UI fixtures and OpenAPI from authoritative presentation models."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from objective_recovery_agent.fast_api_app import app
from objective_recovery_agent.presentation import PresentationService
from objective_recovery_agent.ui_store import FirestorePresentationStore


def write_json(path: Path, value: Any) -> None:
    path.write_text(
        json.dumps(value, indent=2, sort_keys=True, default=str) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", required=True)
    parser.add_argument("--incident", required=True)
    parser.add_argument("--output", type=Path, default=Path("docs/ui-fixtures"))
    args = parser.parse_args()
    service = PresentationService(FirestorePresentationStore(args.project))
    args.output.mkdir(parents=True, exist_ok=True)
    views = {
        "overview.json": service.overview(),
        "objectives.json": service.objectives(),
        "recovery-restored.json": service.recovery_case(args.incident),
        "evidence.json": service.evidence_page(args.incident),
        "events.json": service.events(args.incident),
        "operator-context.json": service.operator_context(args.incident),
    }
    for name, value in views.items():
        write_json(args.output / name, value.model_dump(mode="json"))
    write_json(Path("docs/ui-openapi.json"), app.openapi())


if __name__ == "__main__":
    main()
