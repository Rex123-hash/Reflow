from __future__ import annotations

import json
import time
from copy import deepcopy
from dataclasses import replace
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from google.auth.exceptions import GoogleAuthError
from objective_recovery_agent import fast_api_app
from objective_recovery_agent.action_ledger import _intent_dict, _receipt_dict, pending_receipt
from objective_recovery_agent.calendar_contract import normalize_calendar_event, safe_observed_state
from objective_recovery_agent.calendar_gateway import CalendarAdapterError, CalendarErrorCategory
from objective_recovery_agent.external_reality import ExternalRealityService, _state, _timestamp
from objective_recovery_agent.external_reality_schemas import ExternalRealityView
from objective_recovery_agent.ui_store import InMemoryPresentationStore

from objective_recovery.domain.models import ReceiptStatus
from objective_recovery.web_bff.backend import BackendResponse
from objective_recovery.web_bff.demo import CANONICAL_INCIDENT_ID
from test_calendar_p1b import CALENDAR_ID, event_payload, intent
from test_p2d_web_bff import make_client, sign_in

NOW = datetime(2026, 8, 28, 11, tzinfo=UTC)
ROOT = Path(__file__).parents[1]


def store_with_receipt() -> InMemoryPresentationStore:
    action = intent()
    store = InMemoryPresentationStore()
    store.incidents[action.incident_id] = {
        "incident_id": action.incident_id,
        "revision": 16,
        "action_receipt_id": action.receipt_id,
        "github_verification": {"passed": False},
    }
    observed = normalize_calendar_event(calendar_id=CALENDAR_ID, payload=event_payload(action))
    receipt = replace(
        pending_receipt(action, NOW),
        status=ReceiptStatus.VERIFIED,
        write_acknowledged_at=NOW,
        read_back_at=NOW,
        observed_state=safe_observed_state(observed),
    )
    store.receipts[action.receipt_id] = _receipt_dict(receipt)
    store.claims[action.action.idempotency_key] = {"intent": _intent_dict(action)}
    return store


class ReadOnlyCalendar:
    def __init__(self, payload: dict[str, object] | None) -> None:
        self.payload = payload
        self.reads: list[tuple[str, str]] = []

    def get_event(self, calendar_id: str, event_id: str) -> dict[str, object] | None:
        self.reads.append((calendar_id, event_id))
        return deepcopy(self.payload)


@pytest.mark.asyncio
async def test_get_uses_real_reader_and_preserves_expected_observed_and_all_state() -> None:
    action = intent()
    store = store_with_receipt()
    before = deepcopy(vars(store))
    reader = ReadOnlyCalendar(event_payload(action))
    service = ExternalRealityService(
        store, allowed_calendar_id=CALENDAR_ID, reader_factory=lambda: reader, clock=lambda: NOW
    )
    result = await service.read(action.incident_id)
    resource = result.resources[0]
    assert reader.reads == [(CALENDAR_ID, action.event_id)]
    assert resource.expected.start == action.desired.start
    assert resource.latest_readback is not None
    assert resource.latest_readback.state == resource.expected
    assert resource.latest_readback.source_freshness == "FRESH_READ"
    assert resource.latest_readback.verification_status == "PASSED"
    assert resource.receipt_readback is not None
    assert resource.receipt_readback.source_freshness == "PERSISTED_READBACK"
    assert resource.receipt_status == "VERIFIED"
    assert store.incidents[action.incident_id]["github_verification"]["passed"] is False
    assert vars(store) == before
    assert not hasattr(reader, "insert_event")


@pytest.mark.asyncio
async def test_current_mismatch_does_not_rewrite_verified_history_or_expose_private_text() -> None:
    payload = event_payload(intent(), summary="private@example.com https://secret.meet/token")
    payload["attendees"] = [{"email": "private@example.com"}]
    payload["access_token"] = "secret-token"
    payload["status"] = "cancelled"
    reader = ReadOnlyCalendar(payload)
    result = await ExternalRealityService(
        store_with_receipt(), allowed_calendar_id=CALENDAR_ID, reader_factory=lambda: reader
    ).read(intent().incident_id)
    resource = result.resources[0]
    assert resource.receipt_status == "VERIFIED"
    assert resource.latest_readback is not None
    assert resource.latest_readback.verification_status == "FAILED"
    assert resource.latest_readback.state.status == "cancelled"
    for secret in (
        CALENDAR_ID,
        "private@example.com",
        "secret.meet",
        "secret-token",
        "attendees",
        "description",
        "private_extended_properties",
    ):
        assert secret not in result.model_dump_json()


@pytest.mark.asyncio
@pytest.mark.parametrize("failure", ["missing", "timeout", "permission", "auth", "malformed"])
async def test_fresh_failure_never_claims_current_verification(failure: str) -> None:
    class FailedReader:
        def get_event(self, calendar_id: str, event_id: str) -> dict[str, object] | None:
            if failure == "missing":
                return None
            if failure == "timeout":
                time.sleep(0.03)
                return None
            if failure == "auth":
                raise GoogleAuthError("private credential metadata")  # type: ignore[no-untyped-call]
            if failure == "malformed":
                raise ValueError("private response")
            raise CalendarAdapterError(CalendarErrorCategory.PERMISSION, retryable=False)

    result = await ExternalRealityService(
        store_with_receipt(),
        allowed_calendar_id=CALENDAR_ID,
        reader_factory=FailedReader,
        timeout_seconds=0.005 if failure == "timeout" else 2,
    ).read(intent().incident_id)
    resource = result.resources[0]
    assert resource.fresh_read_status == {"missing": "NOT_FOUND", "timeout": "TIMEOUT"}.get(
        failure, "UNAVAILABLE"
    )
    assert resource.latest_readback is not None
    assert resource.latest_readback.source_freshness == "PERSISTED_READBACK"
    assert "private" not in result.model_dump_json()


