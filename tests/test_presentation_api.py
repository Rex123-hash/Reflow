from __future__ import annotations

import inspect
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from objective_recovery_agent import fast_api_app
from objective_recovery_agent.presentation import (
    PresentationService,
    objective_health,
    workflow_stage,
)
from objective_recovery_agent.ui_schemas import (
    EventPhase,
    EvidencePageView,
    ExecutionEventsView,
    ObjectiveFilter,
    ObjectiveHealth,
    ObjectivesView,
    OperatorContextView,
    OverviewView,
    PlanActionDisposition,
    RecoveryCaseView,
    SemanticStatus,
    SourceAuthority,
    VerificationStatus,
    WorkflowStage,
)
from objective_recovery_agent.ui_store import InMemoryPresentationStore
from pydantic import ValidationError

INCIDENT = "incident-p2a-real-like"
A = "5353cf7c664f384d6642b5348c7f190187b06b4c"
B = "7b7881ed1785cc37e038c44193ff2373badf54e7"


def action(action_type: str, sha: str, action_id: str) -> dict[str, Any]:
    return {
        "action_id": action_id,
        "action_type": action_type,
        "target": "Rex123-hash/EXperiments",
        "parameters": [
            {"key": "candidate_sha", "value": sha},
            {"key": "workflow_id", "value": "343576501"},
            {"key": "workflow_path", "value": ".github/workflows/release-validation.yml"},
        ],
    }


def candidate(plan_id: str, sha: str, risk: int) -> dict[str, Any]:
    return {
        "plan_id": plan_id,
        "strategy_type": "risk-minimization-first",
        "initial_risk_score": risk,
        "actions": [
            action("github_release_validation", sha, f"action-{plan_id}"),
            {
                "action_id": f"assign-{plan_id}",
                "action_type": "reassign_task",
                "target": "work-api-migration",
                "parameters": [],
            },
        ],
        "assumptions": [{"description": "Immutable artifact remains available."}],
        "unknowns": [],
    }


def add_receipt(
    store: InMemoryPresentationStore,
    receipt_id: str,
    *,
    action_id: str,
    tool: str,
    external_reference: str,
) -> None:
    key = f"key-{receipt_id}"
    store.receipts[receipt_id] = {
        "receipt_id": receipt_id,
        "idempotency_key": key,
        "status": "verified",
        "tool": tool,
        "action_id": action_id,
        "write_acknowledged_at": "2026-08-27T13:01:00+00:00",
        "read_back_at": "2026-08-27T13:02:00+00:00",
        "observed_at": "2026-08-27T13:02:00+00:00",
        "external_reference": external_reference,
        "observed_state": {"event_id": "calendar-event", "status": "confirmed"},
    }
    store.claims[key] = {
        "intent": {"action": {"action_id": action_id}},
    }


