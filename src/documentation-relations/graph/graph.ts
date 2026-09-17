import type { DocumentationRelationship, RelationshipKind } from "../models/index.js";

/**
 * The relationship graph: a lightweight view over derived relationships.
 *
 * Nodes are documentation page slugs; edges are the derived relationships.
 * The graph is immutable and rebuilt per run.
 */
export interface RelationshipGraph {
  readonly relationships: readonly DocumentationRelationship[];
  readonly nodes: readonly string[];
  outgoing(slug: string): readonly DocumentationRelationship[];
  incoming(slug: string): readonly DocumentationRelationship[];
  neighbors(slug: string): readonly string[];
  relationshipsOf(kind: RelationshipKind): readonly DocumentationRelationship[];
  find(from: string, kind: RelationshipKind, to: string): DocumentationRelationship | undefined;
  /** Pages with at least one relationship. */
  connected(): readonly string[];
  /** Pages with no relationships at all (orphans). */
  orphans(): readonly string[];
  readonly size: number;
}

/** Builds an immutable {@link RelationshipGraph}. */
export function createRelationshipGraph(
  relationships: readonly DocumentationRelationship[],
): RelationshipGraph {
  const byFrom = new Map<string, DocumentationRelationship[]>();
  const byTo = new Map<string, DocumentationRelationship[]>();
  const byKind = new Map<RelationshipKind, DocumentationRelationship[]>();

  for (const relationship of relationships) {
    byFrom.set(relationship.from, [...(byFrom.get(relationship.from) ?? []), relationship]);
    byTo.set(relationship.to, [...(byTo.get(relationship.to) ?? []), relationship]);
    byKind.set(relationship.kind, [...(byKind.get(relationship.kind) ?? []), relationship]);
  }

  const nodes = new Set<string>();
  for (const relationship of relationships) {
    nodes.add(relationship.from);
    nodes.add(relationship.to);
  }

  return {
    relationships,
    nodes: Object.freeze([...nodes]),

    outgoing(slug: string): readonly DocumentationRelationship[] {
      return Object.freeze(byFrom.get(slug) ?? []);
    },

    incoming(slug: string): readonly DocumentationRelationship[] {
      return Object.freeze(byTo.get(slug) ?? []);
    },

    neighbors(slug: string): readonly string[] {
      const seen = new Set<string>();
      for (const edge of byFrom.get(slug) ?? []) seen.add(edge.to);
      for (const edge of byTo.get(slug) ?? []) seen.add(edge.from);
      return Object.freeze([...seen]);
    },

    relationshipsOf(kind: RelationshipKind): readonly DocumentationRelationship[] {
      return Object.freeze(byKind.get(kind) ?? []);
    },

    find(from: string, kind: RelationshipKind, to: string): DocumentationRelationship | undefined {
      return relationships.find(
        (relationship) =>
          relationship.from === from && relationship.kind === kind && relationship.to === to,
      );
    },

    connected(): readonly string[] {
      return Object.freeze([...nodes].filter((node) => this.neighbors(node).length > 0));
    },

    orphans(): readonly string[] {
      return Object.freeze([...nodes].filter((node) => this.neighbors(node).length === 0));
    },

    get size(): number {
      return relationships.length;
    },
  };
}
