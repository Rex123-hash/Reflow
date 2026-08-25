from __future__ import annotations

import base64
from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient
from objective_recovery_agent import fast_api_app
from objective_recovery_agent.ledger import InMemoryWorkflowLedger
from objective_recovery_agent.orchestrator import RecoveryOrchestrator
from objective_recovery_agent.schemas import (
    ActionParameter,
    AssumptionState,
    CandidateSet,
    CritiqueBundle,
    DisruptionEvent,
    IncidentStage,
    PlanAssumptionOutput,
    PlanCritique,
    PlanningRun,
    PlanRisk,
    ProposedAction,
    ProposedAssignment,
    RecoveryPlanCandidate,
    StrategyType,
)
from pydantic import ValidationError


def disruption(event_id: str = "event-backend-lead-unavailable") -> DisruptionEvent:
    return DisruptionEvent(
        event_id=event_id,
        event_type="person_unavailable",
        occurred_at=datetime(2026, 8, 25, 12, tzinfo=UTC).isoformat(),
        source="p1a-test-publisher",
        summary="Lead backend engineer is unavailable through release day.",
        disrupted_node_ids=["person-backend-lead"],
        evidence_references=["event:test:backend-lead-unavailable"],
    )


def candidate(
    plan_id: str,
    strategy: StrategyType,
    *,
    risk: int,
    load: int = 80,
    unknown: bool = False,
) -> RecoveryPlanCandidate:
    target_by_strategy = {
        StrategyType.DEADLINE_FIRST: "work-api-migration",
        StrategyType.RISK_MINIMIZATION_FIRST: "work-api-tests",
        StrategyType.RESOURCE_BALANCE_FIRST: "work-release-notes",
    }
    person_by_strategy = {
        StrategyType.DEADLINE_FIRST: "person-backup",
        StrategyType.RISK_MINIMIZATION_FIRST: "person-qa",
        StrategyType.RESOURCE_BALANCE_FIRST: "person-generalist",
    }
    skills_by_strategy = {
        StrategyType.DEADLINE_FIRST: ["python", "api"],
        StrategyType.RISK_MINIMIZATION_FIRST: ["qa", "python"],
        StrategyType.RESOURCE_BALANCE_FIRST: ["release", "documentation"],
    }
    assumptions = [
        PlanAssumptionOutput(
            assumption_id=f"assumption-{plan_id}",
            description="Repository access remains available.",
            status=AssumptionState.UNKNOWN if unknown else AssumptionState.CONFIRMED,
            blocks_execution=unknown,
        )
    ]
    return RecoveryPlanCandidate(
        plan_id=plan_id,
        strategy_type=strategy,
        actions=[
            ProposedAction(
                action_id=f"action-{plan_id}",
                action_type=f"propose-{strategy.value}",
                target=target_by_strategy[strategy],
                parameters=[ActionParameter(key="mode", value="proposal-only")],
            )
        ],
        deadline_changes=[],
        assignments=[
            ProposedAssignment(
                work_item_id=target_by_strategy[strategy],
                person_id=person_by_strategy[strategy],
                required_skills=skills_by_strategy[strategy],
                projected_load_percent=load,
            )
        ],
        assumptions=assumptions,
        unknowns=[],
        expected_objective_effect="Preserves a feasible path to the protected release deadline.",
        risks=[PlanRisk(risk_id=f"risk-{plan_id}", summary="Reduced schedule margin.", severity=2)],
        required_evidence=["Fresh workload and repository-access read-back."],
        initial_risk_score=risk,
    )


def planning_run(
    *plans: RecoveryPlanCandidate, failed: list[StrategyType] | None = None
) -> PlanningRun:
    return PlanningRun(
        candidates=CandidateSet(plans=list(plans)),
        critiques=CritiqueBundle(
            critiques=[
                PlanCritique(
                    plan_id=plan.plan_id,
                    verdict_summary="Plan remains feasible but has measurable execution risk.",
                    additional_risks=["Availability may change."],
                    contradictions=[],
                    missing_evidence=["Fresh availability read-back."],
                    adjusted_risk_score=plan.initial_risk_score,
                )
                for plan in plans
            ]
        ),
        planner_latency_ms=321,
        critic_latency_ms=123,
        total_tokens=456,
        failed_perspectives=failed or [],
    )


class StubPlanner:
    def __init__(self, run: PlanningRun | BaseException) -> None:
        self.run = run
        self.calls = 0

    async def generate(self, planning_input: Any) -> PlanningRun:
        self.calls += 1
        if isinstance(self.run, BaseException):
            raise self.run
        return self.run


def three_valid_plans() -> PlanningRun:
    return planning_run(
        candidate("deadline", StrategyType.DEADLINE_FIRST, risk=35),
        candidate("risk", StrategyType.RISK_MINIMIZATION_FIRST, risk=20),
        candidate("balance", StrategyType.RESOURCE_BALANCE_FIRST, risk=25),
    )


@pytest.mark.asyncio
async def test_duplicate_delivery_creates_one_incident_and_does_not_replan() -> None:
    ledger = InMemoryWorkflowLedger()
    planner = StubPlanner(three_valid_plans())
    orchestrator = RecoveryOrchestrator(ledger, planner)

    first = await orchestrator.process(disruption(), "pubsub-message-1")
    duplicate = await orchestrator.process(disruption(), "pubsub-message-2")

    assert first.stage is IncidentStage.PLAN_SELECTED
    assert duplicate.deduplicated
    assert duplicate.incident_id == first.incident_id
    assert len(ledger.incidents) == 1
    assert planner.calls == 1