def restored_store() -> InMemoryPresentationStore:
    store = InMemoryPresentationStore()
    store.objectives["release-v2"] = {
        "objective_id": "release-v2",
        "objective_version": 1,
        "label": "SHIP RELEASE V2",
        "deadline_at_utc": "2026-08-28T17:00:00+00:00",
        "deadline_timezone": "Etc/UTC",
        "created_at": "2026-08-27T11:20:40+00:00",
    }
    failed_verification = {
        "objective_id": "release-v2",
        "passed": False,
        "observed_at": "2026-08-27T13:01:19+00:00",
        "checks": [
            {
                "invariant_id": "release-validation-green",
                "passed": False,
                "reason": "external state violates the invariant",
                "source_reference": "https://github.test/runs/101",
            }
        ],
    }
    final_verification = {
        "objective_id": "release-v2",
        "passed": True,
        "observed_at": "2026-08-27T13:02:27+00:00",
        "checks": [
            {
                "invariant_id": invariant,
                "passed": True,
                "reason": "fresh external evidence satisfies the invariant",
                "source_reference": f"proof:{invariant}",
            }
            for invariant in (
                "coordination-action-preserved",
                "active-release-candidate-revised",
                "release-validation-green",
                "shipped-full-release",
                "external-correlation-fresh",
                "protected-release-deadline-satisfied",
            )
        ],
    }
    store.incidents[INCIDENT] = {
        "incident_id": INCIDENT,
        "impact": {
            "objective_id": "release-v2",
            "affected_node_ids": ["release-v2", "work-api-migration"],
        },
        "disruption": {
            "event_type": "personnel_unavailability",
            "occurred_at": "2026-08-27T12:59:48+00:00",
            "source": "gmail",
            "summary": "Backend lead became unavailable during release delivery.",
            "disrupted_node_ids": ["person-backend-lead"],
            "evidence_references": [
                "gmail-message:gmail-message-canonical",
                "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            ],
        },
        "stage": "RESOLVED",
        "status": "objective_restored",
        "revision": 17,
        "objective_version": 1,
        "active_plan_revision": 2,
        "replan_count": 1,
        "updated_at": "2026-08-27T13:02:27+00:00",
        "resolved_at": "2026-08-27T13:02:27+00:00",
        "selected_plan_id": "plan-r1",
        "planning_run": {
            "candidates": {"plans": [candidate("plan-r1", A, 2)]},
            "critiques": {
                "critiques": [
                    {
                        "plan_id": "plan-r1",
                        "adjusted_risk_score": 6,
                        "verdict_summary": "Candidate A retains compatibility risk.",
                    }
                ]
            },
        },
        "policy_decisions": [{"plan_id": "plan-r1", "is_valid": True, "violations": []}],
        "action_receipt_id": "receipt-calendar",
        "github_action_receipt_id": "receipt-a",
        "github_evidence": {
            "head_sha": A,
            "release_id": 201,
            "run_id": 101,
            "run_attempt": 1,
            "workflow_id": 343576501,
            "workflow_path": ".github/workflows/release-validation.yml",
            "conclusion": "failure",
            "run_url": "https://github.test/runs/101",
            "read_back_at": "2026-08-27T13:01:19+00:00",
            "jobs": [{"failing_steps": ["Validate release compatibility"]}],
        },
        "github_verification": failed_verification,
        "final_verification": final_verification,
    }
    b_plan = candidate("plan-r2-b", B, 3)
    a_repeat = candidate("plan-r2-a-repeat", A, 1)
    store.revisions[(INCIDENT, 2)] = {
        "replanning_input": {
            "fingerprint": "b" * 64,
            "context": {
                "objective": {"objective_id": "release-v2"},
                "objective_invariants": [
                    "coordination-action-preserved",
                    "active-release-candidate-revised",
                    "release-validation-green",
                    "shipped-full-release",
                    "external-correlation-fresh",
                    "protected-release-deadline-satisfied",
                ],
                "failed_invariant_id": "release-validation-green",
                "failed_candidate_sha": A,
                "failed_recovery_effects": [{"fingerprint": "c" * 64}],
                "objective_graph": {
                    "nodes": [
                        {"node_id": "release-v2", "label": "Ship Release V2", "kind": "objective"},
                        {
                            "node_id": "work-api-migration",
                            "label": "Complete API migration",
                            "kind": "work_item",
                        },
                        {
                            "node_id": "person-backend-lead",
                            "label": "Lead backend engineer",
                            "kind": "person",
                        },
                    ],
                    "edges": [
                        {
                            "source_id": "release-v2",
                            "target_id": "work-api-migration",
                            "relation": "depends_on",
                        }
                    ],
                },
            },
        },
        "planner_checkpoint": {"candidates": {"plans": [a_repeat, b_plan]}},
        "critic_checkpoint": {
            "critiques": {
                "critiques": [
                    {
                        "plan_id": "plan-r2-a-repeat",
                        "adjusted_risk_score": 1,
                        "verdict_summary": "The plan repeats the failed artifact.",
                    },
                    {
                        "plan_id": "plan-r2-b",
                        "adjusted_risk_score": 3,
                        "verdict_summary": "Candidate B restores compatibility.",
                    },
                ]
            }
        },
        "selection": {
            "result": "PLAN_SELECTED",
            "policy_version": "p1d-executable-v2",
            "selected_plan": {**b_plan, "risk_score": "3"},
            "policy_decisions": [
                {
                    "plan_id": "plan-r2-a-repeat",
                    "is_valid": False,
                    "blocking_unknowns": [],
                    "violations": [
                        {
                            "rule_id": "failed_recovery_exact_repeat",
                            "message": "Exact failed objective effect is not retryable.",
                        }
                    ],
                },
                {
                    "plan_id": "plan-r2-b",
                    "is_valid": True,
                    "blocking_unknowns": [],
                    "violations": [],
                },
            ],
        },
        "execution_started": {"tag": "reflow-p1d-b"},
        "validation_evidence": {
            "receipt_id": "receipt-b",
            "evidence": {
                "head_sha": B,
                "release_id": 202,
                "run_id": 102,
                "run_attempt": 1,
                "workflow_id": 343576501,
                "workflow_path": ".github/workflows/release-validation.yml",
                "conclusion": "success",
                "run_url": "https://github.test/runs/102",
                "read_back_at": "2026-08-27T13:02:23+00:00",
            },
        },
        "promotion_evidence": {
            "receipt_id": "receipt-promotion",
            "evidence": {
                "release_id": 202,
                "latest_release_id": 202,
                "draft": False,
                "prerelease": False,
                "tag_sha": B,
                "release_url": "https://github.test/releases/202",
                "read_back_at": "2026-08-27T13:02:25+00:00",
            },
        },
        "calendar_closure_evidence": {"passed": True},
    }
    event_types = [
        ("OBJECTIVE_RESTORED", "2026-08-27T13:02:27+00:00"),
        ("EVENT_RECEIVED", "2026-08-27T12:59:49+00:00"),
        ("IMPACT_MAPPED", "2026-08-27T12:59:50+00:00"),
        ("PLAN_SELECTED", "2026-08-27T13:00:37+00:00"),
        ("GITHUB_RELEASE_ACKNOWLEDGED", "2026-08-27T13:01:05+00:00"),
        ("OBJECTIVE_VERIFICATION_FAILED", "2026-08-27T13:01:21+00:00"),
        ("REPLAN_STARTED", "2026-08-27T13:01:25+00:00"),
        ("RECOVERY_SELECTED", "2026-08-27T13:01:53+00:00"),
        ("OBJECTIVE_VERIFICATION_STARTED", "2026-08-27T13:02:26+00:00"),
    ]
    store.events[INCIDENT] = [
        {
            "_document_id": f"event-{index}",
            "event_type": event_type,
            "key": f"key-{index}",
            "details": {},
            "occurred_at": occurred_at,
        }
        for index, (event_type, occurred_at) in enumerate(event_types)
    ]
    add_receipt(
        store,
        "receipt-calendar",
        action_id="calendar-action",
        tool="google_calendar",
        external_reference="google_calendar:calendar-event",
    )
    add_receipt(
        store,
        "receipt-a",
        action_id="validate-a",
        tool="github",
        external_reference="https://github.test/runs/101",
    )
    add_receipt(
        store,
        "receipt-b",
        action_id="validate-b",
        tool="github",
        external_reference="https://github.test/runs/102",
    )
    add_receipt(
        store,
        "receipt-promotion",
        action_id="promote-b",
        tool="github",
        external_reference="https://github.test/releases/202",
    )
    return store


def service(store: InMemoryPresentationStore | None = None) -> PresentationService:
    return PresentationService(
        store or restored_store(),
        clock=lambda: datetime(2026, 8, 27, 13, tzinfo=UTC),
    )


def active_verifying_store() -> InMemoryPresentationStore:
    store = restored_store()
    incident = store.incidents[INCIDENT]
    incident.update(
        {
            "stage": "VERIFYING",
            "status": "verifying",
            "revision": 16,
            "updated_at": "2026-08-27T13:02:26+00:00",
        }
    )
    for field in ("final_verification", "resolved_at", "active_candidate_sha"):
        incident.pop(field, None)
    store.revisions[(INCIDENT, 2)].pop("closure_result", None)
    store.events[INCIDENT] = [
        event for event in store.events[INCIDENT] if event["event_type"] != "OBJECTIVE_RESTORED"
    ]
    return store


@pytest.mark.parametrize(
    ("stage", "status", "expected"),
    [
        ("RESOLVED", "objective_restored", ObjectiveHealth.RESTORED),
        ("EXECUTING", "executing", ObjectiveHealth.RECOVERING),
        ("REPLANNING", "replanning", ObjectiveHealth.RECOVERING),
        ("VERIFICATION_FAILED", "recovery_incomplete", ObjectiveHealth.NEEDS_ATTENTION),
        (None, None, ObjectiveHealth.WATCHING),
    ],
)
def test_objective_health_mapping(
    stage: str | None, status: str | None, expected: ObjectiveHealth
) -> None:
    assert objective_health(stage, status) is expected


@pytest.mark.parametrize(
    ("stage", "expected"),
    [
        ("EVENT_RECEIVED", WorkflowStage.DETECT),
        ("IMPACT_MAPPED", WorkflowStage.IMPACT),
        ("PLAN_SELECTED", WorkflowStage.PLAN),
        ("EXECUTING", WorkflowStage.ACT),
        ("VERIFYING", WorkflowStage.VERIFY),
        ("REPLANNING", WorkflowStage.REPLAN),
        ("RESOLVED", WorkflowStage.RESTORED),
    ],
)
def test_workflow_stage_mapping(stage: str, expected: WorkflowStage) -> None:
    assert workflow_stage(stage) is expected


def test_overview_and_objectives_use_semantic_truth_without_vanity_fields() -> None:
    overview = service().overview()
    assert overview.current_priority is not None
    assert overview.current_priority.objective_health is ObjectiveHealth.RESTORED
    assert overview.current_priority.active_recovery_number == 2
    assert overview.objective_summary.restored == 1
    assert overview.active_objectives == []
    payload = overview.model_dump(mode="json")
    assert "progress" not in str(payload).lower()
    assert "required_work_assigned" not in str(payload)

    values = service().objectives(ObjectiveFilter.RESTORED)
    assert [item.objective_id for item in values.items] == ["release-v2"]
    assert service().objectives(ObjectiveFilter.ACTIVE).items == []


def test_overview_uses_latest_objective_without_erasing_history() -> None:
    store = restored_store()
    store.objectives["release-qualification-new"] = {
        "objective_id": "release-qualification-new",
        "objective_version": 1,
        "label": "SHIP VERIFIED RELEASE",
        "deadline_at_utc": "2026-08-31T17:50:50+00:00",
        "deadline_timezone": "Etc/UTC",
        "created_at": "2026-08-31T09:50:50+00:00",
    }
    store.incidents["incident-new"] = {
        "incident_id": "incident-new",
        "objective_id": "release-qualification-new",
        "objective_version": 1,
        "stage": "RESOLVED",
        "status": "objective_restored",
        "revision": 16,
        "updated_at": "2026-08-31T09:53:05+00:00",
    }

    presentation = service(store)
    overview = presentation.overview()

    assert overview.current_priority is not None
    assert overview.current_priority.objective_id == "release-qualification-new"
    assert overview.current_priority.objective_health is ObjectiveHealth.RESTORED
    assert {item.objective_id for item in presentation.objectives().items} == {
        "release-v2",
        "release-qualification-new",
    }


def test_overview_uses_objective_creation_time_not_historical_reconciliation_time() -> None:
    store = restored_store()
    store.objectives["release-qualification-new"] = {
        "objective_id": "release-qualification-new",
        "objective_version": 1,
        "label": "SHIP VERIFIED RELEASE",
        "deadline_at_utc": "2026-08-31T17:50:50+00:00",
        "deadline_timezone": "Etc/UTC",
        "created_at": "2026-08-31T09:50:50+00:00",
    }
    store.incidents[INCIDENT].update(
        {
            "stage": "VERIFICATION_FAILED",
            "status": "action_receipt_verification_failed",
            "updated_at": "2026-08-31T12:00:00+00:00",
        }
    )
    store.incidents["incident-new"] = {
        "incident_id": "incident-new",
        "objective_id": "release-qualification-new",
        "objective_version": 1,
        "stage": "RESOLVED",
        "status": "objective_restored",
        "revision": 16,
        "updated_at": "2026-08-31T09:53:05+00:00",
    }

    presentation = service(store)
    overview = presentation.overview()
    items = {item.objective_id: item for item in presentation.objectives().items}

    assert overview.current_priority is not None
    assert overview.current_priority.objective_id == "release-qualification-new"
    assert overview.current_priority.objective_health is ObjectiveHealth.RESTORED
    assert items["release-v2"].health is ObjectiveHealth.NEEDS_ATTENTION
    assert items["release-qualification-new"].health is ObjectiveHealth.RESTORED


def test_calendar_readback_failure_is_completed_failure_in_recovery_history() -> None:
    store = restored_store()
    incident = store.incidents[INCIDENT]
    incident.update(
        {
            "stage": "VERIFICATION_FAILED",
            "status": "action_receipt_verification_failed",
            "action_receipt_status": "verification_failed",
            "revision": 10,
        }
    )
    for field in (
        "github_verification",
        "github_evidence",
        "github_action_receipt_id",
        "final_verification",
        "resolved_at",
    ):
        incident.pop(field, None)
    store.revisions.pop((INCIDENT, 2))
    store.events[INCIDENT] = [
        event for event in store.events[INCIDENT] if event["event_type"] != "OBJECTIVE_RESTORED"
    ]
    store.events[INCIDENT].append(
        {
            "_document_id": "event-calendar-verification-failed",
            "event_type": "ACTION_RECEIPT_VERIFICATION_FAILED",
            "key": "receipt-calendar",
            "details": {"receipt_id": "receipt-calendar", "status": "verification_failed"},
            "occurred_at": "2026-08-31T09:06:43+00:00",
        }
    )

    presentation = service(store)
    case = presentation.recovery_case(INCIDENT)
    verify = next(
        stage for stage in case.attempts[0].stages if stage.semantic_kind is WorkflowStage.VERIFY
    )

    assert case.attempts[0].status is SemanticStatus.FAILED
    assert verify.title == "Verification failed"
    assert verify.status is SemanticStatus.FAILED
    assert verify.timestamp == "2026-08-31T09:06:43+00:00"
    assert any(
        event.semantic_type == "ACTION_RECEIPT_VERIFICATION_FAILED"
        for event in presentation.events(INCIDENT).events
    )


def test_recovery_spine_keeps_failed_attempt_and_recovery_branch_distinct() -> None:
    case = service().recovery_case(INCIDENT)
    assert [attempt.attempt_number for attempt in case.attempts] == [1, 2]
    assert case.attempts[0].status is SemanticStatus.FAILED
    assert case.attempts[1].status is SemanticStatus.COMPLETED
    assert case.attempts[1].branch_from_attempt == 1
    assert "release-validation-green" in (case.attempts[1].branch_reason or "")
    assert case.objective.is_live is False


def test_active_recovery_marks_current_stage_without_claiming_restoration() -> None:
    store = restored_store()
    store.incidents[INCIDENT].update({"stage": "EXECUTING", "status": "executing", "revision": 15})
    store.incidents[INCIDENT].pop("final_verification")
    case = service(store).recovery_case(INCIDENT)
    assert case.objective.health is ObjectiveHealth.RECOVERING
    assert case.objective.is_live is True
    second = case.attempts[1]
    assert (
        next(stage.status for stage in second.stages if stage.semantic_kind is WorkflowStage.ACT)
        is SemanticStatus.CURRENT
    )
    assert case.verifications[-1].status is VerificationStatus.PENDING


def test_plans_expose_selection_and_deterministic_rejection_without_private_reasoning() -> None:
    plans = service().recovery_case(INCIDENT).plans
    selected = next(item for item in plans if item.revision == 2 and item.selected)
    rejected = next(item for item in plans if item.plan_id == "plan-r2-a-repeat")
    assert selected.plan_id == "plan-r2-b"
    assert selected.candidate_sha == B
    assert rejected.valid is False
    assert "Exact failed objective effect" in (rejected.deterministic_rejection_reason or "")
    serialized = str([item.model_dump(mode="json") for item in plans]).lower()
    assert "chain_of_thought" not in serialized
    assert "thought_signature" not in serialized


def test_receipt_verified_is_distinct_from_unhealthy_objective_outcome() -> None:
    actions = service().recovery_case(INCIDENT).actions
    candidate_a = next(item for item in actions if item.action_id == "validate-a")
    candidate_b = next(item for item in actions if item.action_id == "validate-b")
    assert candidate_a.receipt_status.value == "VERIFIED"
    assert candidate_a.verification_state is VerificationStatus.FAILED
    assert candidate_b.receipt_status.value == "VERIFIED"
    assert candidate_b.verification_state is VerificationStatus.PASSED
    assert candidate_b.write_acknowledged and candidate_b.read_back_completed


def test_verification_exposes_expected_vs_observed() -> None:
    verifications = service().recovery_case(INCIDENT).verifications
    failed = verifications[0].invariants[0]
    restored = verifications[1].invariants
    assert (failed.expected, failed.observed, failed.status) == (
        "true",
        "false",
        VerificationStatus.FAILED,
    )
    assert len(restored) == 6
    assert all(item.expected == "true" and item.observed == "true" for item in restored)


def test_unavailable_evidence_is_not_reported_as_verified_unhealthy() -> None:
    store = restored_store()
    store.incidents[INCIDENT].pop("github_verification")
    store.incidents[INCIDENT].pop("final_verification")
    store.incidents[INCIDENT]["external_evidence_unavailable"] = True
    values = service(store).recovery_case(INCIDENT).verifications
    assert [item.status for item in values] == [
        VerificationStatus.UNAVAILABLE,
        VerificationStatus.UNAVAILABLE,
    ]


def test_timeline_is_chronological_and_cursor_is_incremental() -> None:
    presentation = service()
    timeline = presentation.evidence_page(INCIDENT).timeline
    assert [item.timestamp for item in timeline] == sorted(item.timestamp for item in timeline)
    first = presentation.events(INCIDENT, after=0, limit=2)
    second = presentation.events(INCIDENT, after=int(first.next_cursor), limit=2)
    assert first.next_cursor == "2"
    assert first.events[-1].sequence < second.events[0].sequence
    assert first.terminal is True


def test_terminal_representation_is_stable_and_omits_assignment_claim() -> None:
    presentation = service()
    first = presentation.recovery_case(INCIDENT).model_dump(mode="json")
    second = presentation.recovery_case(INCIDENT).model_dump(mode="json")
    assert first == second
    assert "required_work_assigned" not in str(first)


def test_api_contract_etag_filters_errors_operator_context_and_openapi() -> None:
    presentation = service()
    fast_api_app.app.dependency_overrides[fast_api_app.get_presentation_service] = lambda: (
        presentation
    )
    try:
        client = TestClient(fast_api_app.app)
        response = client.get(f"/api/v1/ui/recoveries/{INCIDENT}")
        assert response.status_code == 200
        assert response.headers["etag"] == 'W/"17"'
        assert (
            client.get(
                f"/api/v1/ui/recoveries/{INCIDENT}",
                headers={"If-None-Match": 'W/"17"'},
            ).status_code
            == 304
        )
        assert client.get("/api/v1/ui/objectives?status=restored").status_code == 200
        operator = client.get(f"/api/v1/ui/operator/context?incident_id={INCIDENT}")
        assert operator.json()["read_only"] is True
        assert client.get("/api/v1/ui/recoveries/missing").status_code == 404
        openapi = client.get("/openapi.json").json()
        assert "/api/v1/ui/evidence/{incident_id}" in openapi["paths"]
        assert "/api/v1/ui/recoveries/{incident_id}/events" in openapi["paths"]
    finally:
        fast_api_app.app.dependency_overrides.clear()


def test_presentation_layer_has_no_frontend_dependency() -> None:
    from objective_recovery_agent import presentation, ui_schemas, ui_store

    source = "\n".join(inspect.getsource(module) for module in (presentation, ui_schemas, ui_store))
    assert "from frontend" not in source
    assert "import frontend" not in source


def test_every_public_evidence_reference_resolves_exactly_once() -> None:
    case = service().recovery_case(INCIDENT)
    evidence_ids = [item.evidence_id for item in case.evidence]
    assert len(evidence_ids) == len(set(evidence_ids))
    references = [
        evidence_id
        for attempt in case.attempts
        for stage in attempt.stages
        for evidence_id in stage.related_evidence_ids
    ]
    references.extend(item.evidence_id for item in case.actions if item.evidence_id)
    references.extend(
        invariant.evidence_id
        for verification in case.verifications
        for invariant in verification.invariants
        if invariant.evidence_id
    )
    references.extend(
        action.execution_evidence_id
        for plan in case.plans
        for action in plan.actions
        if action.execution_evidence_id
    )
    assert references
    assert all(evidence_ids.count(reference) == 1 for reference in references)


def test_unresolved_evidence_reference_fails_contract_validation() -> None:
    serialized = service().recovery_case(INCIDENT).model_dump(mode="json")
    serialized["evidence"] = [
        item for item in serialized["evidence"] if item["evidence_id"] != "objective-verification:2"
    ]
    with pytest.raises(ValidationError, match="unresolved evidence references"):
        RecoveryCaseView.model_validate(serialized)


def test_pending_verification_exposes_authoritative_expected_invariants() -> None:
    case = service(active_verifying_store()).recovery_case(INCIDENT)
    pending = case.verifications[-1]
    expected = active_verifying_store().revisions[(INCIDENT, 2)]["replanning_input"]["context"][
        "objective_invariants"
    ]
    assert pending.status is VerificationStatus.PENDING
    assert [item.invariant_id for item in pending.invariants] == expected
    assert all(
        item.expected == "true"
        and item.observed is None
        and item.status is VerificationStatus.PENDING
        for item in pending.invariants
    )


def test_plan_actions_distinguish_proposal_executable_and_executed_truth() -> None:
    case = service().recovery_case(INCIDENT)
    selected = next(item for item in case.plans if item.revision == 2 and item.selected)
    assignment = next(item for item in selected.actions if item.kind == "reassign_task")
    github = next(item for item in selected.actions if item.kind == "github_release_validation")
    assert assignment.disposition is PlanActionDisposition.PROPOSAL_ONLY
    assert assignment.execution_evidence_id is None
    assert github.disposition is PlanActionDisposition.EXECUTED
    assert github.execution_evidence_id == "github-run:102"

    pending_store = restored_store()
    pending_store.receipts.pop("receipt-b")
    pending = service(pending_store).recovery_case(INCIDENT)
    pending_plan = next(item for item in pending.plans if item.revision == 2 and item.selected)
    pending_github = next(
        item for item in pending_plan.actions if item.kind == "github_release_validation"
    )
    assert pending_github.disposition is PlanActionDisposition.EXECUTABLE
    assert pending_github.execution_evidence_id is None


def test_objective_timing_uses_restoration_time_not_viewing_clock() -> None:
    restored = service().recovery_case(INCIDENT).objective
    expected_margin = int(
        (
            datetime(2026, 8, 28, 17, tzinfo=UTC) - datetime(2026, 8, 27, 13, 2, 27, tzinfo=UTC)
        ).total_seconds()
    )
    assert restored.restored_at == "2026-08-27T13:02:27+00:00"
    assert restored.deadline_margin_seconds == expected_margin
    assert restored.time_remaining_seconds is None

    viewed_later = PresentationService(
        restored_store(), clock=lambda: datetime(2030, 1, 1, tzinfo=UTC)
    ).recovery_case(INCIDENT)
    assert viewed_later.objective.deadline_margin_seconds == expected_margin
    assert viewed_later.objective.time_remaining_seconds is None

    active = service(active_verifying_store()).recovery_case(INCIDENT).objective
    assert active.restored_at is None
    assert active.deadline_margin_seconds is None
    assert active.time_remaining_seconds == 100800


def test_event_phase_metadata_preserves_durable_chronology() -> None:
    events = service().events(INCIDENT).events
    assert [item.timestamp for item in events] == sorted(item.timestamp for item in events)
    assert (
        next(item for item in events if item.semantic_type == "EVENT_RECEIVED").phase
        is EventPhase.DETECT
    )
    assert (
        next(item for item in events if item.semantic_type == "REPLAN_STARTED").phase
        is EventPhase.REPLAN
    )
    restored = next(item for item in events if item.semantic_type == "OBJECTIVE_RESTORED")
    assert restored.phase is EventPhase.RESTORED
    assert restored.timestamp == "2026-08-27T13:02:27+00:00"


def test_detect_replan_and_normalized_source_authorities_are_sanitized() -> None:
    case = service().recovery_case(INCIDENT)
    assert case.detect_context is not None
    assert case.detect_context.source_system is SourceAuthority.GMAIL
    assert case.detect_context.source_evidence_id == "gmail-message:gmail-message-canonical"
    assert case.detect_context.affected_resource_ids == ["person-backend-lead"]
    assert case.replan_context is not None
    assert case.replan_context.failed_invariant_id == "release-validation-green"
    assert case.replan_context.failed_evidence_id == "objective-verification:1"
    assert case.replan_context.replanning_input_fingerprint == "b" * 64
    assert case.replan_context.failed_effect_fingerprint == "c" * 64
    assert {item.source_system for item in case.evidence} >= {
        SourceAuthority.GMAIL,
        SourceAuthority.GOOGLE_CALENDAR,
        SourceAuthority.GITHUB_ACTIONS,
        SourceAuthority.REFLOW_VERIFIER,
    }
    assert all(
        item.source_authority is SourceAuthority.REFLOW_ENGINE
        for item in service().events(INCIDENT).events
    )
    serialized = str(case.model_dump(mode="json")).casefold()
    for forbidden in (
        "raw_mime",
        "normalized_text",
        "access_token",
        "refresh_token",
        "oauth",
        "authorization",
        "private_prompt",
        "chain_of_thought",
        "thought_signature",
    ):
        assert forbidden not in serialized


def test_real_sanitized_fixtures_validate_against_exact_contract_models() -> None:
    root = Path(__file__).parents[1] / "docs" / "ui-fixtures"
    OverviewView.model_validate_json((root / "overview.json").read_text(encoding="utf-8"))
    ObjectivesView.model_validate_json((root / "objectives.json").read_text(encoding="utf-8"))
    active = RecoveryCaseView.model_validate_json(
        (root / "recovery-active.json").read_text(encoding="utf-8")
    )
    restored = RecoveryCaseView.model_validate_json(
        (root / "recovery-restored.json").read_text(encoding="utf-8")
    )
    evidence = EvidencePageView.model_validate_json(
        (root / "evidence.json").read_text(encoding="utf-8")
    )
    events = ExecutionEventsView.model_validate_json(
        (root / "events.json").read_text(encoding="utf-8")
    )
    OperatorContextView.model_validate_json(
        (root / "operator-context.json").read_text(encoding="utf-8")
    )
    assert active.revision == 15
    assert active.objective.health is ObjectiveHealth.RECOVERING
    assert active.objective.workflow_stage is WorkflowStage.VERIFY
    assert active.objective.is_live is True
    assert active.attempts[1].branch_from_attempt == 1
    assert active.verifications[-1].status is VerificationStatus.PENDING
    assert len(active.verifications[-1].invariants) == 6
    assert all(item.observed is None for item in active.verifications[-1].invariants)
    assert restored.revision == 16
    assert restored.objective.restored_at == "2026-08-27T19:08:54.504926+00:00"
    assert restored.objective.deadline_margin_seconds == 78665
    assert evidence.incident_id == "incident-0fc3af5b0bd1ad847aea"
    assert events.incident_id == "incident-0fc3af5b0bd1ad847aea"
    assert active.detect_context is not None
    assert active.detect_context.source_system is SourceAuthority.GMAIL