@pytest.mark.asyncio
async def test_missing_authority_unknown_incident_wrong_calendar_and_mismatched_join() -> None:
    store = store_with_receipt()
    reader = ReadOnlyCalendar(event_payload(intent()))
    service = ExternalRealityService(
        store, allowed_calendar_id="wrong", reader_factory=lambda: reader
    )
    assert (await service.read(intent().incident_id)).resources[
        0
    ].fresh_read_status == "UNAVAILABLE"
    assert not reader.reads
    with pytest.raises(KeyError):
        await service.read("arbitrary")
    store.receipts[intent().receipt_id]["external_event_id"] = "unrelated"
    assert not (await service.read(intent().incident_id)).resources
    store.claims.clear()
    assert not (await service.read(intent().incident_id)).resources
    store.receipts.clear()
    assert not (await service.read(intent().incident_id)).resources


def test_latest_persisted_closure_is_distinct_from_receipt() -> None:
    store = store_with_receipt()
    store.revisions[(intent().incident_id, 2)] = {
        "calendar_closure_evidence": {
            "source_reference": f"google_calendar:{intent().event_id}",
            "passed": True,
            "observed_at": "2026-08-28T12:00:00+00:00",
            "observed_state": store.receipts[intent().receipt_id]["observed_state"],
        }
    }
    resource = ExternalRealityService(store).persisted(intent().incident_id).view.resources[0]
    assert resource.latest_readback and resource.receipt_readback
    assert resource.latest_readback.observed_at != resource.receipt_readback.observed_at
    assert resource.latest_readback.source_freshness == "PERSISTED_READBACK"
    assert resource.fresh_read_status == "NOT_REQUESTED"
    assert _timestamp("2026-01-01") is None
    assert _state({"start": "garbage", "status": "secret"}).status is None


def test_canonical_export_exact_existing_receipt_join_and_timing() -> None:
    view = ExternalRealityView.model_validate_json(
        (ROOT / "docs/ui-fixtures/external-reality.json").read_text()
    )
    evidence = json.loads((ROOT / "docs/ui-fixtures/evidence.json").read_text())
    recovery = json.loads((ROOT / "docs/ui-fixtures/recovery-restored.json").read_text())
    resource = view.resources[0]
    assert sum(e["evidence_id"] == resource.evidence_id for e in evidence["evidence"]) == 1
    assert any(
        a["receipt_id"] == resource.receipt_id and a["evidence_id"] == resource.evidence_id
        for a in recovery["actions"]
    )
    assert resource.expected.start == "2026-08-28T13:00:00+00:00"
    assert (
        resource.latest_readback
        and resource.latest_readback.observed_at == "2026-08-27T19:08:54.311870+00:00"
    )
    assert (
        resource.receipt_readback
        and resource.receipt_readback.observed_at == "2026-08-27T19:07:45.772017+00:00"
    )


def test_private_get_endpoint_no_etag_no_mutation_and_404() -> None:
    store = store_with_receipt()
    before = deepcopy(vars(store))
    service = ExternalRealityService(store)
    fast_api_app.app.dependency_overrides[fast_api_app.get_external_reality_service] = lambda: (
        service
    )
    try:
        client = TestClient(fast_api_app.app)
        path = f"/api/v1/ui/recoveries/{intent().incident_id}/external-reality"
        response = client.get(path, headers={"If-None-Match": 'W/"16"'})
        assert response.status_code == 200
        assert response.headers["cache-control"] == "no-store"
        assert "etag" not in response.headers
        assert client.post(path).status_code == 405
        assert client.get("/api/v1/ui/recoveries/missing/external-reality").status_code == 404
        assert vars(store) == before
    finally:
        fast_api_app.app.dependency_overrides.clear()


@pytest.mark.parametrize("mode", ["guest", "google"])
def test_bff_auth_guest_never_calls_backend_live_validates_and_no_cache(mode: str) -> None:
    client, _, backend = make_client()
    path = f"/api/v1/ui/recoveries/{CANONICAL_INCIDENT_ID}/external-reality"
    assert client.get(path).status_code == 401
    sign_in(client, f"{mode}-id-token")
    body = (ROOT / "docs/ui-fixtures/external-reality.json").read_bytes()
    backend.override = BackendResponse(200, body, {"Cache-Control": "no-store"})
    response = client.get(path, headers={"If-None-Match": 'W/"16"'})
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert "etag" not in response.headers
    assert response.json()["resources"][0]["fresh_read_status"] == "NOT_REQUESTED"
    assert backend.calls == ([] if mode == "guest" else [(path, {}, None)])
    assert client.post(path).status_code == 405
    if mode == "guest":
        assert client.get("/api/v1/ui/recoveries/arbitrary/external-reality").status_code == 404
        assert not backend.calls
    else:
        invalid: dict[str, Any] = json.loads(body)
        invalid["resources"][0]["access_token"] = "not-allowed"
        backend.override = BackendResponse(200, json.dumps(invalid).encode(), {})
        assert client.get(path).status_code == 502


def test_old_contracts_are_structurally_unchanged() -> None:
    import subprocess

    previous = json.loads(subprocess.check_output(["git", "show", "24a4219:docs/ui-openapi.json"]))
    current = fast_api_app.app.openapi()
    for name, schema in previous["components"]["schemas"].items():
        assert current["components"]["schemas"][name] == schema
    for path, definition in previous["paths"].items():
        assert current["paths"][path] == definition
