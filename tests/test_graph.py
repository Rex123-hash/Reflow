import pytest

from objective_recovery.domain.errors import (
    CycleDetectedError,
    DuplicateNodeError,
    InvalidGraphEdgeError,
    UnknownNodeError,
)
from objective_recovery.domain.graph import OperationalGraph
from objective_recovery.domain.models import NodeKind, OperationalEdge, OperationalNode


def node(node_id: str, kind: NodeKind = NodeKind.WORK_ITEM) -> OperationalNode:
    return OperationalNode(node_id=node_id, kind=kind, label=node_id.replace("-", " "))


def release_graph() -> OperationalGraph:
    graph = OperationalGraph()
    for item in (
        node("objective-release", NodeKind.OBJECTIVE),
        node("milestone-qa", NodeKind.MILESTONE),
        node("work-staging"),
        node("work-migration"),
        node("person-backend", NodeKind.PERSON),
        node("objective-unrelated", NodeKind.OBJECTIVE),
        node("work-unrelated"),
    ):
        graph.add_node(item)
    graph.add_edge(OperationalEdge("objective-release", "milestone-qa"))
    graph.add_edge(OperationalEdge("milestone-qa", "work-staging"))
    graph.add_edge(OperationalEdge("work-staging", "work-migration"))
    graph.add_edge(OperationalEdge("work-migration", "person-backend"))
    graph.add_edge(OperationalEdge("objective-unrelated", "work-unrelated"))
    return graph


def test_multi_hop_blast_radius_and_unaffected_objective() -> None:
    graph = release_graph()

    impacted = graph.blast_radius(["person-backend"])
    assert [item.node_id for item in impacted] == [
        "milestone-qa",
        "objective-release",
        "person-backend",
        "work-migration",
        "work-staging",
    ]
    assert [item.node_id for item in graph.affected_objectives(["person-backend"])] == [
        "objective-release"
    ]


def test_multiple_disruptions_are_deduplicated_and_stably_ordered() -> None:
    graph = release_graph()
    result = graph.blast_radius(["person-backend", "work-migration", "person-backend"])
    assert tuple(item.node_id for item in result) == tuple(sorted(item.node_id for item in result))


def test_cycle_and_self_dependency_are_rejected() -> None:
    graph = release_graph()
    with pytest.raises(CycleDetectedError):
        graph.add_edge(OperationalEdge("person-backend", "objective-release"))
    with pytest.raises(CycleDetectedError):
        graph.add_edge(OperationalEdge("person-backend", "person-backend"))


def test_invalid_and_unknown_graph_inputs_are_rejected() -> None:
    graph = OperationalGraph()
    graph.add_node(node("known"))

    with pytest.raises(DuplicateNodeError):
        graph.add_node(node("known"))
    with pytest.raises(ValueError):
        graph.add_node(OperationalNode("", NodeKind.RESOURCE, "missing id"))
    with pytest.raises(UnknownNodeError):
        graph.add_edge(OperationalEdge("missing", "known"))
    with pytest.raises(UnknownNodeError):
        graph.add_edge(OperationalEdge("known", "missing"))
    with pytest.raises(InvalidGraphEdgeError):
        graph.add_edge(OperationalEdge("known", "known", relation=""))
    with pytest.raises(UnknownNodeError):
        graph.blast_radius(["missing"])


def test_readding_same_edge_is_idempotent() -> None:
    graph = OperationalGraph()
    graph.add_node(node("dependent"))
    graph.add_node(node("dependency", NodeKind.RESOURCE))
    edge = OperationalEdge("dependent", "dependency")
    graph.add_edge(edge)
    graph.add_edge(edge)
    assert [item.node_id for item in graph.blast_radius(["dependency"])] == [
        "dependency",
        "dependent",
    ]
