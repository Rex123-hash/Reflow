from __future__ import annotations

import json
from types import SimpleNamespace
from typing import Any, cast

import pytest
from objective_recovery_agent.agent_runtime import AgentId, AgentTraceContext, emit_agent_event
from objective_recovery_agent.gmail_contract import (
    DisruptionFacts,
    DisruptionFactsInput,
    GmailClassification,
    GmailInterpretation,
    ImpactAnalysisInput,
    NormalizedGmailMessage,
)
from objective_recovery_agent.gmail_interpretation import (
    AdkGmailInterpreter,
    GmailInterpretationError,
    create_disruption_interpreter_workflow,
    create_impact_analyst_workflow,
    validate_impact_analysis,
)
from objective_recovery_agent.p1d import P1DConfiguration, P1DService
from objective_recovery_agent.p1d_store import InMemoryP1DStore
from objective_recovery_agent.planning import (
    AdkPlanningService,
    WorkflowResult,
    build_recovery_analysis_input,
    create_bundle_workflow,
    create_critic_workflow,
    create_recovery_analyst_workflow,
    create_replan_critic_workflow,
    create_replan_workflow,
    run_workflow,
    validate_recovery_analysis,
)
from objective_recovery_agent.schemas import (
    FailedRecoveryEffect,
    ObjectiveRecord,
    P1DContinuation,
    RecoveryAnalysis,
    RecoveryAnalysisInput,
    RecoveryArtifact,
    RecoveryPlanningInput,
    ReplanningInput,
)


def message() -> NormalizedGmailMessage:
    text = "The backend lead is unavailable and API migration work is blocked."
    return NormalizedGmailMessage(
        gmail_message_id="gmail-p2c-1",
        thread_id="thread-p2c-1",
        mailbox="reflow.demo@gmail.com",
        sender="ops@example.com",
        to="reflow.demo@gmail.com",
        subject="Backend delivery disruption",
        internal_date="2026-08-27T12:00:00+00:00",
        labels=["INBOX"],
        snippet=text,
        normalized_text=text,
        content_hash="a" * 64,
        evidence_excerpt=text,
    )


def real_facts() -> DisruptionFacts:
    return DisruptionFacts(
        classification=GmailClassification.REAL_DISRUPTION,
        event_type="resource-unavailable",
        summary="A named delivery resource is unavailable.",
        mentioned_entities=["backend lead", "API migration work"],
        grounded_excerpts=["backend lead is unavailable"],
        unknowns=[],
    )


def valid_impact() -> GmailInterpretation:
    return GmailInterpretation(
        classification=GmailClassification.REAL_DISRUPTION,
        event_type="resource-unavailable",
        summary="The disruption threatens a resource and dependent release work.",
        candidate_node_ids=["person-backend-lead", "work-api-migration"],
        grounded_excerpts=["backend lead is unavailable"],
        unknowns=[],
    )


def replanning_context() -> ReplanningInput:
    fingerprint = "f" * 64
    return ReplanningInput(
        incident_id="incident-p2c-boundary",
        plan_revision=2,
        objective=ObjectiveRecord(
            objective_id="release-v2",
            label="SHIP RELEASE V2",
            deadline_local="2026-08-28 17:00:00",
            deadline_timezone="Etc/UTC",
            deadline_at_utc="2026-08-28T17:00:00Z",
            objective_version=1,
            protected_commitment=True,
        ),
        objective_invariants=["release-validation-green"],
        objective_graph={},
        previous_selected_plan={"plan_id": "candidate-a"},
        previous_plan_assumptions=[{"assumption_id": "ci-compatible"}],
        previous_plan_unknowns=[],
        previous_critic_findings=[],
        previous_policy_result=[],
        calendar_action_claim={},
        calendar_receipt={"receipt_id": "calendar-1", "status": "VERIFIED"},
        github_action_claim={},
        github_receipt={"receipt_id": "github-1", "status": "VERIFIED"},
        failed_candidate_sha="a" * 40,
        failed_release={"release_id": 10},
        failed_run={"run_id": 20, "conclusion": "failure"},
        failed_jobs=[{"job_id": 30, "conclusion": "failure"}],
        failed_invariant_id="release-validation-green",
        verification_timestamps=["2026-08-27T12:00:00+00:00"],
        exact_external_evidence={},
        failed_recovery_effects=[
            FailedRecoveryEffect(
                action_type="github_release_validation",
                repository="owner/repo",
                candidate_sha="a" * 40,
                workflow_id=7,
                workflow_path=".github/workflows/release.yml",
                failed_invariant_id="release-validation-green",
                fingerprint=fingerprint,
            )
        ],
        available_recovery_artifacts=[
            RecoveryArtifact(
                artifact_id="candidate-b",
                artifact_type="github_commit",
                repository="owner/repo",
                candidate_sha="b" * 40,
                parent_sha="a" * 40,
                state="AVAILABLE",
                production_diff="compatibility fix",
                unchanged_proof={"workflow": "same"},
            )
        ],
        recovery_one_accomplished=["The Calendar action remained verified."],
        remaining_broken=["Release validation is not green."],
        unhealthy_reason="The verified CI run failed.",
        policy_summary=["Reject an exact failed-effect repeat."],
    )


