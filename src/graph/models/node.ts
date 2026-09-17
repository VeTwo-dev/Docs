import type { SymbolKind } from "../../symbols/index.js";

/**
 * The kinds of nodes in a {@link import("./graph.js").KnowledgeGraph}.
 *
 * Project/package/module nodes mirror the corresponding symbol kinds; every
 * other construct collapses to a generic `symbol` node carrying its real
 * `symbolKind`.
 */
export const KNOWLEDGE_NODE_KINDS = ["project", "package", "module", "symbol"] as const;

/** The kind of a knowledge-graph node. */
export type KnowledgeNodeKind = (typeof KNOWLEDGE_NODE_KINDS)[number];

/** Whether `kind` is a known knowledge-graph node kind. */
export function isKnowledgeNodeKind(kind: string): kind is KnowledgeNodeKind {
  return (KNOWLEDGE_NODE_KINDS as readonly string[]).includes(kind);
}

/**
 * A node in the knowledge graph.
 *
 * Every node is backed by a symbol from the symbol layer and therefore shares
 * the symbol's id, so `node.id === symbol.id`. Immutable and frozen.
 */
export interface KnowledgeNode {
  /** The node id — identical to the backing symbol id. */
  readonly id: string;
  readonly kind: KnowledgeNodeKind;
  /** A human-readable label (the local name). */
  readonly label: string;
  /** The file the node lives in, when known. */
  readonly file?: string;
  /** A secondary detail line (e.g. the qualified name). */
  readonly detail?: string;
  /** The backing symbol kind, when the node is a `symbol` node. */
  readonly symbolKind?: SymbolKind;
}

/** Input required to build a {@link KnowledgeNode}. */
export interface KnowledgeNodeInput {
  readonly id: string;
  readonly kind: KnowledgeNodeKind;
  readonly label: string;
  readonly file?: string;
  readonly detail?: string;
  readonly symbolKind?: SymbolKind;
}

/** Builds an immutable {@link KnowledgeNode}. */
export function createKnowledgeNode(input: KnowledgeNodeInput): KnowledgeNode {
  return Object.freeze({
    id: input.id,
    kind: input.kind,
    label: input.label,
    ...(input.file !== undefined ? { file: input.file } : {}),
    ...(input.detail !== undefined ? { detail: input.detail } : {}),
    ...(input.symbolKind !== undefined ? { symbolKind: input.symbolKind } : {}),
  });
}
