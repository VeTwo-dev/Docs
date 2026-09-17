import type { KnowledgeNodeKind } from "../models/index.js";
import type { KnowledgeEdgeKind } from "../models/index.js";

/**
 * Deterministic knowledge-graph helpers.
 *
 * Node ids are the backing symbol ids; edge ids are pure functions of
 * `from|kind|to`, which keeps the graph stable across builds and makes
 * repeated references between the same pair collapse to one edge.
 */

/** Builds the canonical id of an edge. */
export function knowledgeEdgeId(from: string, kind: KnowledgeEdgeKind, to: string): string {
  return `${from}|${kind}|${to}`;
}

/** A short, human-readable edge kind description. */
export function describeEdgeKind(kind: KnowledgeEdgeKind): string {
  switch (kind) {
    case "owns":
      return "owns";
    case "declared-in":
      return "declared in";
    case "imports":
      return "imports";
    case "imports-name":
      return "imports name";
    case "exports":
      return "exports";
    case "re-exports":
      return "re-exports";
    case "references":
      return "references";
    default:
      return kind;
  }
}

/** A short, human-readable node kind description. */
export function describeNodeKind(kind: KnowledgeNodeKind): string {
  return kind;
}