def valid_recovery_analysis() -> RecoveryAnalysis:
    return RecoveryAnalysis(
        failed_assumption_summary=["Candidate A was not release-compatible."],
        failed_invariant_references=["release-validation-green"],
        evidence_references=[
            "invariant:release-validation-green",
            f"failed-effect:{'f' * 64}",
            "github-run:20",
        ],
        next_plan_constraints=["Use a different AVAILABLE artifact."],
        exact_repeat_fingerprints=["f" * 64],
        material_changes=["Candidate B contains the compatibility fix."],
    )


def workflow_agent_name(workflow: Any) -> str:
    edge = cast(Any, workflow.edges[0])
    return str(edge[1].name)


def test_five_core_agent_ids_are_real_adk_boundaries_with_typed_schemas() -> None:
    workflows = {
        AgentId.DISRUPTION_INTERPRETER: create_disruption_interpreter_workflow(),
        AgentId.IMPACT_ANALYST: create_impact_analyst_workflow(),
        AgentId.RECOVERY_PLANNER: create_bundle_workflow(),
        AgentId.RISK_CRITIC: create_critic_workflow(),
        AgentId.RECOVERY_ANALYST: create_recovery_analyst_workflow(),
    }
    assert set(workflows) == set(AgentId)
    for agent_id, workflow in workflows.items():
        assert workflow_agent_name(workflow) == agent_id.value
        assert workflow.input_schema is not None
        assert workflow.output_schema is not None
    assert workflow_agent_name(create_replan_workflow()) == AgentId.RECOVERY_PLANNER
    assert workflow_agent_name(create_replan_critic_workflow()) == AgentId.RISK_CRITIC


@pytest.mark.asyncio
async def test_real_gmail_uses_typed_interpreter_then_impact_analyst(monkeypatch: Any) -> None:
    calls: list[tuple[str, object, AgentTraceContext | None]] = []
    outputs = [real_facts(), valid_impact()]

    async def fake_run(
        workflow: Any, payload: object, *, trace: AgentTraceContext | None = None
    ) -> WorkflowResult:
        calls.append((workflow_agent_name(workflow), payload, trace))
        return WorkflowResult(outputs.pop(0), 1, 2, 1, 1)

    monkeypatch.setattr("objective_recovery_agent.gmail_interpretation.run_workflow", fake_run)
    result = await AdkGmailInterpreter().interpret(message())
    assert result == valid_impact()
    assert [item[0] for item in calls] == ["disruption_interpreter", "impact_analyst"]
    first_payload = calls[0][1]
    assert isinstance(first_payload, DisruptionFactsInput)
    assert "known_nodes" not in first_payload.model_dump()
    assert isinstance(calls[1][1], ImpactAnalysisInput)


@pytest.mark.asyncio
async def test_irrelevant_gmail_does_not_inflate_calls_with_impact_analysis(
    monkeypatch: Any,
) -> None:
    calls = 0

    async def fake_run(*args: object, **kwargs: object) -> WorkflowResult:
        nonlocal calls
        calls += 1
        return WorkflowResult(
            DisruptionFacts(
                classification=GmailClassification.NO_RELEVANT_OBJECTIVE_IMPACT,
                event_type="irrelevant-email",
                summary="No objective-relevant disruption is grounded.",
            ),
            1,
            2,
            1,
            1,
        )

    monkeypatch.setattr("objective_recovery_agent.gmail_interpretation.run_workflow", fake_run)
    result = await AdkGmailInterpreter().interpret(message())
    assert result.classification is GmailClassification.NO_RELEVANT_OBJECTIVE_IMPACT
    assert calls == 1


