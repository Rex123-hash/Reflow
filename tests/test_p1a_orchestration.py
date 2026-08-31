from __future__ import annotations

import base64
from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient
from objective_recovery_agent import fast_api_app
from objective_recovery_agent.ledger import InMemoryWorkflowLedger
from objective_recovery_agent.objective_store import InMemoryObjectiveStore
from objective_recovery_agent.orchestrator import RecoveryOrchestrator
from objective_recovery_agent.schemas import (
    ActionParameter,
    AssumptionState,
    CandidateGeneration,
    CandidateSet,
    CritiqueBundle,
    CritiqueGeneration,
    DisruptionEvent,
    IncidentStage,
    ObjectiveRecord,
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
    def __init__(
        self,
        run: PlanningRun | BaseException,
        *,
        critic_error: BaseException | None = None,
    ) -> None:
        self.run = run
        self.critic_error = critic_error
        self.planner_calls = 0
        self.critic_calls = 0
        self.last_input: Any = None

    @property
    def calls(self) -> int:
        return self.planner_calls

    async def generate_candidates(self, planning_input: Any) -> CandidateGeneration:
        self.planner_calls += 1
        self.last_input = planning_input
        if isinstance(self.run, BaseException):
            raise self.run
        return CandidateGeneration(
            planning_run_id=self.run.planning_run_id,
            candidates=self.run.candidates,
            planner_latency_ms=self.run.planner_latency_ms,
            total_tokens=self.run.total_tokens,
            input_tokens=self.run.input_tokens,
            output_tokens=self.run.output_tokens,
        )

    async def critique(
        self,
        candidates: CandidateSet,
        *,
        planning_run_id: str,
        event_id: str | None = None,
        incident_id: str | None = None,
    ) -> CritiqueGeneration:
        self.critic_calls += 1
        if self.critic_error is not None:
            raise self.critic_error
        assert not isinstance(self.run, BaseException)
        return CritiqueGeneration(
            critiques=self.run.critiques,
            critic_latency_ms=self.run.critic_latency_ms,
        )


def three_valid_plans() -> PlanningRun:
    return planning_run(
        candidate("deadline", StrategyType.DEADLINE_FIRST, risk=35),
        candidate("risk", StrategyType.RISK_MINIMIZATION_FIRST, risk=20),
        candidate("balance", StrategyType.RESOURCE_BALANCE_FIRST, risk=25),
    )


@pytest.mark.asyncio
async def test_fresh_event_pins_and_plans_from_persisted_objective() -> None:
    objective = ObjectiveRecord(
        objective_id="release-qualification-fresh",
        label="SHIP RELEASE V2",
        deadline_local="2026-09-01 18:00:00",
        deadline_timezone="Etc/UTC",
        deadline_at_utc="2026-09-01T18:00:00Z",
        objective_version=1,
        protected_commitment=True,
    )
    objectives = InMemoryObjectiveStore()
    objectives.ensure_objective(objective)
    event = disruption("event-fresh-objective").model_copy(
        update={"objective_id": objective.objective_id, "objective_version": 1}
    )
    ledger = InMemoryWorkflowLedger()
    planner = StubPlanner(three_valid_plans())

    await RecoveryOrchestrator(ledger, planner, objective_store=objectives).process(
        event, "pubsub-fresh-objective"
    )

    incident = next(iter(ledger.incidents.values()))
    assert incident["objective_id"] == objective.objective_id
    assert incident["objective_version"] == 1
    assert planner.last_input.objective_id == objective.objective_id
    assert planner.last_input.protected_deadline == objective.deadline_at_utc
    assert "release-v2" not in planner.last_input.affected_node_ids
    assert objective.objective_id in planner.last_input.affected_node_ids


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
async def test_duplicate_before_completion_returns_in_progress_without_planning() -> None:
    ledger = InMemoryWorkflowLedger()
    planner = StubPlanner(three_valid_plans())
    event = disruption("event-in-progress")
    first_claim = ledger.claim_event(event, "pubsub-message-1")

    duplicate = await RecoveryOrchestrator(ledger, planner).process(event, "pubsub-message-2")

    assert duplicate.in_progress
    assert not duplicate.deduplicated
    assert duplicate.incident_id == first_claim.incident_id
    assert len(ledger.incidents) == 1
    assert planner.planner_calls == 0
    assert planner.critic_calls == 0


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
async def test_retry_after_planner_failure_calls_planner_once_more_then_completes() -> None:
    ledger = InMemoryWorkflowLedger()
    event = disruption("event-planner-retry")
    planner = StubPlanner(TimeoutError("planner deadline"))
    orchestrator = RecoveryOrchestrator(ledger, planner)

    with pytest.raises(TimeoutError):
        await orchestrator.process(event, "message-first")

    planner.run = three_valid_plans()
    result = await orchestrator.process(event, "message-retry")

    assert result.stage is IncidentStage.PLAN_SELECTED
    assert planner.planner_calls == 2
    assert planner.critic_calls == 1
    assert ledger.claims[event.event_id]["attempts"] == 2


@pytest.mark.asyncio
async def test_retry_after_critic_failure_reuses_persisted_candidates() -> None:
    ledger = InMemoryWorkflowLedger()
    event = disruption("event-critic-retry")
    planner = StubPlanner(three_valid_plans(), critic_error=TimeoutError("critic deadline"))
    orchestrator = RecoveryOrchestrator(ledger, planner)

    with pytest.raises(TimeoutError):
        await orchestrator.process(event, "message-first")

    incident = next(iter(ledger.incidents.values()))
    assert "candidate_generation" in incident
    assert "planning_run" not in incident

    planner.critic_error = None
    result = await orchestrator.process(event, "message-retry")

    assert result.stage is IncidentStage.PLAN_SELECTED
    assert planner.planner_calls == 1
    assert planner.critic_calls == 2
    assert ledger.claims[event.event_id]["attempts"] == 2


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
    assert planner.critic_calls == 1


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
    capsys: pytest.CaptureFixture[str],
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
    assert "PUBSUB_DECODE_FAILED" in capsys.readouterr().out


def test_pubsub_endpoint_keeps_in_progress_delivery_retryable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    ledger = InMemoryWorkflowLedger()
    planner = StubPlanner(three_valid_plans())
    event = disruption("event-overlapping-delivery")
    ledger.claim_event(event, "message-active-worker")
    monkeypatch.setattr(
        fast_api_app,
        "get_orchestrator",
        lambda: RecoveryOrchestrator(ledger, planner),
    )
    envelope = {
        "message": {
            "data": base64.b64encode(event.model_dump_json().encode()).decode(),
            "messageId": "message-redelivery",
        },
        "subscription": "projects/test/subscriptions/test",
    }

    response = TestClient(fast_api_app.app).post(
        "/apps/objective_recovery_agent/trigger/pubsub", json=envelope
    )

    assert response.status_code == 503
    assert planner.planner_calls == 0
    assert planner.critic_calls == 0


def test_deterministic_selected_plan_is_repeatable_for_same_candidates() -> None:
    run = three_valid_plans()
    scores = [plan.initial_risk_score for plan in run.candidates.plans]
    assert scores == [35, 20, 25]
    assert (
        min(run.candidates.plans, key=lambda plan: (plan.initial_risk_score, plan.plan_id)).plan_id
        == "risk"
    )
