import type { KnowledgeNode, KnowledgeNodeKind } from "./node.js";
import type { KnowledgeEdge, KnowledgeEdgeKind } from "./edge.js";

/** Aggregate counters for one knowledge-graph build. */
export interface KnowledgeGraphStatistics {
  readonly nodeCount: number;
  readonly edgeCount: number;
  /** References that resolved to a symbol or module. */
  readonly resolvedReferenceCount: number;
  /** References that did not resolve (kept out of the edge set). */
  readonly unresolvedReferenceCount: number;
  /** Node count per knowledge node kind. */
  readonly nodeKinds: Readonly<Record<string, number>>;
  /** Edge count per knowledge edge kind. */
  readonly edgeKinds: Readonly<Record<string, number>>;
  /** How many builds were served from the engine memo cache. */
  readonly cacheHits: number;
  /** How many builds recomputed the graph. */
  readonly cacheMisses: number;
}

/**
 * The universal knowledge graph.
 *
 * Unifies the structural symbol hierarchy (project → package → module →
 * symbol) with the resolved reference network into one serializable graph.
 * Every node and edge is derived from the symbol and reference layers on each
 * build — nothing is annotated or hand-maintained.
 */
export interface KnowledgeGraph {
  readonly nodes: ReadonlyMap<string, KnowledgeNode>;
  readonly edges: readonly KnowledgeEdge[];
  /** Nodes grouped by kind. */
  readonly nodesByKind: ReadonlyMap<KnowledgeNodeKind, readonly KnowledgeNode[]>;
  /** Outgoing edges by source node id. */
  readonly edgesByFrom: ReadonlyMap<string, readonly KnowledgeEdge[]>;
  /** Incoming edges by target node id. */
  readonly edgesByTo: ReadonlyMap<string, readonly KnowledgeEdge[]>;
  readonly statistics: KnowledgeGraphStatistics;

  findNode(id: string): KnowledgeNode | undefined;
  findEdge(from: string, kind: KnowledgeEdgeKind, to: string): KnowledgeEdge | undefined;
  outgoing(id: string): readonly KnowledgeEdge[];
  incoming(id: string): readonly KnowledgeEdge[];
  neighbors(id: string): readonly string[];
}

/** Input required to build a {@link KnowledgeGraph}. */
export interface KnowledgeGraphInput {
  readonly nodes: readonly KnowledgeNode[];
  readonly edges: readonly KnowledgeEdge[];
  readonly resolvedReferenceCount: number;
  readonly unresolvedReferenceCount: number;
  readonly cacheHits?: number;
  readonly cacheMisses?: number;
}

/** Builds an immutable {@link KnowledgeGraph}. */
export function createKnowledgeGraph(input: KnowledgeGraphInput): KnowledgeGraph {
  const nodes = new Map<string, KnowledgeNode>();
  for (const node of input.nodes) nodes.set(node.id, node);

  const nodesByKind = new Map<KnowledgeNodeKind, KnowledgeNode[]>();
  for (const node of nodes.values()) {
    nodesByKind.set(node.kind, [...(nodesByKind.get(node.kind) ?? []), node]);
  }

  const edgesByFrom = new Map<string, KnowledgeEdge[]>();
  const edgesByTo = new Map<string, KnowledgeEdge[]>();
  for (const edge of input.edges) {
    edgesByFrom.set(edge.from, [...(edgesByFrom.get(edge.from) ?? []), edge]);
    edgesByTo.set(edge.to, [...(edgesByTo.get(edge.to) ?? []), edge]);
  }

  const countBy = (values: readonly string[]): Readonly<Record<string, number>> => {
    const counts: Record<string, number> = {};
    for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
    return Object.freeze(counts);
  };

  const freezeGrouped = <K extends string, T>(map: Map<K, T[]>): ReadonlyMap<K, readonly T[]> => {
    const frozen = new Map<K, readonly T[]>();
    for (const [key, value] of map) frozen.set(key, Object.freeze(value));
    return frozen;
  };

  const nodeKinds: Record<string, number> = {};
  for (const node of input.nodes) nodeKinds[node.kind] = (nodeKinds[node.kind] ?? 0) + 1;

  const statistics: KnowledgeGraphStatistics = Object.freeze({
    nodeCount: input.nodes.length,
    edgeCount: input.edges.length,
    resolvedReferenceCount: input.resolvedReferenceCount,
    unresolvedReferenceCount: input.unresolvedReferenceCount,
    nodeKinds: Object.freeze(nodeKinds),
    edgeKinds: countBy(input.edges.map((edge) => edge.kind)),
    cacheHits: input.cacheHits ?? 0,
    cacheMisses: input.cacheMisses ?? 0,
  });

  const edges = Object.freeze([...input.edges]);

  return {
    nodes,
    edges,
    nodesByKind: freezeGrouped(nodesByKind),
    edgesByFrom: freezeGrouped(edgesByFrom),
    edgesByTo: freezeGrouped(edgesByTo),
    statistics,

    findNode(id: string): KnowledgeNode | undefined {
      return nodes.get(id);
    },

    findEdge(from: string, kind: KnowledgeEdgeKind, to: string): KnowledgeEdge | undefined {
      return edges.find((edge) => edge.from === from && edge.kind === kind && edge.to === to);
    },

    outgoing(id: string): readonly KnowledgeEdge[] {
      return edgesByFrom.get(id) ?? [];
    },

    incoming(id: string): readonly KnowledgeEdge[] {
      return edgesByTo.get(id) ?? [];
    },

    neighbors(id: string): readonly string[] {
      const seen = new Set<string>();
      for (const edge of edgesByFrom.get(id) ?? []) seen.add(edge.to);
      for (const edge of edgesByTo.get(id) ?? []) seen.add(edge.from);
      return Object.freeze([...seen]);
    },
  };
}