def test_impact_analyst_cannot_bypass_deterministic_graph_authority() -> None:
    invalid = valid_impact().model_copy(update={"candidate_node_ids": ["invented-node"]})
    with pytest.raises(GmailInterpretationError, match="unknown graph node"):
        validate_impact_analysis(message(), real_facts(), invalid)
    changed_evidence = valid_impact().model_copy(update={"grounded_excerpts": ["invented"]})
    with pytest.raises(GmailInterpretationError, match="changed grounded"):
        validate_impact_analysis(message(), real_facts(), changed_evidence)


def test_recovery_analysis_is_minimal_grounded_and_exact_repeat_safe() -> None:
    analysis_input = build_recovery_analysis_input(replanning_context())
    assert analysis_input.objective_id == "release-v2"
    assert "objective_graph" not in analysis_input.model_dump()
    assert "invariant:release-validation-green" in analysis_input.evidence_references
    assert validate_recovery_analysis(analysis_input, valid_recovery_analysis())

    omitted = valid_recovery_analysis().model_copy(update={"failed_invariant_references": []})
    with pytest.raises(ValueError, match="failed invariant"):
        validate_recovery_analysis(analysis_input, omitted)
    ungrounded = valid_recovery_analysis().model_copy(update={"evidence_references": ["fake"]})
    with pytest.raises(ValueError, match="ungrounded evidence"):
        validate_recovery_analysis(analysis_input, ungrounded)
    repeat_lost = valid_recovery_analysis().model_copy(update={"exact_repeat_fingerprints": []})
    with pytest.raises(ValueError, match="exact-repeat"):
        validate_recovery_analysis(analysis_input, repeat_lost)


@pytest.mark.asyncio
async def test_recovery_analyst_output_is_validated_before_planning(monkeypatch: Any) -> None:
    captured: list[tuple[object, AgentTraceContext | None]] = []

    async def fake_run(
        workflow: Any, payload: object, *, trace: AgentTraceContext | None = None
    ) -> WorkflowResult:
        captured.append((payload, trace))
        return WorkflowResult(valid_recovery_analysis(), 3, 6, 4, 2)

    monkeypatch.setattr("objective_recovery_agent.planning.run_workflow", fake_run)
    generated = await AdkPlanningService().analyze_recovery(replanning_context())
    assert generated.analysis == valid_recovery_analysis()
    assert isinstance(captured[0][0], RecoveryAnalysisInput)
    assert captured[0][1] is not None
    assert captured[0][1].agent_id is AgentId.RECOVERY_ANALYST
    typed_planner_input = RecoveryPlanningInput(
        authoritative_context=replanning_context(), recovery_analysis=generated.analysis
    )
    assert create_replan_workflow().input_schema is RecoveryPlanningInput
    assert typed_planner_input.recovery_analysis.exact_repeat_fingerprints == ["f" * 64]


