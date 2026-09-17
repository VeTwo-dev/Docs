/**
 * The kinds of edges in a {@link import("./graph.js").KnowledgeGraph}.
 *
 * `owns`/`declared-in` are structural (mirroring the symbol graph);
 * `imports`/`imports-name`/`exports`/`re-exports`/`references` are resolved
 * references recovered by the reference layer. Every edge is derived, never
 * annotated.
 */
export const KNOWLEDGE_EDGE_KINDS = [
  /** A symbol owns a child symbol (module → declaration, class → member). */
  "owns",
  /** A symbol is declared in a module (symbol → module node). */
  "declared-in",
  /** A module imports another module. */
  "imports",
  /** A module imports a specific exported name (binds a target symbol). */
  "imports-name",
  /** A module exports a local symbol. */
  "exports",
  /** A module re-exports from another module. */
  "re-exports",
  /** A symbol references another symbol (heritage, type-use, ...). */
  "references",
] as const;

/** The kind of a knowledge-graph edge. */
export type KnowledgeEdgeKind = (typeof KNOWLEDGE_EDGE_KINDS)[number];

/** Whether `kind` is a known knowledge-graph edge kind. */
export function isKnowledgeEdgeKind(kind: string): kind is KnowledgeEdgeKind {
  return (KNOWLEDGE_EDGE_KINDS as readonly string[]).includes(kind);
}

/**
 * A directed edge in the knowledge graph.
 *
 * Edges always connect two nodes by id and are deduplicated by a
 * deterministic id (`from|kind|to`), so repeated references between the same
 * pair collapse to one edge. Immutable and frozen.
 */
export interface KnowledgeEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly kind: KnowledgeEdgeKind;
  /** A short annotation (specifier or referenced name). */
  readonly label?: string;
  /** The backing {@link import("../../references/index.js").Reference} id, when derived from one. */
  readonly referenceId?: string;
}

/** Input required to build a {@link KnowledgeEdge}. */
export interface KnowledgeEdgeInput {
  readonly from: string;
  readonly to: string;
  readonly kind: KnowledgeEdgeKind;
  readonly label?: string;
  readonly referenceId?: string;
}

/** Builds an immutable {@link KnowledgeEdge} with a deterministic id. */
export function createKnowledgeEdge(input: KnowledgeEdgeInput): KnowledgeEdge {
  return Object.freeze({
    id: `${input.from}|${input.kind}|${input.to}`,
    from: input.from,
    to: input.to,
    kind: input.kind,
    ...(input.label !== undefined ? { label: input.label } : {}),
    ...(input.referenceId !== undefined ? { referenceId: input.referenceId } : {}),
  });
}
