"""Export only P2E-A persisted presentation and additive OpenAPI; never execute actions."""

from pathlib import Path

from objective_recovery_agent.external_reality import ExternalRealityService
from objective_recovery_agent.fast_api_app import app
from objective_recovery_agent.ui_store import FirestorePresentationStore
from scripts.export_ui_contract import write_json

if __name__ == "__main__":
    store = FirestorePresentationStore("project-f334c42b-7a03-4194-932", transport="rest")
    view = ExternalRealityService(store).persisted("incident-0fc3af5b0bd1ad847aea").view
    if not view.resources:
        raise RuntimeError("No authoritative Calendar proof to export")
    write_json(Path("docs/ui-fixtures/external-reality.json"), view.model_dump(mode="json"))
    write_json(Path("docs/ui-openapi.json"), app.openapi())