@pytest.mark.asyncio
async def test_recovery_analyst_failure_stops_before_planning_or_external_effects(
    monkeypatch: Any,
) -> None:
    incident_id = "incident-p2c-boundary"
    store = InMemoryP1DStore()
    store.incidents[incident_id] = {
        "incident_id": incident_id,
        "stage": "VERIFICATION_FAILED",
        "status": "recovery_incomplete",
        "revision": 8,
    }

    class FailingPlanner:
        calls = 0

        async def analyze_recovery(self, value: ReplanningInput) -> Any:
            assert value.incident_id == incident_id
            self.calls += 1
            raise TimeoutError("analyst timeout")

        def __getattr__(self, name: str) -> Any:
            raise AssertionError(f"downstream planner method called: {name}")

    class Workflow:
        def record_event(self, *args: object, **kwargs: object) -> None:
            pass

    class ForbiddenExternal:
        def __getattr__(self, name: str) -> Any:
            raise AssertionError(f"external dependency called: {name}")

    planner = FailingPlanner()
    forbidden = ForbiddenExternal()
    monkeypatch.setattr(
        "objective_recovery_agent.p1d.build_replanning_input",
        lambda **kwargs: replanning_context(),
    )
    service = P1DService(
        store=store,
        workflow=cast(Any, Workflow()),
        objective_store=cast(Any, forbidden),
        planner=cast(Any, planner),
        github_validation=cast(Any, forbidden),
        github_promotion=cast(Any, forbidden),
        github_ledger=cast(Any, forbidden),
        calendar=cast(Any, forbidden),
        configuration=P1DConfiguration("owner/repo", 7, ".github/workflows/release.yml"),
    )
    with pytest.raises(TimeoutError, match="analyst timeout"):
        await service.advance(
            P1DContinuation(
                handoff_id="a" * 64,
                incident_id=incident_id,
                failed_verification_fingerprint="b" * 64,
                source_revision=8,
                event_type="OBJECTIVE_RECOVERY_NEEDED",
            )
        )
    assert planner.calls == 1
    revision = store.revisions[incident_id]
    assert "replanning_input" in revision
    assert "recovery_analysis" not in revision
    assert "planner_checkpoint" not in revision
    assert (incident_id, "recovery_analysis") not in store.busy


def test_agent_trace_is_metadata_only(capsys: pytest.CaptureFixture[str]) -> None:
    emit_agent_event(
        "completed",
        AgentTraceContext(
            AgentId.RECOVERY_PLANNER,
            "initial_recovery_planning",
            incident_id="incident-p2c-boundary",
            recovery_attempt=1,
        ),
        model="gemini-3.7-flash",
        input_fingerprint="a" * 64,
        output_fingerprint="b" * 64,
        latency_ms=10,
    )
    event = json.loads(capsys.readouterr().out)
    assert event["agent_id"] == "recovery_planner"
    assert event["agent_version"] == "p2c-v1"
    assert event["status"] == "completed"
    assert not ({"prompt", "output", "reasoning", "chain_of_thought"} & set(event))


def test_agent_output_contracts_have_no_chain_of_thought_surface() -> None:
    schemas = (DisruptionFacts, GmailInterpretation, RecoveryAnalysis)
    forbidden = {"prompt", "raw_prompt", "reasoning", "chain_of_thought"}
    for schema in schemas:
        assert not (forbidden & set(schema.model_json_schema()["properties"]))


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("workflow", "payload", "agent_id"),
    [
        (
            create_impact_analyst_workflow(),
            ImpactAnalysisInput(disruption=real_facts(), known_nodes=[]),
            AgentId.IMPACT_ANALYST,
        ),
        (
            create_recovery_analyst_workflow(),
            RecoveryAnalysisInput.model_validate(
                build_recovery_analysis_input(replanning_context()).model_dump()
            ),
            AgentId.RECOVERY_ANALYST,
        ),
    ],
)
async def test_invalid_agent_schema_is_traced_as_failure(
    monkeypatch: Any,
    capsys: pytest.CaptureFixture[str],
    workflow: Any,
    payload: Any,
    agent_id: AgentId,
) -> None:
    class InvalidOutputRunner:
        def __init__(self, **kwargs: object) -> None:
            pass

        async def run_async(self, **kwargs: object) -> Any:
            yield SimpleNamespace(output={"invalid": True}, content=None, usage_metadata=None)

    monkeypatch.setattr("objective_recovery_agent.planning.Runner", InvalidOutputRunner)
    with pytest.raises(ValueError):
        await run_workflow(
            workflow,
            payload,
            trace=AgentTraceContext(agent_id, "invalid_schema_qualification"),
        )
    events = [json.loads(line) for line in capsys.readouterr().out.splitlines()]
    assert [item["status"] for item in events] == ["started", "failed"]
    assert events[-1]["agent_id"] == agent_id.value
    assert events[-1]["error_type"] == "ValidationError"
    assert "output_fingerprint" not in events[-1]


def test_model_retry_policy_is_bounded_to_two_attempts() -> None:
    for workflow in (
        create_impact_analyst_workflow(),
        create_recovery_analyst_workflow(),
    ):
        agent = cast(Any, workflow.edges[0])[1]
        assert agent.model.retry_options.attempts == 2
