"""Truth-preserving presentation service over frozen recovery persistence."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any, cast

from objective_recovery_agent.ui_schemas import (
    ActionReceiptView,
    AttemptComparisonItem,
    CurrentPriority,
    DetectContextView,
    EventPhase,
    EvidencePageView,
    EvidenceSemanticStatus,
    EvidenceView,
    ExecutionEventsView,
    ExecutionEventView,
    GraphEdgeView,
    GraphNodeView,
    ObjectiveContext,
    ObjectiveCounts,
    ObjectiveFilter,
    ObjectiveHealth,
    ObjectiveSummary,
    ObjectivesView,
    OperationalGraphView,
    OperatorContextView,
    OverviewView,
    PlanActionDisposition,
    PlanActionView,
    PolicyDecisionView,
    PolicyViolationView,
    ReceiptStatusView,
    RecoveryAttemptView,
    RecoveryCaseView,
    RecoveryPlanView,
    RecoveryStageView,
    RecoverySummary,
    ReplanContextView,
    SemanticStatus,
    SourceAuthority,
    VerificationInvariantView,
    VerificationStatus,
    VerificationView,
    WorkflowStage,
)
from objective_recovery_agent.ui_store import PresentationStore
from objective_recovery_agent.world import objective_graph_snapshot

_P1D_EVENTS = {
    "INCIDENT_REOPENED",
    "REPLAN_STARTED",
    "PLANNER_CHECKPOINTED",
    "CRITIC_CHECKPOINTED",
    "POLICY_EVALUATED",
    "RECOVERY_SELECTED",
    "RELEASE_VALIDATION_STARTED",
    "RELEASE_VALIDATION_SUCCEEDED",
    "FULL_RELEASE_PROMOTION_STARTED",
    "FULL_RELEASE_PROMOTION_VERIFIED",
    "OBJECTIVE_VERIFICATION_STARTED",
    "OBJECTIVE_RESTORED",
}

_MEANINGFUL_EVENTS = {
    "EVENT_RECEIVED",
    "EVENT_INTERPRETED",
    "IMPACT_MAPPED",
    "PLAN_GENERATION_STARTED",
    "PLANNING_FAILED",
    "WORKFLOW_RESUMED",
    "PLAN_CREATED",
    "RISK_CRITIQUE_COMPLETED",
    "PLAN_REJECTED",
    "PLAN_SELECTED",
    "ALL_PLANS_INVALID",
    "BLOCKING_UNKNOWN",
    "ACTION_CLAIMED",
    "ACTION_DUPLICATE_SUPPRESSED",
    "CALENDAR_WRITE_ACKNOWLEDGED",
    "ACTION_RECEIPT_VERIFIED",
    "GITHUB_RELEASE_ACKNOWLEDGED",
    "GITHUB_RUN_PINNED",
    "OBJECTIVE_VERIFICATION_FAILED",
    *_P1D_EVENTS,
}

_EVENT_MESSAGES = {
    "EVENT_RECEIVED": "Disruption received.",
    "EVENT_INTERPRETED": "Disruption interpreted against the objective.",
    "IMPACT_MAPPED": "Affected objective path mapped.",
    "PLAN_GENERATION_STARTED": "Recovery planning started.",
    "PLANNING_FAILED": "Planning attempt failed safely and remained retryable.",
    "WORKFLOW_RESUMED": "Recovery workflow resumed from durable state.",
    "PLAN_CREATED": "A recovery future was persisted.",
    "RISK_CRITIQUE_COMPLETED": "Risk critique was persisted.",
    "PLAN_REJECTED": "A recovery future was rejected by deterministic policy.",
    "PLAN_SELECTED": "A recovery plan was selected deterministically.",
    "ACTION_CLAIMED": "An external action was claimed idempotently.",
    "CALENDAR_WRITE_ACKNOWLEDGED": "Calendar acknowledged the coordination write.",
    "ACTION_RECEIPT_VERIFIED": "External action receipt was independently verified.",
    "GITHUB_RELEASE_ACKNOWLEDGED": "GitHub acknowledged the exact release.",
    "GITHUB_RUN_PINNED": "The exact GitHub Actions run and attempt were pinned.",
    "OBJECTIVE_VERIFICATION_FAILED": (
        "The action was verified, but the objective remained unhealthy."
    ),
    "INCIDENT_REOPENED": "The failed objective reopened for another recovery.",
    "REPLAN_STARTED": "Recovery 02 replanning started from failed evidence.",
    "PLANNER_CHECKPOINTED": "Revised recovery futures were checkpointed.",
    "CRITIC_CHECKPOINTED": "The context-aware risk critique was checkpointed.",
    "POLICY_EVALUATED": "Deterministic recovery policy was evaluated.",
    "RECOVERY_SELECTED": "Recovery 02 was selected deterministically.",
    "RELEASE_VALIDATION_STARTED": "Candidate validation started.",
    "RELEASE_VALIDATION_SUCCEEDED": "Candidate validation succeeded.",
    "FULL_RELEASE_PROMOTION_STARTED": "Promotion of the validated release started.",
    "FULL_RELEASE_PROMOTION_VERIFIED": "The full latest release was independently verified.",
    "OBJECTIVE_VERIFICATION_STARTED": "Deterministic objective verification started.",
    "OBJECTIVE_RESTORED": "All required objective invariants passed.",
}

_EVENT_PHASES = {
    "EVENT_RECEIVED": EventPhase.DETECT,
    "EVENT_INTERPRETED": EventPhase.DETECT,
    "IMPACT_MAPPED": EventPhase.IMPACT,
    "PLAN_GENERATION_STARTED": EventPhase.PLAN,
    "PLANNING_FAILED": EventPhase.PLAN,
    "PLAN_CREATED": EventPhase.PLAN,
    "RISK_CRITIQUE_COMPLETED": EventPhase.PLAN,
    "PLAN_REJECTED": EventPhase.PLAN,
    "PLAN_SELECTED": EventPhase.PLAN,
    "ALL_PLANS_INVALID": EventPhase.PLAN,
    "BLOCKING_UNKNOWN": EventPhase.PLAN,
    "ACTION_CLAIMED": EventPhase.ACT,
    "ACTION_DUPLICATE_SUPPRESSED": EventPhase.SYSTEM,
    "CALENDAR_WRITE_ACKNOWLEDGED": EventPhase.ACT,
    "ACTION_RECEIPT_VERIFIED": EventPhase.ACT,
    "GITHUB_RELEASE_ACKNOWLEDGED": EventPhase.ACT,
    "GITHUB_RUN_PINNED": EventPhase.ACT,
    "OBJECTIVE_VERIFICATION_FAILED": EventPhase.VERIFY,
    "INCIDENT_REOPENED": EventPhase.REPLAN,
    "REPLAN_STARTED": EventPhase.REPLAN,
    "PLANNER_CHECKPOINTED": EventPhase.REPLAN,
    "CRITIC_CHECKPOINTED": EventPhase.REPLAN,
    "POLICY_EVALUATED": EventPhase.REPLAN,
    "RECOVERY_SELECTED": EventPhase.REPLAN,
    "RELEASE_VALIDATION_STARTED": EventPhase.ACT,
    "RELEASE_VALIDATION_SUCCEEDED": EventPhase.ACT,
    "FULL_RELEASE_PROMOTION_STARTED": EventPhase.ACT,
    "FULL_RELEASE_PROMOTION_VERIFIED": EventPhase.ACT,
    "OBJECTIVE_VERIFICATION_STARTED": EventPhase.VERIFY,
    "OBJECTIVE_RESTORED": EventPhase.RESTORED,
    "WORKFLOW_RESUMED": EventPhase.SYSTEM,
}

_SOURCE_LABELS = {
    SourceAuthority.GMAIL: "Gmail",
    SourceAuthority.GOOGLE_CALENDAR: "Google Calendar",
    SourceAuthority.GITHUB: "GitHub",
    SourceAuthority.GITHUB_ACTIONS: "GitHub Actions",
    SourceAuthority.REFLOW_VERIFIER: "Reflow deterministic verifier",
    SourceAuthority.REFLOW_POLICY: "Reflow policy",
    SourceAuthority.REFLOW_ENGINE: "Reflow engine",
    SourceAuthority.REFLOW_GRAPH: "Reflow operational graph",
    SourceAuthority.UNKNOWN: "Unknown authority",
}

_EXECUTABLE_PLAN_ACTIONS = {"github_release_validation", "calendar_coordination"}
_PROPOSAL_ONLY_PLAN_ACTIONS = {
    "assign_task",
    "reassign_task",
    "assign_work_item",
    "reassign_work_item",
}


def _as_dict(value: object) -> dict[str, Any]:
    return cast(dict[str, Any], value) if isinstance(value, dict) else {}


def _as_list(value: object) -> list[Any]:
    return value if isinstance(value, list) else []


def _iso(value: object) -> str | None:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, str):
        return value
    return None


def _bool_text(value: object) -> str | None:
    if isinstance(value, bool):
        return str(value).lower()
    if value is None:
        return None
    return str(value)


def _source_authority(value: object) -> SourceAuthority:
    normalized = str(value or "").strip().casefold().replace(" ", "_")
    aliases = {
        "gmail": SourceAuthority.GMAIL,
        "google_calendar": SourceAuthority.GOOGLE_CALENDAR,
        "calendar": SourceAuthority.GOOGLE_CALENDAR,
        "github": SourceAuthority.GITHUB,
        "github_actions": SourceAuthority.GITHUB_ACTIONS,
        "reflow_deterministic_verifier": SourceAuthority.REFLOW_VERIFIER,
        "reflow_verifier": SourceAuthority.REFLOW_VERIFIER,
        "reflow_policy": SourceAuthority.REFLOW_POLICY,
        "reflow_workflow_ledger": SourceAuthority.REFLOW_ENGINE,
        "reflow_engine": SourceAuthority.REFLOW_ENGINE,
        "reflow_graph": SourceAuthority.REFLOW_GRAPH,
    }
    return aliases.get(normalized, SourceAuthority.UNKNOWN)


def _source_label(authority: SourceAuthority) -> str:
    return _SOURCE_LABELS[authority]


def _deadline(value: object) -> datetime:
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("objective deadline must include a timezone")
    return parsed


def _source_evidence_id(incident: dict[str, Any]) -> str | None:
    disruption = _as_dict(incident.get("disruption"))
    if _source_authority(disruption.get("source")) is not SourceAuthority.GMAIL:
        return None
    return next(
        (
            str(reference)
            for reference in _as_list(disruption.get("evidence_references"))
            if str(reference).startswith("gmail-message:")
        ),
        None,
    )


def _replanning_context(revision_2: dict[str, Any] | None) -> dict[str, Any]:
    if revision_2 is None:
        return {}
    replanning = _as_dict(revision_2.get("replanning_input"))
    context = _as_dict(replanning.get("context"))
    return context or replanning


def objective_health(stage: str | None, status: str | None) -> ObjectiveHealth:
    if stage == "RESOLVED" and status == "objective_restored":
        return ObjectiveHealth.RESTORED
    if stage in {"NO_VALID_PLAN", "PLANNING_FAILED", "PARTIAL_FAILURE", "VERIFICATION_FAILED"}:
        return ObjectiveHealth.NEEDS_ATTENTION
    if stage in {
        "EVENT_RECEIVED",
        "EVENT_INTERPRETED",
        "IMPACT_MAPPED",
        "PLAN_GENERATION_STARTED",
        "PLANS_GENERATED",
        "PLANS_CRITIQUED",
        "PLAN_SELECTED",
        "EXECUTING",
        "VERIFYING",
        "REPLANNING",
        "VALIDATING",
    }:
        return ObjectiveHealth.RECOVERING
    if status in {"healthy", "verified_healthy"}:
        return ObjectiveHealth.HEALTHY
    return ObjectiveHealth.WATCHING


def workflow_stage(stage: str | None) -> WorkflowStage | None:
    mapping = {
        "EVENT_RECEIVED": WorkflowStage.DETECT,
        "EVENT_INTERPRETED": WorkflowStage.DETECT,
        "IMPACT_MAPPED": WorkflowStage.IMPACT,
        "PLAN_GENERATION_STARTED": WorkflowStage.PLAN,
        "PLANS_GENERATED": WorkflowStage.PLAN,
        "PLANS_CRITIQUED": WorkflowStage.PLAN,
        "PLANNING_FAILED": WorkflowStage.PLAN,
        "VALIDATING": WorkflowStage.PLAN,
        "PLAN_SELECTED": WorkflowStage.PLAN,
        "EXECUTING": WorkflowStage.ACT,
        "PARTIAL_FAILURE": WorkflowStage.ACT,
        "VERIFYING": WorkflowStage.VERIFY,
        "VERIFICATION_FAILED": WorkflowStage.VERIFY,
        "REPLANNING": WorkflowStage.REPLAN,
        "NO_VALID_PLAN": WorkflowStage.REPLAN,
        "RESOLVED": WorkflowStage.RESTORED,
    }
    return mapping.get(stage or "")


def _objective_id(incident: dict[str, Any]) -> str | None:
    direct = incident.get("objective_id")
    if isinstance(direct, str):
        return direct
    impact = _as_dict(incident.get("impact"))
    value = impact.get("objective_id")
    return str(value) if value is not None else None


def _recovery_number(incident: dict[str, Any]) -> int:
    active = incident.get("active_plan_revision")
    if isinstance(active, int) and active >= 2:
        return 2
    return 2 if int(incident.get("replan_count", 0) or 0) > 0 else 1


def _sort_time(value: dict[str, Any]) -> str:
    return _iso(value.get("updated_at") or value.get("created_at")) or ""


def _candidate_sha(candidate: dict[str, Any]) -> str | None:
    for action in _as_list(candidate.get("actions")):
        action_data = _as_dict(action)
        if action_data.get("action_type") != "github_release_validation":
            continue
        parameters = action_data.get("parameters")
        if isinstance(parameters, dict):
            value = parameters.get("candidate_sha")
            return str(value) if value else None
        for item in _as_list(parameters):
            parameter = _as_dict(item)
            if parameter.get("key") == "candidate_sha":
                return str(parameter.get("value"))
    return None


class PresentationService:
    def __init__(
        self,
        store: PresentationStore,
        *,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self._store = store
        self._clock = clock or (lambda: datetime.now(UTC))

    def _objective_and_incident(
        self, objective: dict[str, Any]
    ) -> tuple[dict[str, Any], dict[str, Any] | None]:
        objective_id = str(objective["objective_id"])
        matches = [
            value for value in self._store.list_incidents() if _objective_id(value) == objective_id
        ]
        latest = max(matches, key=_sort_time) if matches else None
        return objective, latest

    def _objective_summary(
        self, objective: dict[str, Any], incident: dict[str, Any] | None
    ) -> ObjectiveSummary:
        stage = str(incident.get("stage")) if incident else None
        current_status = str(incident.get("status")) if incident else None
        return ObjectiveSummary(
            objective_id=str(objective["objective_id"]),
            objective_version=int(objective["objective_version"]),
            title=str(objective["label"]),
            health=objective_health(stage, current_status),
            protected_deadline=str(objective["deadline_at_utc"]),
            deadline_timezone=str(objective["deadline_timezone"]),
            active_incident_id=(str(incident["incident_id"]) if incident else None),
            active_recovery_number=(_recovery_number(incident) if incident else None),
            workflow_stage=workflow_stage(stage),
            latest_observed_state=current_status,
            updated_at=(
                _iso(incident.get("updated_at")) if incident else _iso(objective.get("created_at"))
            ),
        )

    def objectives(self, selected_filter: ObjectiveFilter = ObjectiveFilter.ALL) -> ObjectivesView:
        values = [
            self._objective_summary(*self._objective_and_incident(objective))
            for objective in self._store.list_objectives()
        ]
        if selected_filter is ObjectiveFilter.ACTIVE:
            values = [item for item in values if item.health is not ObjectiveHealth.RESTORED]
        elif selected_filter is ObjectiveFilter.RESTORED:
            values = [item for item in values if item.health is ObjectiveHealth.RESTORED]
        incidents = self._store.list_incidents()
        revision = max((int(item.get("revision", 0) or 0) for item in incidents), default=0)
        return ObjectivesView(
            revision=revision,
            filter=selected_filter,
            items=sorted(values, key=lambda item: item.objective_id),
        )

    def overview(self) -> OverviewView:
        objectives = self.objectives()
        all_items = objectives.items
        current = next(
            (item for item in all_items if item.objective_id == "release-v2"),
            all_items[0] if all_items else None,
        )
        priority: CurrentPriority | None = None
        recent: list[ExecutionEventView] = []
        if current is not None:
            deadline = datetime.fromisoformat(current.protected_deadline.replace("Z", "+00:00"))
            remaining = max(0, int((deadline - self._clock()).total_seconds()))
            summary = self._priority_summary(current)
            priority = CurrentPriority(
                objective_id=current.objective_id,
                objective_title=current.title,
                objective_health=current.health,
                active_recovery_number=current.active_recovery_number,
                active_workflow_stage=current.workflow_stage,
                protected_deadline=current.protected_deadline,
                deadline_timezone=current.deadline_timezone,
                time_remaining_seconds=remaining if deadline > self._clock() else None,
                summary=summary,
                incident_id=current.active_incident_id,
            )
            if current.active_incident_id:
                recent = self._events(current.active_incident_id)[-8:][::-1]
        counts = ObjectiveCounts(
            active=sum(item.health is not ObjectiveHealth.RESTORED for item in all_items),
            recovering=sum(item.health is ObjectiveHealth.RECOVERING for item in all_items),
            healthy=sum(item.health is ObjectiveHealth.HEALTHY for item in all_items),
            watching_or_needs_attention=sum(
                item.health in {ObjectiveHealth.WATCHING, ObjectiveHealth.NEEDS_ATTENTION}
                for item in all_items
            ),
            restored=sum(item.health is ObjectiveHealth.RESTORED for item in all_items),
        )
        return OverviewView(
            revision=objectives.revision,
            current_priority=priority,
            objective_summary=counts,
            active_objectives=[
                item for item in all_items if item.health is not ObjectiveHealth.RESTORED
            ],
            recent_activity=recent,
        )

    @staticmethod
    def _priority_summary(value: ObjectiveSummary) -> str:
        if value.health is ObjectiveHealth.RESTORED:
            return f"{value.title} was restored after Recovery {value.active_recovery_number or 1}."
        if value.health is ObjectiveHealth.NEEDS_ATTENTION:
            return f"{value.title} has verified evidence that requires attention."
        if value.health is ObjectiveHealth.RECOVERING:
            return f"{value.title} is in an active recovery workflow."
        return f"{value.title} is being observed against its protected deadline."

    def recovery_case(self, incident_id: str) -> RecoveryCaseView:
        incident = self._store.load_incident(incident_id)
        objective_id = _objective_id(incident)
        objective = next(
            (
                item
                for item in self._store.list_objectives()
                if item.get("objective_id") == objective_id
            ),
            None,
        )
        if objective is None:
            raise KeyError(objective_id or "objective")
        revision_2 = self._store.load_plan_revision(incident_id, 2)
        event_values = self._events(incident_id)
        health = objective_health(str(incident.get("stage")), str(incident.get("status")))
        stage = workflow_stage(str(incident.get("stage"))) or WorkflowStage.DETECT
        deadline_at = str(objective["deadline_at_utc"])
        deadline = _deadline(deadline_at)
        restored_at = (
            _iso(incident.get("resolved_at") or incident.get("updated_at"))
            if health is ObjectiveHealth.RESTORED
            else None
        )
        restored_time = _deadline(restored_at) if restored_at is not None else None
        context = ObjectiveContext(
            objective_id=str(objective["objective_id"]),
            objective_version=int(
                incident.get("objective_version", objective["objective_version"])
            ),
            title=str(objective["label"]),
            health=health,
            protected_deadline=deadline_at,
            deadline_at=deadline_at,
            deadline_timezone=str(objective["deadline_timezone"]),
            time_remaining_seconds=(
                int((deadline - self._clock()).total_seconds())
                if health is not ObjectiveHealth.RESTORED
                else None
            ),
            restored_at=restored_at,
            deadline_margin_seconds=(
                int((deadline - restored_time).total_seconds())
                if restored_time is not None
                else None
            ),
            current_recovery_number=_recovery_number(incident),
            workflow_stage=stage,
            incident_stage=str(incident.get("stage", "UNKNOWN")),
            incident_status=str(incident.get("status", "unknown")),
            revision=int(incident.get("revision", 0) or 0),
            is_live=health is not ObjectiveHealth.RESTORED,
        )
        actions = self._actions(incident, revision_2)
        verifications = self._verifications(incident, revision_2)
        evidence = self._evidence(incident, revision_2, verifications)
        attempts = self._attempts(incident, revision_2, event_values, actions)
        plans = self._plans(incident, revision_2, actions)
        return RecoveryCaseView(
            revision=context.revision,
            objective=context,
            attempts=attempts,
            summary=self._summary(incident, revision_2, context),
            detect_context=self._detect_context(incident),
            replan_context=self._replan_context(incident, revision_2),
            world=self._world(incident, revision_2, health),
            plans=plans,
            actions=actions,
            verifications=verifications,
            what_changed=self._comparison(incident, revision_2, verifications),
            evidence=evidence,
        )

    def evidence_page(self, incident_id: str) -> EvidencePageView:
        case = self.recovery_case(incident_id)
        return EvidencePageView(
            incident_id=incident_id,
            revision=case.revision,
            timeline=self._events(incident_id),
            receipts=case.actions,
            verification=case.verifications,
            decisions=case.plans,
            evidence=case.evidence,
        )

    def events(self, incident_id: str, after: int = 0, limit: int = 100) -> ExecutionEventsView:
        incident = self._store.load_incident(incident_id)
        if after < 0 or limit < 1 or limit > 200:
            raise ValueError("event cursor or limit is outside the supported range")
        all_events = self._events(incident_id)
        selected = all_events[after : after + limit]
        next_cursor = str(after + len(selected))
        return ExecutionEventsView(
            incident_id=incident_id,
            revision=int(incident.get("revision", 0) or 0),
            events=selected,
            next_cursor=next_cursor,
            terminal=(
                incident.get("stage") == "RESOLVED"
                and incident.get("status") == "objective_restored"
            ),
        )

    def operator_context(self, incident_id: str) -> OperatorContextView:
        case = self.recovery_case(incident_id)
        return OperatorContextView(
            revision=case.revision,
            objective=case.objective,
            current_recovery=case.attempts[-1],
            plans=case.plans,
            evidence=case.evidence,
            verification=(case.verifications[-1] if case.verifications else None),
            events=self._events(incident_id)[-12:],
        )

    def _events(self, incident_id: str) -> list[ExecutionEventView]:
        revision_2 = self._store.load_plan_revision(incident_id, 2)
        validation = _as_dict(
            _as_dict(revision_2.get("validation_evidence")).get("evidence") if revision_2 else None
        )
        p1d_run_id = validation.get("run_id")
        raw = [
            value
            for value in self._store.list_workflow_events(incident_id)
            if value.get("event_type") in _MEANINGFUL_EVENTS
        ]
        raw.sort(
            key=lambda value: (
                _iso(value.get("occurred_at")) or "",
                str(value.get("_document_id", "")),
            )
        )
        output: list[ExecutionEventView] = []
        for sequence, value in enumerate(raw, start=1):
            event_type = str(value.get("event_type"))
            key = str(value.get("key", ""))
            details = _as_dict(value.get("details"))
            attempt = 2 if event_type in _P1D_EVENTS else 1
            if event_type == "GITHUB_RELEASE_ACKNOWLEDGED":
                tag = str(details.get("tag", key))
                attempt = 2 if tag.startswith("reflow-p1d-") else 1
            elif event_type == "GITHUB_RUN_PINNED" and details.get("run_id") == p1d_run_id:
                attempt = 2
            related = [key] if key else []
            for field in ("plan_id", "receipt_id", "release_id", "run_id", "handoff_id"):
                item = details.get(field)
                if isinstance(item, (str, int)) and str(item) not in related:
                    related.append(str(item))
            output.append(
                ExecutionEventView(
                    event_id=str(value.get("_document_id") or f"{event_type}-{sequence}"),
                    sequence=sequence,
                    cursor=str(sequence),
                    timestamp=_iso(value.get("occurred_at")) or "",
                    recovery_attempt=attempt,
                    phase=_EVENT_PHASES.get(event_type, EventPhase.SYSTEM),
                    semantic_type=event_type,
                    human_message=_EVENT_MESSAGES.get(
                        event_type, event_type.replace("_", " ").capitalize() + "."
                    ),
                    technical_summary=f"Durable {event_type} event; key={key or 'none'}.",
                    source_authority=SourceAuthority.REFLOW_ENGINE,
                    source_label=_source_label(SourceAuthority.REFLOW_ENGINE),
                    related_resource_ids=related,
                )
            )
        return output

    @staticmethod
    def _event_time(events: list[ExecutionEventView], *types: str) -> str | None:
        return next((item.timestamp for item in events if item.semantic_type in types), None)

    @staticmethod
    def _attempt_event_time(
        events: list[ExecutionEventView], attempt: int, *types: str
    ) -> str | None:
        return next(
            (
                item.timestamp
                for item in events
                if item.recovery_attempt == attempt and item.semantic_type in types
            ),
            None,
        )

    def _attempts(
        self,
        incident: dict[str, Any],
        revision_2: dict[str, Any] | None,
        events: list[ExecutionEventView],
        actions: list[ActionReceiptView],
    ) -> list[RecoveryAttemptView]:
        failed = _as_dict(incident.get("github_verification"))
        failed_check: Any = next(iter(_as_list(failed.get("checks"))), {})
        failure_reason = str(_as_dict(failed_check).get("reason", "")) or None
        if not failed.get("passed", True):
            evidence = _as_dict(incident.get("github_evidence"))
            jobs = _as_list(evidence.get("jobs"))
            failing = _as_list(_as_dict(jobs[0]).get("failing_steps")) if jobs else []
            if failing:
                failure_reason = f"{failing[0]} failed."
        first_status = (
            SemanticStatus.FAILED if failed.get("passed") is False else SemanticStatus.CURRENT
        )
        if incident.get("stage") == "RESOLVED" and not failed:
            first_status = SemanticStatus.COMPLETED
        source_evidence_id = _source_evidence_id(incident)
        first = RecoveryAttemptView(
            attempt_number=1,
            label="Recovery 01",
            status=first_status,
            candidate_sha=str(_as_dict(incident.get("github_evidence")).get("head_sha") or "")
            or None,
            selected_plan_id=(
                str(incident.get("selected_plan_id")) if incident.get("selected_plan_id") else None
            ),
            stages=[
                RecoveryStageView(
                    stage_id="recovery-1-detect",
                    semantic_kind=WorkflowStage.DETECT,
                    title="Detect",
                    subtitle="Disruption accepted into durable recovery state.",
                    status=SemanticStatus.COMPLETED,
                    timestamp=self._event_time(events, "EVENT_RECEIVED"),
                    related_evidence_ids=([source_evidence_id] if source_evidence_id else []),
                ),
                RecoveryStageView(
                    stage_id="recovery-1-impact",
                    semantic_kind=WorkflowStage.IMPACT,
                    title="Impact",
                    subtitle="Affected objective path was computed deterministically.",
                    status=SemanticStatus.COMPLETED,
                    timestamp=self._event_time(events, "IMPACT_MAPPED"),
                ),
                RecoveryStageView(
                    stage_id="recovery-1-plan",
                    semantic_kind=WorkflowStage.PLAN,
                    title="Plan",
                    subtitle="Candidate futures were critiqued and selected.",
                    status=SemanticStatus.COMPLETED,
                    timestamp=self._event_time(events, "PLAN_SELECTED"),
                ),
                RecoveryStageView(
                    stage_id="recovery-1-act",
                    semantic_kind=WorkflowStage.ACT,
                    title="Act",
                    subtitle="Calendar coordination and Candidate A validation executed.",
                    status=SemanticStatus.COMPLETED,
                    timestamp=self._attempt_event_time(events, 1, "GITHUB_RELEASE_ACKNOWLEDGED"),
                    related_evidence_ids=[
                        item.evidence_id
                        for item in actions
                        if item.recovery_attempt == 1 and item.evidence_id
                    ],
                ),
                RecoveryStageView(
                    stage_id="recovery-1-verify",
                    semantic_kind=WorkflowStage.VERIFY,
                    title="Verify",
                    subtitle="The external action was verified but CI remained unhealthy.",
                    status=(
                        SemanticStatus.FAILED
                        if failed.get("passed") is False
                        else SemanticStatus.PENDING
                    ),
                    timestamp=_iso(failed.get("observed_at")),
                    related_evidence_ids=(
                        ["objective-verification:1"]
                        if failed or incident.get("github_action_receipt_id")
                        else []
                    ),
                    failure_reason=failure_reason,
                ),
            ],
        )
        output = [first]
        if revision_2 is None:
            return output
        selection = _as_dict(
            revision_2.get("selection_reassessment") or revision_2.get("selection")
        )
        selected = _as_dict(selection.get("selected_plan"))
        terminal = incident.get("stage") == "RESOLVED"
        closed_unrecovered = (
            incident.get("stage") == "VERIFICATION_FAILED"
            and incident.get("status") == "recovery_incomplete"
        )
        second_verification = _as_dict(incident.get("final_verification"))
        second_failed_invariants = [
            str(_as_dict(check).get("invariant_id"))
            for check in _as_list(second_verification.get("checks"))
            if _as_dict(check).get("passed") is False
        ]
        current = workflow_stage(str(incident.get("stage")))

        def status_for(kind: WorkflowStage) -> SemanticStatus:
            order = [
                WorkflowStage.REPLAN,
                WorkflowStage.PLAN,
                WorkflowStage.ACT,
                WorkflowStage.VERIFY,
                WorkflowStage.RESTORED,
            ]
            if terminal:
                return SemanticStatus.COMPLETED
            if closed_unrecovered:
                if kind is WorkflowStage.VERIFY:
                    return SemanticStatus.FAILED
                if kind is WorkflowStage.RESTORED:
                    return SemanticStatus.UNAVAILABLE
                return SemanticStatus.COMPLETED
            if current == kind:
                return SemanticStatus.CURRENT
            if current in order and order.index(kind) < order.index(current):
                return SemanticStatus.COMPLETED
            return SemanticStatus.PENDING

        output.append(
            RecoveryAttemptView(
                attempt_number=2,
                label="Recovery 02",
                status=(
                    SemanticStatus.COMPLETED
                    if terminal
                    else SemanticStatus.FAILED
                    if closed_unrecovered
                    else SemanticStatus.CURRENT
                ),
                branch_from_attempt=1,
                branch_reason=(
                    "Recovery 01 was action-verified, but release-validation-green was false."
                ),
                candidate_sha=_candidate_sha(selected),
                selected_plan_id=(str(selected.get("plan_id")) if selected else None),
                stages=[
                    RecoveryStageView(
                        stage_id="recovery-2-replan",
                        semantic_kind=WorkflowStage.REPLAN,
                        title="Replan",
                        subtitle="Failed Recovery 01 evidence became the new planning context.",
                        status=status_for(WorkflowStage.REPLAN),
                        timestamp=self._event_time(events, "REPLAN_STARTED"),
                        related_evidence_ids=["objective-verification:1"],
                    ),
                    RecoveryStageView(
                        stage_id="recovery-2-plan",
                        semantic_kind=WorkflowStage.PLAN,
                        title="Plan",
                        subtitle="Revised futures passed deterministic selection.",
                        status=status_for(WorkflowStage.PLAN),
                        timestamp=self._event_time(events, "RECOVERY_SELECTED"),
                    ),
                    RecoveryStageView(
                        stage_id="recovery-2-act",
                        semantic_kind=WorkflowStage.ACT,
                        title="Act",
                        subtitle="Candidate B validation and full-release promotion executed.",
                        status=status_for(WorkflowStage.ACT),
                        timestamp=self._attempt_event_time(
                            events, 2, "GITHUB_RELEASE_ACKNOWLEDGED"
                        ),
                        related_evidence_ids=[
                            item.evidence_id
                            for item in actions
                            if item.recovery_attempt == 2 and item.evidence_id
                        ],
                    ),
                    RecoveryStageView(
                        stage_id="recovery-2-verify",
                        semantic_kind=WorkflowStage.VERIFY,
                        title="Verification failed" if closed_unrecovered else "Verify",
                        subtitle=(
                            "Objective invariants were evaluated and rejected the objective."
                            if closed_unrecovered
                            else "External evidence was read back and objective invariants "
                            "evaluated."
                        ),
                        status=status_for(WorkflowStage.VERIFY),
                        timestamp=(
                            _iso(second_verification.get("observed_at"))
                            if closed_unrecovered
                            else None
                        )
                        or self._event_time(
                            events,
                            "OBJECTIVE_VERIFICATION_FAILED"
                            if closed_unrecovered
                            else "OBJECTIVE_VERIFICATION_STARTED",
                        )
                        or self._event_time(events, "OBJECTIVE_VERIFICATION_STARTED"),
                        related_evidence_ids=["objective-verification:2"],
                        failure_reason=(
                            f"{', '.join(second_failed_invariants)} did not hold."
                            if closed_unrecovered and second_failed_invariants
                            else None
                        ),
                    ),
                    RecoveryStageView(
                        stage_id="recovery-2-restored",
                        semantic_kind=WorkflowStage.RESTORED,
                        title="Restored",
                        subtitle=(
                            "The objective was not restored by this recovery."
                            if closed_unrecovered
                            else "All required objective invariants passed."
                        ),
                        status=status_for(WorkflowStage.RESTORED),
                        timestamp=self._event_time(events, "OBJECTIVE_RESTORED"),
                    ),
                ],
            )
        )
        return output

    def _plans(
        self,
        incident: dict[str, Any],
        revision_2: dict[str, Any] | None,
        actions: list[ActionReceiptView],
    ) -> list[RecoveryPlanView]:
        output = self._plan_group(
            candidates=_as_list(
                _as_dict(_as_dict(incident.get("planning_run")).get("candidates")).get("plans")
            ),
            critiques=_as_list(
                _as_dict(_as_dict(incident.get("planning_run")).get("critiques")).get("critiques")
            ),
            decisions=_as_list(incident.get("policy_decisions")),
            selected_plan_id=(
                str(incident.get("selected_plan_id")) if incident.get("selected_plan_id") else None
            ),
            revision=1,
            executed_actions=[item for item in actions if item.recovery_attempt == 1],
        )
        if revision_2 is None:
            return output
        planner = _as_dict(revision_2.get("planner_checkpoint"))
        critic = _as_dict(revision_2.get("critic_checkpoint"))
        selection = _as_dict(
            revision_2.get("selection_reassessment") or revision_2.get("selection")
        )
        selected = _as_dict(selection.get("selected_plan"))
        output.extend(
            self._plan_group(
                candidates=_as_list(_as_dict(planner.get("candidates")).get("plans")),
                critiques=_as_list(_as_dict(critic.get("critiques")).get("critiques")),
                decisions=_as_list(selection.get("policy_decisions")),
                selected_plan_id=(str(selected.get("plan_id")) if selected else None),
                revision=2,
                executed_actions=[item for item in actions if item.recovery_attempt == 2],
            )
        )
        return output

    @staticmethod
    def _plan_group(
        *,
        candidates: list[Any],
        critiques: list[Any],
        decisions: list[Any],
        selected_plan_id: str | None,
        revision: int,
        executed_actions: list[ActionReceiptView],
    ) -> list[RecoveryPlanView]:
        critique_by_id = {str(_as_dict(item).get("plan_id")): _as_dict(item) for item in critiques}
        decision_by_id = {str(_as_dict(item).get("plan_id")): _as_dict(item) for item in decisions}
        output: list[RecoveryPlanView] = []
        for raw in candidates:
            candidate = _as_dict(raw)
            plan_id = str(candidate.get("plan_id"))
            strategy = str(candidate.get("strategy_type", "recovery"))
            critique = critique_by_id.get(plan_id, {})
            decision = decision_by_id.get(plan_id)
            policy: PolicyDecisionView | None = None
            valid: bool | None = None
            rejection: str | None = None
            if decision is not None:
                violations = [
                    PolicyViolationView(
                        rule_id=str(_as_dict(item).get("rule_id", "unknown")),
                        message=str(_as_dict(item).get("message", "Policy rejected the plan.")),
                    )
                    for item in _as_list(decision.get("violations"))
                ]
                valid = bool(decision.get("is_valid"))
                rejection = "; ".join(item.message for item in violations) or None
                policy = PolicyDecisionView(
                    plan_id=plan_id,
                    valid=valid,
                    blocking_unknowns=[
                        str(item) for item in _as_list(decision.get("blocking_unknowns"))
                    ],
                    violations=violations,
                )
            assumptions = [
                str(_as_dict(item).get("description"))
                for item in _as_list(candidate.get("assumptions"))
                if _as_dict(item).get("description")
            ]
            assumptions.extend(
                f"Unknown: {_as_dict(item).get('description')}"
                for item in _as_list(candidate.get("unknowns"))
                if _as_dict(item).get("description")
            )
            action_summaries = []
            action_views: list[PlanActionView] = []
            for item in _as_list(candidate.get("actions")):
                action = _as_dict(item)
                action_id = str(action.get("action_id", "unknown"))
                kind = str(action.get("action_type", "action"))
                target = str(action.get("target", "unknown"))
                action_summaries.append(
                    f"{action.get('action_type', 'action')} → {action.get('target', 'unknown')}"
                )
                receipt = next(
                    (item for item in executed_actions if item.action_id == action_id),
                    None,
                )
                if receipt is None and kind == "github_release_validation":
                    candidates = [
                        item for item in executed_actions if item.kind == "candidate_validation"
                    ]
                    receipt = candidates[0] if len(candidates) == 1 else None
                selected_and_valid = plan_id == selected_plan_id and valid is not False
                if kind in _PROPOSAL_ONLY_PLAN_ACTIONS or not selected_and_valid:
                    disposition = PlanActionDisposition.PROPOSAL_ONLY
                elif kind in _EXECUTABLE_PLAN_ACTIONS and receipt is not None:
                    disposition = (
                        PlanActionDisposition.EXECUTED
                        if receipt.write_acknowledged
                        else PlanActionDisposition.EXECUTABLE
                    )
                elif kind in _EXECUTABLE_PLAN_ACTIONS:
                    disposition = PlanActionDisposition.EXECUTABLE
                else:
                    disposition = PlanActionDisposition.PROPOSAL_ONLY
                action_views.append(
                    PlanActionView(
                        action_id=action_id,
                        kind=kind,
                        target=target,
                        disposition=disposition,
                        execution_evidence_id=(
                            receipt.evidence_id
                            if disposition is PlanActionDisposition.EXECUTED and receipt is not None
                            else None
                        ),
                    )
                )
            score = critique.get("adjusted_risk_score", candidate.get("initial_risk_score"))
            output.append(
                RecoveryPlanView(
                    plan_id=plan_id,
                    title=strategy.replace("-", " ").title(),
                    revision=revision,
                    recovery_attempt=revision,
                    candidate_sha=_candidate_sha(candidate),
                    risk_score=(
                        int(score)
                        if isinstance(score, (int, str)) and str(score).isdigit()
                        else None
                    ),
                    selected=plan_id == selected_plan_id,
                    valid=valid,
                    deterministic_rejection_reason=rejection,
                    policy=policy,
                    assumptions_summary=assumptions,
                    proposed_action_summary=action_summaries,
                    actions=action_views,
                    critic_summary=(
                        str(critique.get("verdict_summary"))
                        if critique.get("verdict_summary")
                        else None
                    ),
                )
            )
        return output

    def _actions(
        self, incident: dict[str, Any], revision_2: dict[str, Any] | None
    ) -> list[ActionReceiptView]:
        output: list[ActionReceiptView] = []
        calendar_receipt = incident.get("action_receipt_id")
        if isinstance(calendar_receipt, str):
            output.append(
                self._action_view(
                    calendar_receipt,
                    attempt=1,
                    kind="calendar_coordination",
                    desired="Create a private recovery coordination block.",
                    outcome=VerificationStatus.PASSED,
                    evidence_id=f"calendar:{calendar_receipt}",
                )
            )
        github_receipt = incident.get("github_action_receipt_id")
        if isinstance(github_receipt, str):
            github_evidence = _as_dict(incident.get("github_evidence"))
            passed = _as_dict(incident.get("github_verification")).get("passed")
            output.append(
                self._action_view(
                    github_receipt,
                    attempt=1,
                    kind="candidate_validation",
                    desired=(
                        "Create/adopt Candidate A prerelease and validate its exact workflow run."
                    ),
                    outcome=(
                        VerificationStatus.PASSED if passed is True else VerificationStatus.FAILED
                    ),
                    evidence_id=f"github-run:{github_evidence.get('run_id')}",
                )
            )
        if revision_2 is None:
            return output
        validation = _as_dict(revision_2.get("validation_evidence"))
        validation_receipt = validation.get("receipt_id")
        if isinstance(validation_receipt, str):
            evidence = _as_dict(validation.get("evidence"))
            output.append(
                self._action_view(
                    validation_receipt,
                    attempt=2,
                    kind="candidate_validation",
                    desired=(
                        "Create/adopt Candidate B prerelease and validate its exact workflow run."
                    ),
                    outcome=(
                        VerificationStatus.PASSED
                        if evidence.get("conclusion") == "success"
                        else VerificationStatus.FAILED
                    ),
                    evidence_id=f"github-run:{evidence.get('run_id')}",
                )
            )
        promotion = _as_dict(revision_2.get("promotion_evidence"))
        promotion_receipt = promotion.get("receipt_id")
        if isinstance(promotion_receipt, str):
            evidence = _as_dict(promotion.get("evidence"))
            promoted = (
                evidence.get("draft") is False
                and evidence.get("prerelease") is False
                and evidence.get("release_id") == evidence.get("latest_release_id")
            )
            output.append(
                self._action_view(
                    promotion_receipt,
                    attempt=2,
                    kind="full_release_promotion",
                    desired=(
                        "Promote the exact validated Candidate B release to latest full release."
                    ),
                    outcome=(VerificationStatus.PASSED if promoted else VerificationStatus.FAILED),
                    evidence_id=f"github-promotion:{evidence.get('release_id')}",
                )
            )
        return output

    def _action_view(
        self,
        receipt_id: str,
        *,
        attempt: int,
        kind: str,
        desired: str,
        outcome: VerificationStatus,
        evidence_id: str,
    ) -> ActionReceiptView:
        loaded = self._store.load_action_evidence(receipt_id)
        if loaded is None:
            return ActionReceiptView(
                action_id=receipt_id,
                receipt_id=receipt_id,
                recovery_attempt=attempt,
                kind=kind,
                system=SourceAuthority.UNKNOWN,
                system_label=_source_label(SourceAuthority.UNKNOWN),
                desired_state_summary=desired,
                receipt_status=ReceiptStatusView.PENDING,
                write_acknowledged=False,
                read_back_completed=False,
                verification_state=VerificationStatus.UNAVAILABLE,
                evidence_id=evidence_id,
            )
        claim, receipt = loaded
        status_value = str(receipt.get("status", "pending"))
        write_at = _iso(receipt.get("write_acknowledged_at"))
        read_at = _iso(receipt.get("read_back_at") or receipt.get("observed_at"))
        if status_value == "verified":
            receipt_status = ReceiptStatusView.VERIFIED
        elif write_at:
            receipt_status = ReceiptStatusView.WRITE_ACKNOWLEDGED
        else:
            receipt_status = ReceiptStatusView.PENDING
        intent = _as_dict(claim.get("intent"))
        action = _as_dict(intent.get("action"))
        authority = _source_authority(receipt.get("tool"))
        return ActionReceiptView(
            action_id=str(action.get("action_id") or receipt.get("action_id") or receipt_id),
            receipt_id=receipt_id,
            recovery_attempt=attempt,
            kind=kind,
            system=authority,
            system_label=_source_label(authority),
            desired_state_summary=desired,
            receipt_status=receipt_status,
            write_acknowledged=write_at is not None,
            write_acknowledged_at=write_at,
            read_back_completed=read_at is not None,
            read_back_at=read_at,
            external_reference=(
                str(receipt["external_reference"]) if receipt.get("external_reference") else None
            ),
            verification_state=outcome,
            evidence_id=evidence_id,
        )

    def _verifications(
        self, incident: dict[str, Any], revision_2: dict[str, Any] | None
    ) -> list[VerificationView]:
        output: list[VerificationView] = []
        first = incident.get("github_verification")
        if isinstance(first, dict):
            output.append(self._verification_view(first, attempt=1, verification_id="recovery-1"))
        elif incident.get("github_action_receipt_id"):
            unavailable = bool(incident.get("external_evidence_unavailable"))
            output.append(
                self._pending_verification(
                    objective_id="release-v2",
                    attempt=1,
                    invariant_ids=["release-validation-green"],
                    unavailable=unavailable,
                )
            )
        final = incident.get("final_verification")
        if isinstance(final, dict):
            output.append(self._verification_view(final, attempt=2, verification_id="recovery-2"))
        elif revision_2 is not None:
            unavailable = bool(incident.get("external_evidence_unavailable"))
            replanning = _replanning_context(revision_2)
            expected = [str(item) for item in _as_list(replanning.get("objective_invariants"))]
            if not expected:
                raise ValueError(
                    "P1D presentation cannot expose pending verification without persisted "
                    "objective invariants"
                )
            output.append(
                self._pending_verification(
                    objective_id=str(
                        _as_dict(replanning.get("objective")).get("objective_id", "release-v2")
                    ),
                    attempt=2,
                    invariant_ids=expected,
                    unavailable=unavailable,
                )
            )
        return output

    @staticmethod
    def _pending_verification(
        *, objective_id: str, attempt: int, invariant_ids: list[str], unavailable: bool
    ) -> VerificationView:
        verification_id = f"recovery-{attempt}"
        status = VerificationStatus.UNAVAILABLE if unavailable else VerificationStatus.PENDING
        return VerificationView(
            verification_id=verification_id,
            recovery_attempt=attempt,
            objective_id=objective_id,
            status=status,
            invariants=[
                VerificationInvariantView(
                    invariant_id=invariant_id,
                    expected="true",
                    observed=None,
                    status=status,
                    evidence_provenance="persisted deterministic objective-verifier specification",
                    evidence_id=f"objective-verification:{attempt}",
                    reason=(
                        "Authoritative observation is unavailable."
                        if unavailable
                        else "Awaiting deterministic objective verification."
                    ),
                )
                for invariant_id in invariant_ids
            ],
        )

    @staticmethod
    def _verification_view(
        value: dict[str, Any], *, attempt: int, verification_id: str
    ) -> VerificationView:
        passed = value.get("passed")
        status = (
            VerificationStatus.PASSED
            if passed is True
            else VerificationStatus.FAILED
            if passed is False
            else VerificationStatus.PENDING
        )
        checks: list[VerificationInvariantView] = []
        for raw in _as_list(value.get("checks")):
            check = _as_dict(raw)
            observed = check.get("passed")
            checks.append(
                VerificationInvariantView(
                    invariant_id=str(check.get("invariant_id", "unknown")),
                    expected="true",
                    observed=_bool_text(observed),
                    status=(
                        VerificationStatus.PASSED
                        if observed is True
                        else VerificationStatus.FAILED
                        if observed is False
                        else VerificationStatus.PENDING
                    ),
                    evidence_provenance=(
                        str(check["source_reference"]) if check.get("source_reference") else None
                    ),
                    evidence_id=f"objective-verification:{attempt}",
                    reason=(str(check["reason"]) if check.get("reason") else None),
                )
            )
        return VerificationView(
            verification_id=verification_id,
            recovery_attempt=attempt,
            objective_id=str(value.get("objective_id", "release-v2")),
            status=status,
            observed_at=_iso(value.get("observed_at")),
            invariants=checks,
        )

    def _evidence(
        self,
        incident: dict[str, Any],
        revision_2: dict[str, Any] | None,
        verifications: list[VerificationView],
    ) -> list[EvidenceView]:
        output: list[EvidenceView] = []
        disruption = _as_dict(incident.get("disruption"))
        source_evidence_id = _source_evidence_id(incident)
        if source_evidence_id is not None:
            references = [str(item) for item in _as_list(disruption.get("evidence_references"))]
            content_hash = next(
                (item.removeprefix("sha256:") for item in references if item.startswith("sha256:")),
                "",
            )
            output.append(
                EvidenceView(
                    evidence_id=source_evidence_id,
                    recovery_attempt=1,
                    source_system=SourceAuthority.GMAIL,
                    source_label=_source_label(SourceAuthority.GMAIL),
                    evidence_kind="disruption_source",
                    title="Gmail disruption source",
                    semantic_status=EvidenceSemanticStatus.VERIFIED_HEALTHY,
                    observed_at=_iso(disruption.get("occurred_at")),
                    summary=str(disruption.get("summary", "Gmail disruption accepted.")),
                    proof_fields={
                        "message_id": source_evidence_id.removeprefix("gmail-message:"),
                        "content_sha256": content_hash,
                        "disruption_type": str(disruption.get("event_type", "unknown")),
                        "affected_resource_count": len(
                            _as_list(disruption.get("disrupted_node_ids"))
                        ),
                    },
                )
            )
        calendar_receipt = incident.get("action_receipt_id")
        if isinstance(calendar_receipt, str):
            loaded = self._store.load_action_evidence(calendar_receipt)
            receipt = loaded[1] if loaded else {}
            observed = _as_dict(receipt.get("observed_state"))
            output.append(
                EvidenceView(
                    evidence_id=f"calendar:{calendar_receipt}",
                    recovery_attempt=1,
                    source_system=SourceAuthority.GOOGLE_CALENDAR,
                    source_label=_source_label(SourceAuthority.GOOGLE_CALENDAR),
                    evidence_kind="external_read_back",
                    title="Recovery coordination preserved",
                    semantic_status=(
                        EvidenceSemanticStatus.VERIFIED_HEALTHY
                        if receipt.get("status") == "verified"
                        else EvidenceSemanticStatus.PENDING
                    ),
                    external_reference=(
                        str(receipt["external_reference"])
                        if receipt.get("external_reference")
                        else None
                    ),
                    observed_at=_iso(receipt.get("observed_at")),
                    summary="The private coordination event was independently read back.",
                    proof_fields={
                        "event_id": str(observed.get("event_id", "")),
                        "status": str(observed.get("status", "unknown")),
                    },
                )
            )
        github_a = _as_dict(incident.get("github_evidence"))
        if github_a:
            output.append(self._github_evidence(github_a, attempt=1))
        if revision_2 is not None:
            validation = _as_dict(_as_dict(revision_2.get("validation_evidence")).get("evidence"))
            if validation:
                output.append(self._github_evidence(validation, attempt=2))
            promotion = _as_dict(_as_dict(revision_2.get("promotion_evidence")).get("evidence"))
            if promotion:
                healthy = (
                    promotion.get("draft") is False
                    and promotion.get("prerelease") is False
                    and promotion.get("release_id") == promotion.get("latest_release_id")
                )
                output.append(
                    EvidenceView(
                        evidence_id=f"github-promotion:{promotion.get('release_id')}",
                        recovery_attempt=2,
                        source_system=SourceAuthority.GITHUB,
                        source_label=_source_label(SourceAuthority.GITHUB),
                        evidence_kind="full_release_read_back",
                        title="Validated release promoted to full latest release",
                        semantic_status=(
                            EvidenceSemanticStatus.VERIFIED_HEALTHY
                            if healthy
                            else EvidenceSemanticStatus.VERIFIED_UNHEALTHY
                        ),
                        external_reference=(
                            str(promotion["release_url"]) if promotion.get("release_url") else None
                        ),
                        observed_at=_iso(promotion.get("read_back_at")),
                        summary="The exact validated release was read back after promotion.",
                        proof_fields={
                            "release_id": cast(int, promotion.get("release_id")),
                            "latest_release_id": cast(int, promotion.get("latest_release_id")),
                            "draft": cast(bool, promotion.get("draft")),
                            "prerelease": cast(bool, promotion.get("prerelease")),
                            "candidate_sha": str(promotion.get("tag_sha", "")),
                        },
                    )
                )
        for verification in verifications:
            output.append(
                EvidenceView(
                    evidence_id=f"objective-verification:{verification.recovery_attempt}",
                    recovery_attempt=verification.recovery_attempt,
                    source_system=SourceAuthority.REFLOW_VERIFIER,
                    source_label=_source_label(SourceAuthority.REFLOW_VERIFIER),
                    evidence_kind="objective_verification",
                    title=f"Recovery {verification.recovery_attempt:02d} objective verification",
                    semantic_status=(
                        EvidenceSemanticStatus.VERIFIED_HEALTHY
                        if verification.status is VerificationStatus.PASSED
                        else EvidenceSemanticStatus.VERIFIED_UNHEALTHY
                        if verification.status is VerificationStatus.FAILED
                        else EvidenceSemanticStatus.UNAVAILABLE
                        if verification.status is VerificationStatus.UNAVAILABLE
                        else EvidenceSemanticStatus.PENDING
                    ),
                    observed_at=verification.observed_at,
                    summary=(
                        "All required objective invariants passed."
                        if verification.status is VerificationStatus.PASSED
                        else "At least one required objective invariant failed."
                        if verification.status is VerificationStatus.FAILED
                        else "Objective verification has not produced authoritative evidence yet."
                    ),
                    proof_fields={
                        "status": verification.status.value,
                        "invariant_count": len(verification.invariants),
                    },
                )
            )
        return output

    @staticmethod
    def _github_evidence(value: dict[str, Any], *, attempt: int) -> EvidenceView:
        conclusion = str(value.get("conclusion", "pending"))
        if conclusion == "success":
            semantic = EvidenceSemanticStatus.VERIFIED_HEALTHY
        elif conclusion == "failure":
            semantic = EvidenceSemanticStatus.VERIFIED_UNHEALTHY
        else:
            semantic = EvidenceSemanticStatus.PENDING
        run_id = value.get("run_id")
        return EvidenceView(
            evidence_id=f"github-run:{run_id}",
            recovery_attempt=attempt,
            source_system=SourceAuthority.GITHUB_ACTIONS,
            source_label=_source_label(SourceAuthority.GITHUB_ACTIONS),
            evidence_kind="workflow_run_read_back",
            title=f"Candidate validation run {run_id}",
            semantic_status=semantic,
            external_reference=(str(value["run_url"]) if value.get("run_url") else None),
            observed_at=_iso(value.get("read_back_at") or value.get("completed_at")),
            summary=f"Exact pinned run completed with conclusion {conclusion}.",
            proof_fields={
                "release_id": cast(int, value.get("release_id")),
                "run_id": cast(int, run_id),
                "run_attempt": cast(int, value.get("run_attempt")),
                "candidate_sha": str(value.get("head_sha", "")),
                "workflow_id": cast(int, value.get("workflow_id")),
                "workflow_path": str(value.get("workflow_path", "")),
                "conclusion": conclusion,
            },
        )

    @staticmethod
    def _detect_context(incident: dict[str, Any]) -> DetectContextView:
        disruption = _as_dict(incident.get("disruption"))
        authority = _source_authority(disruption.get("source"))
        return DetectContextView(
            source_system=authority,
            source_label=_source_label(authority),
            source_evidence_id=_source_evidence_id(incident),
            occurred_at=_iso(disruption.get("occurred_at")),
            disruption_type=str(disruption.get("event_type", "unknown")),
            bounded_summary=str(
                disruption.get("summary") or "A disruption affected the protected objective."
            ),
            affected_resource_ids=[
                str(item) for item in _as_list(disruption.get("disrupted_node_ids"))
            ],
        )

    @staticmethod
    def _replan_context(
        incident: dict[str, Any], revision_2: dict[str, Any] | None
    ) -> ReplanContextView | None:
        if revision_2 is None:
            return None
        replanning = _replanning_context(revision_2)
        failed_invariant = str(replanning.get("failed_invariant_id", "release-validation-green"))
        effects = [_as_dict(item) for item in _as_list(replanning.get("failed_recovery_effects"))]
        wrapper = _as_dict(revision_2.get("replanning_input"))
        failed_sha = str(
            replanning.get("failed_candidate_sha")
            or _as_dict(incident.get("github_evidence")).get("head_sha")
            or "unknown"
        )
        return ReplanContextView(
            recovery_attempt=2,
            prior_attempt=1,
            failed_invariant_id=failed_invariant,
            failed_evidence_id="objective-verification:1",
            replanning_input_summary=(
                f"Recovery 01 candidate {failed_sha} left {failed_invariant} false."
            ),
            changed_context_summary=(
                "The failed external effect was excluded and immutable revised candidates became "
                "the eligible planning context."
            ),
            replanning_input_fingerprint=(
                str(wrapper["fingerprint"]) if wrapper.get("fingerprint") else None
            ),
            failed_effect_fingerprint=(
                str(effects[0].get("fingerprint"))
                if effects and effects[0].get("fingerprint")
                else None
            ),
        )

    @staticmethod
    def _summary(
        incident: dict[str, Any],
        revision_2: dict[str, Any] | None,
        context: ObjectiveContext,
    ) -> RecoverySummary:
        disruption = _as_dict(incident.get("disruption"))
        happened = str(disruption.get("summary") or "A disruption affected the objective.")
        if revision_2 is None:
            return RecoverySummary(what_happened=happened)
        failed = _as_dict(incident.get("github_verification"))
        why = (
            "Recovery 01 completed its external action, but exact CI evidence left "
            "release-validation-green false."
            if failed.get("passed") is False
            else "Recovery 02 exists because the prior recovery did not restore every invariant."
        )
        if context.health is ObjectiveHealth.RESTORED:
            changed = (
                "Recovery 02 replaced the failed candidate with an immutable revised candidate, "
                "validated it, and promoted that exact release to full/latest."
            )
        elif (
            context.incident_stage == "VERIFICATION_FAILED"
            and context.incident_status == "recovery_incomplete"
        ):
            changed = (
                "Recovery 02 executed and was read back, but objective verification completed "
                "and rejected the objective."
            )
        else:
            changed = (
                "Recovery 02 uses a materially revised candidate and new external "
                "action identities."
            )
        return RecoverySummary(
            what_happened=happened,
            why_current_recovery_exists=why,
            what_changed=changed,
        )

    @staticmethod
    def _world(
        incident: dict[str, Any],
        revision_2: dict[str, Any] | None,
        health: ObjectiveHealth,
    ) -> OperationalGraphView:
        snapshot: dict[str, Any] = {}
        if revision_2 is not None:
            replanning = _as_dict(revision_2.get("replanning_input"))
            context = _as_dict(replanning.get("context"))
            snapshot = _as_dict(context.get("objective_graph"))
        if not snapshot:
            snapshot = cast(dict[str, Any], objective_graph_snapshot())
        impact = _as_dict(incident.get("impact"))
        affected = {str(item) for item in _as_list(impact.get("affected_node_ids"))}
        critical = {
            "release-v2",
            "commit-release",
            "milestone-backend",
            "work-api-migration",
        }
        disrupted = {
            str(item)
            for item in _as_list(_as_dict(incident.get("disruption")).get("disrupted_node_ids"))
        }
        nodes = []
        for raw in _as_list(snapshot.get("nodes")):
            node = _as_dict(raw)
            node_id = str(node.get("node_id"))
            state = (
                health.value.lower()
                if node_id == "release-v2"
                else "disrupted"
                if node_id in disrupted
                else "stable"
            )
            nodes.append(
                GraphNodeView(
                    node_id=node_id,
                    label=str(node.get("label", node_id)),
                    kind=str(node.get("kind", "unknown")),
                    state=state,
                    affected=node_id in affected,
                    critical_path=node_id in critical,
                )
            )
        edges = [
            GraphEdgeView(
                source=str(_as_dict(raw).get("source_id")),
                target=str(_as_dict(raw).get("target_id")),
                relation=str(_as_dict(raw).get("relation", "depends_on")),
            )
            for raw in _as_list(snapshot.get("edges"))
        ]
        return OperationalGraphView(nodes=nodes, edges=edges)

    @staticmethod
    def _comparison(
        incident: dict[str, Any],
        revision_2: dict[str, Any] | None,
        verifications: list[VerificationView],
    ) -> list[AttemptComparisonItem]:
        if revision_2 is None:
            return []
        a = _as_dict(incident.get("github_evidence"))
        validation = _as_dict(_as_dict(revision_2.get("validation_evidence")).get("evidence"))
        promotion = _as_dict(_as_dict(revision_2.get("promotion_evidence")).get("evidence"))
        first_verification = next(
            (item for item in verifications if item.recovery_attempt == 1), None
        )
        second_verification = next(
            (item for item in verifications if item.recovery_attempt == 2), None
        )
        return [
            AttemptComparisonItem(
                field="candidate",
                recovery_1=(str(a.get("head_sha")) if a.get("head_sha") else None),
                recovery_2=(
                    str(validation.get("head_sha")) if validation.get("head_sha") else None
                ),
            ),
            AttemptComparisonItem(
                field="CI result",
                recovery_1=(str(a.get("conclusion")) if a.get("conclusion") else None),
                recovery_2=(
                    str(validation.get("conclusion")) if validation.get("conclusion") else None
                ),
            ),
            AttemptComparisonItem(
                field="coordination state",
                recovery_1="verified",
                recovery_2=(
                    "preserved by fresh read-back"
                    if revision_2.get("calendar_closure_evidence")
                    else None
                ),
            ),
            AttemptComparisonItem(
                field="objective result",
                recovery_1=(first_verification.status.value if first_verification else None),
                recovery_2=(second_verification.status.value if second_verification else None),
            ),
            AttemptComparisonItem(
                field="release state",
                recovery_1="prerelease",
                recovery_2=(
                    "full latest release"
                    if promotion.get("prerelease") is False
                    and promotion.get("release_id") == promotion.get("latest_release_id")
                    else None
                ),
            ),
        ]
