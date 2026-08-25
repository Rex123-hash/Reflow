"""Deterministic operational objective graph."""

from __future__ import annotations

import heapq
from collections.abc import Iterable

from objective_recovery.domain.errors import (
    CycleDetectedError,
    DuplicateNodeError,
    InvalidGraphEdgeError,
    UnknownNodeError,
)
from objective_recovery.domain.models import NodeKind, OperationalEdge, OperationalNode


class OperationalGraph:
    """A DAG whose edges point from a dependent to its dependency."""

    def __init__(self) -> None:
        self._nodes: dict[str, OperationalNode] = {}
        self._dependencies: dict[str, set[str]] = {}
        self._dependents: dict[str, set[str]] = {}

    def add_node(self, node: OperationalNode) -> None:
        if not node.node_id or not node.label:
            raise ValueError("node_id and label must be non-empty")
        if node.node_id in self._nodes:
            raise DuplicateNodeError(node.node_id)
        self._nodes[node.node_id] = node
        self._dependencies[node.node_id] = set()
        self._dependents[node.node_id] = set()

    def add_edge(self, edge: OperationalEdge) -> None:
        if edge.source_id not in self._nodes:
            raise UnknownNodeError(edge.source_id)
        if edge.target_id not in self._nodes:
            raise UnknownNodeError(edge.target_id)
        if not edge.relation:
            raise InvalidGraphEdgeError("edge relation must be non-empty")
        if edge.source_id == edge.target_id:
            raise CycleDetectedError("self-dependency is not allowed")
        if edge.target_id in self._dependencies[edge.source_id]:
            return
        if self._has_dependency_path(edge.target_id, edge.source_id):
            raise CycleDetectedError(
                f"edge {edge.source_id}->{edge.target_id} would create a cycle"
            )
        self._dependencies[edge.source_id].add(edge.target_id)
        self._dependents[edge.target_id].add(edge.source_id)

    def blast_radius(self, disrupted_node_ids: Iterable[str]) -> tuple[OperationalNode, ...]:
        """Return disrupted nodes and all transitive dependents in stable ID order."""

        disrupted = set(disrupted_node_ids)
        missing = sorted(disrupted.difference(self._nodes))
        if missing:
            raise UnknownNodeError(",".join(missing))

        visited: set[str] = set()
        queue = list(disrupted)
        heapq.heapify(queue)
        while queue:
            node_id = heapq.heappop(queue)
            if node_id in visited:
                continue
            visited.add(node_id)
            for dependent_id in sorted(self._dependents[node_id]):
                if dependent_id not in visited:
                    heapq.heappush(queue, dependent_id)
        return tuple(self._nodes[node_id] for node_id in sorted(visited))

    def affected_objectives(self, disrupted_node_ids: Iterable[str]) -> tuple[OperationalNode, ...]:
        return tuple(
            node
            for node in self.blast_radius(disrupted_node_ids)
            if node.kind is NodeKind.OBJECTIVE
        )

    def _has_dependency_path(self, start_id: str, target_id: str) -> bool:
        pending = [start_id]
        visited: set[str] = set()
        while pending:
            current = pending.pop()
            if current == target_id:
                return True
            if current in visited:
                continue
            visited.add(current)
            pending.extend(sorted(self._dependencies[current], reverse=True))
        return False
