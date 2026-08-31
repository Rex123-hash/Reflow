"""Canonical P1A operational world and deterministic policy configuration."""

from __future__ import annotations

from datetime import UTC, datetime

from objective_recovery.domain.graph import OperationalGraph
from objective_recovery.domain.models import NodeKind, OperationalEdge, OperationalNode
from objective_recovery.domain.policy import (
    MaxWorkloadPolicy,
    PolicyEngine,
    ProtectedDeadlinePolicy,
    RequiredSkillsPolicy,
)
from objective_recovery_agent.objective_store import CANONICAL_OBJECTIVE
from objective_recovery_agent.schemas import (
    DisruptionEvent,
    ObjectiveRecord,
    PlanningInput,
    ResourceOption,
)

OBJECTIVE_ID = "release-v2"
PROTECTED_DEADLINE = datetime(2026, 8, 28, 17, tzinfo=UTC)

_NODES = (
    OperationalNode(OBJECTIVE_ID, NodeKind.OBJECTIVE, "Ship Release V2 by Friday 5 PM"),
    OperationalNode("commit-release", NodeKind.COMMITMENT, "Protected Friday release"),
    OperationalNode("milestone-backend", NodeKind.MILESTONE, "Backend release readiness"),
    OperationalNode("work-api-migration", NodeKind.WORK_ITEM, "Complete API migration"),
    OperationalNode("work-api-tests", NodeKind.WORK_ITEM, "Complete API regression tests"),
    OperationalNode("work-release-notes", NodeKind.WORK_ITEM, "Prepare release notes"),
    OperationalNode("person-backend-lead", NodeKind.PERSON, "Lead backend engineer"),
    OperationalNode("person-backup", NodeKind.PERSON, "Backup backend engineer"),
    OperationalNode("person-generalist", NodeKind.PERSON, "Product generalist"),
    OperationalNode("person-qa", NodeKind.PERSON, "QA engineer"),
)

_EDGES = (
    OperationalEdge(OBJECTIVE_ID, "commit-release"),
    OperationalEdge("commit-release", "milestone-backend"),
    OperationalEdge("milestone-backend", "work-api-migration"),
    OperationalEdge("milestone-backend", "work-api-tests"),
    OperationalEdge("milestone-backend", "work-release-notes"),
    OperationalEdge("work-api-migration", "person-backend-lead"),
    OperationalEdge("work-api-tests", "person-qa"),
    OperationalEdge("work-release-notes", "person-generalist"),
)

RESOURCES = (
    ResourceOption(
        person_id="person-backup",
        skills=["python", "api"],
        current_load_percent=55,
    ),
    ResourceOption(
        person_id="person-generalist",
        skills=["release", "documentation"],
        current_load_percent=70,
    ),
    ResourceOption(
        person_id="person-qa",
        skills=["qa", "python"],
        current_load_percent=60,
    ),
)


def build_graph(objective: ObjectiveRecord = CANONICAL_OBJECTIVE) -> OperationalGraph:
    graph = OperationalGraph()
    for node in _NODES:
        graph.add_node(
            OperationalNode(objective.objective_id, node.kind, objective.label)
            if node.node_id == OBJECTIVE_ID
            else node
        )
    for edge in _EDGES:
        graph.add_edge(
            OperationalEdge(objective.objective_id, edge.target_id, edge.relation)
            if edge.source_id == OBJECTIVE_ID
            else edge
        )
    return graph


def objective_graph_snapshot(objective: ObjectiveRecord = CANONICAL_OBJECTIVE) -> dict[str, object]:
    return {
        "nodes": [
            {
                "node_id": objective.objective_id if node.node_id == OBJECTIVE_ID else node.node_id,
                "kind": node.kind.value,
                "label": objective.label if node.node_id == OBJECTIVE_ID else node.label,
            }
            for node in _NODES
        ],
        "edges": [
            {
                "source_id": (
                    objective.objective_id if edge.source_id == OBJECTIVE_ID else edge.source_id
                ),
                "target_id": edge.target_id,
                "relation": edge.relation,
            }
            for edge in _EDGES
        ],
    }


def build_policy_engine(deadline: datetime = PROTECTED_DEADLINE) -> PolicyEngine:
    return PolicyEngine(
        (
            MaxWorkloadPolicy(),
            RequiredSkillsPolicy(
                {
                    "person-backup": frozenset({"python", "api"}),
                    "person-generalist": frozenset({"release", "documentation"}),
                    "person-qa": frozenset({"qa", "python"}),
                }
            ),
            ProtectedDeadlinePolicy({"commit-release": deadline}),
        )
    )


def planning_input(
    incident_id: str,
    event: DisruptionEvent,
    objective: ObjectiveRecord = CANONICAL_OBJECTIVE,
) -> PlanningInput:
    affected = build_graph(objective).blast_radius(event.disrupted_node_ids)
    return PlanningInput(
        incident_id=incident_id,
        objective_id=objective.objective_id,
        objective_label=objective.label,
        protected_deadline=objective.deadline_at_utc,
        disruption=event,
        affected_node_ids=[node.node_id for node in affected],
        affected_node_labels=[node.label for node in affected],
        resources=list(RESOURCES),
        allowed_work_item_ids=[
            "work-api-migration",
            "work-api-tests",
            "work-release-notes",
        ],
        allowed_commitment_ids=["commit-release"],
        policy_summary=[
            "No person may exceed 100 percent projected workload.",
            "Assignments require every declared skill.",
            "The protected release deadline may not move later.",
            "Any blocking unknown makes a plan invalid.",
            "Actions are proposals only; P1A performs no external side effects.",
        ],
    )