@pytest.mark.asyncio
async def test_one_failed_perspective_still_selects_from_valid_survivors() -> None:
    run = planning_run(
        candidate("deadline", StrategyType.DEADLINE_FIRST, risk=30),
        candidate("balance", StrategyType.RESOURCE_BALANCE_FIRST, risk=20),
        failed=[StrategyType.RISK_MINIMIZATION_FIRST],
    )
    result = await RecoveryOrchestrator(InMemoryWorkflowLedger(), StubPlanner(run)).process(
        disruption("event-partial-planner"), "message-partial"
    )
    assert result.stage is IncidentStage.PLAN_SELECTED
    assert result.selected_plan_id == "balance"


@pytest.mark.asyncio
async def test_all_invalid_plans_stop_without_selection() -> None:
    run = planning_run(
        candidate("overloaded", StrategyType.DEADLINE_FIRST, risk=10, load=150),
        candidate("unknown", StrategyType.RISK_MINIMIZATION_FIRST, risk=5, unknown=True),
    )
    ledger = InMemoryWorkflowLedger()
    result = await RecoveryOrchestrator(ledger, StubPlanner(run)).process(
        disruption("event-invalid"), "message-invalid"
    )
    assert result.stage is IncidentStage.NO_VALID_PLAN
    assert result.selected_plan_id is None
    incident = ledger.incidents[result.incident_id]
    assert all(not item["is_valid"] for item in incident["policy_decisions"])


@pytest.mark.asyncio
async def test_blocking_unknown_is_deterministically_rejected() -> None:
    run = planning_run(
        candidate("unknown", StrategyType.DEADLINE_FIRST, risk=1, unknown=True),
        candidate("valid", StrategyType.RESOURCE_BALANCE_FIRST, risk=40),
    )
    ledger = InMemoryWorkflowLedger()
    result = await RecoveryOrchestrator(ledger, StubPlanner(run)).process(
        disruption("event-blocking-unknown"), "message-unknown"
    )
    assert result.selected_plan_id == "valid"
    decisions = ledger.incidents[result.incident_id]["policy_decisions"]
    rejected = next(item for item in decisions if item["plan_id"] == "unknown")
    assert rejected["blocking_unknowns"] == ["assumption-unknown"]


@pytest.mark.asyncio
async def test_planner_timeout_releases_claim_for_retry_without_resolution() -> None:
    ledger = InMemoryWorkflowLedger()
    event = disruption("event-timeout")
    orchestrator = RecoveryOrchestrator(ledger, StubPlanner(TimeoutError("planner deadline")))

    with pytest.raises(TimeoutError):
        await orchestrator.process(event, "message-timeout")

    incident = next(iter(ledger.incidents.values()))
    assert incident["stage"] == IncidentStage.PLANNING_FAILED.value
    assert incident["status"] == "planning_failed"
    assert ledger.claims[event.event_id]["state"] == "retryable"


@pytest.mark.asyncio
async def test_restart_resumes_from_persisted_plans_without_calling_model_again() -> None:
    ledger = InMemoryWorkflowLedger()
    planner = StubPlanner(three_valid_plans())
    event = disruption("event-resume")
    orchestrator = RecoveryOrchestrator(ledger, planner)
    first = await orchestrator.process(event, "message-first")
    assert planner.calls == 1

    incident = ledger.incidents[first.incident_id]
    incident["stage"] = IncidentStage.PLANNING_FAILED.value
    incident["last_error"] = "simulated failure after durable planner output"
    incident.pop("selected_plan_id", None)
    ledger.claims[event.event_id]["state"] = "retryable"
    resumed = await orchestrator.process(event, "message-retry")

    assert resumed.stage is IncidentStage.PLAN_SELECTED
    assert resumed.selected_plan_id == "risk"
    assert planner.calls == 1


def test_malformed_typed_model_output_is_rejected() -> None:
    malformed = {
        "plan_id": "broken",
        "strategy_type": "deadline-first",
        "actions": [],
        "expected_objective_effect": "too short",
        "risks": [],
        "required_evidence": [],
        "initial_risk_score": 500,
    }
    with pytest.raises(ValidationError):
        RecoveryPlanCandidate.model_validate(malformed)


def test_pubsub_endpoint_rejects_malformed_payload_without_calling_orchestrator(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        fast_api_app,
        "get_orchestrator",
        lambda: pytest.fail("orchestrator must not be called"),
    )
    envelope = {
        "message": {
            "data": base64.b64encode(b"not-json").decode(),
            "messageId": "malformed-message",
        },
        "subscription": "test-subscription",
    }
    response = TestClient(fast_api_app.app).post(
        "/apps/objective_recovery_agent/trigger/pubsub", json=envelope
    )
    assert response.status_code == 400


def test_deterministic_selected_plan_is_repeatable_for_same_candidates() -> None:
    run = three_valid_plans()
    scores = [plan.initial_risk_score for plan in run.candidates.plans]
    assert scores == [35, 20, 25]
    assert (
        min(run.candidates.plans, key=lambda plan: (plan.initial_risk_score, plan.plan_id)).plan_id
        == "risk"
    )
