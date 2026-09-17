import type { KnowledgeGraph } from "../models/index.js";
import type { KnowledgeEdge } from "../models/index.js";
import type { KnowledgeEdgePredicate } from "../filters/index.js";
import { acceptAllEdges } from "../filters/index.js";

/** The traversal direction through the knowledge graph. */
export type KnowledgeTraversalOrder = "pre-order" | "post-order";

/** A visitor callback. Return `false` to prune a subtree. */
export type KnowledgeVisitor = (nodeId: string, depth: number) => boolean | void;

export interface KnowledgeWalkOptions {
  readonly order?: KnowledgeTraversalOrder;
  /** Only follow edges matching this predicate (default: all edges). */
  readonly filter?: KnowledgeEdgePredicate;
  /** Already-visited node ids; reused across calls to share the walk. */
  readonly visited?: Set<string>;
}

/**
 * Depth-first traversal following outgoing edges (both directions are
 * reachable through {@link KnowledgeGraph.outgoing}).
 */
export function visitNodes(
  graph: KnowledgeGraph,
  rootId: string,
  visitor: KnowledgeVisitor,
  options: KnowledgeWalkOptions = {},
): void {
  const order = options.order ?? "pre-order";
  const filter = options.filter ?? acceptAllEdges;
  const visited = options.visited ?? new Set<string>();

  const walk = (nodeId: string, depth: number): void => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    for (const edge of graph.outgoing(nodeId)) {
      if (!filter(edge)) continue;
      const target = edge.to;
      if (visited.has(target)) continue;
      if (order === "pre-order" && visitor(target, depth) === false) continue;
      walk(target, depth + 1);
      if (order === "post-order") void visitor(target, depth);
    }
  };

  walk(rootId, 0);
}

/** Collects every node id reachable from `rootId`. */
export function collectNodes(
  graph: KnowledgeGraph,
  rootId: string,
  filter?: KnowledgeEdgePredicate,
): readonly string[] {
  const visited = new Set<string>();
  visitNodes(
    graph,
    rootId,
    () => {
      // no-op; visitNodes tracks visited node ids for us
    },
    { filter, visited },
  );
  return [...visited];
}

/** The ids of the nodes directly reachable from `nodeId`. */
export function neighborsOf(graph: KnowledgeGraph, nodeId: string): readonly string[] {
  return graph.neighbors(nodeId);
}

/** The ids of the nodes that can reach `nodeId` by following edges backward. */
export function ancestorsOf(graph: KnowledgeGraph, nodeId: string): readonly string[] {
  const ancestors: string[] = [];
  const visited = new Set<string>();

  const walk = (current: string): void => {
    for (const edge of graph.incoming(current)) {
      if (visited.has(edge.from)) continue;
      visited.add(edge.from);
      ancestors.push(edge.from);
      walk(edge.from);
    }
  };

  walk(nodeId);
  return Object.freeze(ancestors);
}

/** The ids of the direct children (via `owns` edges) of `nodeId`. */
export function childrenOf(graph: KnowledgeGraph, nodeId: string): readonly string[] {
  return Object.freeze(
    graph
      .outgoing(nodeId)
      .filter((edge) => edge.kind === "owns")
      .map((edge) => edge.to),
  );
}

/** The ids of the leaf descendants of `nodeId` (nodes with no `owns` children). */
export function leavesOf(graph: KnowledgeGraph, nodeId: string): readonly string[] {
  const leaves: string[] = [];
  const visited = new Set<string>();

  const walk = (current: string): void => {
    if (visited.has(current)) return;
    visited.add(current);
    const children = graph
      .outgoing(current)
      .filter((edge: KnowledgeEdge) => edge.kind === "owns")
      .map((edge) => edge.to);
    if (children.length === 0) {
      leaves.push(current);
      return;
    }
    for (const child of children) walk(child);
  };

  walk(nodeId);
  return Object.freeze(leaves);
}
