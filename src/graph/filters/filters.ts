import type { KnowledgeEdge, KnowledgeEdgeKind } from "../models/edge.js";
import type { KnowledgeNode, KnowledgeNodeKind } from "../models/node.js";

/** A predicate over knowledge-graph nodes. */
export type KnowledgeNodePredicate = (node: KnowledgeNode) => boolean;

/** A predicate over knowledge-graph edges. */
export type KnowledgeEdgePredicate = (edge: KnowledgeEdge) => boolean;

/** An edge predicate that accepts every edge. */
export function acceptAllEdges(_edge: KnowledgeEdge): boolean {
  return true;
}

/** An edge predicate that rejects every edge. */
export function rejectAllEdges(_edge: KnowledgeEdge): boolean {
  return false;
}

/** Builds a node predicate matching any of the given kinds. */
export function nodeOfKind(...kinds: readonly KnowledgeNodeKind[]): KnowledgeNodePredicate {
  const allowed = new Set<KnowledgeNodeKind>(kinds);
  return (node: KnowledgeNode): boolean => allowed.has(node.kind);
}

/** Builds an edge predicate matching any of the given kinds. */
export function edgeOfKind(...kinds: readonly KnowledgeEdgeKind[]): KnowledgeEdgePredicate {
  const allowed = new Set<KnowledgeEdgeKind>(kinds);
  return (edge: KnowledgeEdge): boolean => allowed.has(edge.kind);
}

/** Matches nodes with the given backing symbol kind. */
export function symbolOfKind(...kinds: readonly string[]): KnowledgeNodePredicate {
  const allowed = new Set<string>(kinds);
  return (node: KnowledgeNode): boolean =>
    node.symbolKind !== undefined && allowed.has(node.symbolKind);
}
