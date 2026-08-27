import { useMemo } from "react";
import type {
  GraphNodeView,
  OperationalGraphView,
} from "../contract/uiContract";

/**
 * The Operational Objective Graph.
 *
 * Node membership, `state`, `affected` and `critical_path` are all backend values.
 * The only thing computed here is where each node sits on the canvas — a layered
 * layout derived from the supplied edges. That is presentation-only geometry: it
 * changes nothing about what the graph means.
 */

interface Placed {
  node: GraphNodeView;
  x: number;
  y: number;
}

const COLUMN_WIDTH = 190;
const ROW_HEIGHT = 92;
const MARGIN_X = 96;
const MARGIN_Y = 46;

/** Longest-path depth from any root, so dependants always sit right of their parents. */
function computeDepths(graph: OperationalGraphView): Map<string, number> {
  const depth = new Map<string, number>();
  const children = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  for (const node of graph.nodes) {
    indegree.set(node.node_id, 0);
    children.set(node.node_id, []);
  }
  for (const edge of graph.edges) {
    if (!indegree.has(edge.source) || !indegree.has(edge.target)) continue;
    children.get(edge.source)!.push(edge.target);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }

  const queue = graph.nodes
    .filter((n) => (indegree.get(n.node_id) ?? 0) === 0)
    .map((n) => n.node_id);
  for (const id of queue) depth.set(id, 0);

  let guard = 0;
  while (queue.length && guard++ < graph.nodes.length * 8) {
    const id = queue.shift()!;
    const base = depth.get(id) ?? 0;
    for (const child of children.get(id) ?? []) {
      depth.set(child, Math.max(depth.get(child) ?? 0, base + 1));
      const remaining = (indegree.get(child) ?? 1) - 1;
      indegree.set(child, remaining);
      if (remaining === 0) queue.push(child);
    }
  }

  // Any node left unplaced (a cycle, or an edge referencing an absent node) still
  // gets a column rather than disappearing from the diagram.
  for (const node of graph.nodes) {
    if (!depth.has(node.node_id)) depth.set(node.node_id, 0);
  }
  return depth;
}

function layout(graph: OperationalGraphView): {
  placed: Placed[];
  width: number;
  height: number;
} {
  const depths = computeDepths(graph);
  const columns = new Map<number, GraphNodeView[]>();
  for (const node of graph.nodes) {
    const d = depths.get(node.node_id) ?? 0;
    const bucket = columns.get(d);
    if (bucket) bucket.push(node);
    else columns.set(d, [node]);
  }

  const placed: Placed[] = [];
  let maxRows = 1;
  for (const [depth, nodes] of [...columns.entries()].sort(
    (a, b) => a[0] - b[0],
  )) {
    maxRows = Math.max(maxRows, nodes.length);
    nodes.forEach((node, index) => {
      placed.push({
        node,
        x: MARGIN_X + depth * COLUMN_WIDTH,
        y:
          MARGIN_Y +
          index * ROW_HEIGHT +
          ((maxRows - nodes.length) * ROW_HEIGHT) / 2,
      });
    });
  }

  const width = MARGIN_X * 2 + (columns.size - 1) * COLUMN_WIDTH;
  const height = MARGIN_Y * 2 + (maxRows - 1) * ROW_HEIGHT;
  return { placed, width, height };
}

const nodeTone = (node: GraphNodeView): string => {
  if (node.state === "disrupted") return "is-disrupted";
  if (node.kind === "objective") return "is-objective";
  if (node.affected) return "is-affected";
  return "is-stable";
};

export function WorldGraph({ graph }: { graph: OperationalGraphView }) {
  const { placed, width, height } = useMemo(() => layout(graph), [graph]);
  const positions = useMemo(
    () => new Map(placed.map((entry) => [entry.node.node_id, entry])),
    [placed],
  );

  if (graph.nodes.length === 0) {
    return (
      <p className="world-empty">
        The presentation contract returned no graph for this incident.
      </p>
    );
  }

  const affectedCount = graph.nodes.filter((node) => node.affected).length;
  const criticalCount = graph.nodes.filter((node) => node.critical_path).length;

  return (
    <div className="world">
      <div className="world-legend">
        <span>
          <b>{affectedCount}</b> of {graph.nodes.length} nodes affected
        </span>
        <span>
          <b>{criticalCount}</b> on the critical path
        </span>
      </div>

      <div
        className="world-canvas"
        style={{ minWidth: width, minHeight: height }}
      >
        <svg
          className="world-edges"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          aria-hidden="true"
        >
          {graph.edges.map((edge) => {
            const from = positions.get(edge.source);
            const to = positions.get(edge.target);
            if (!from || !to) return null;
            const affected = from.node.affected && to.node.affected;
            const midX = (from.x + to.x) / 2;
            return (
              <path
                key={`${edge.source}->${edge.target}`}
                d={`M ${from.x + 8} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x - 8} ${to.y}`}
                className={affected ? "world-edge is-affected" : "world-edge"}
              />
            );
          })}
        </svg>

        <ul className="world-nodes" style={{ width, height }}>
          {placed.map(({ node, x, y }) => (
            <li
              key={node.node_id}
              className={`world-node ${nodeTone(node)}${node.critical_path ? " is-critical" : ""}`}
              style={{ left: x, top: y }}
            >
              <span className="world-dot" aria-hidden="true" />
              <span className="world-node-body">
                <b>{node.label}</b>
                <small>
                  {node.kind.replace(/_/g, " ")} · {node.state}
                </small>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
