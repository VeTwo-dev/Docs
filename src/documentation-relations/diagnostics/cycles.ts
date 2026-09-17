import type { DocumentationRelationship } from "../models/index.js";
import type { RelationshipCycle } from "../models/index.js";
import { isDirectionalRelationshipKind } from "../models/index.js";

/**
 * Detects cycles in the relationship graph.
 *
 * Directional kinds (e.g. `nextStep`) must not form cycles — a circular
 * reading order is a hard error. Undirected kinds (e.g. `relatedTo`) are
 * reported as soft informational cycles only.
 */
export function detectRelationshipCycles(
  relationships: readonly DocumentationRelationship[],
): readonly RelationshipCycle[] {
  const cycles: RelationshipCycle[] = [];

  // Build adjacency for each directional kind.
  const directionalKinds = new Set(
    relationships.map((relationship) => relationship.kind).filter(isDirectionalRelationshipKind),
  );
  for (const kind of directionalKinds) {
    const byFrom = new Map<string, string[]>();
    for (const relationship of relationships) {
      if (relationship.kind !== kind) continue;
      byFrom.set(relationship.from, [...(byFrom.get(relationship.from) ?? []), relationship.to]);
    }
    cycles.push(...detectCyclesInGraph(byFrom, kind, "hard"));
  }

  // Soft cycles: undirected kinds that form a bidirectional pair or loop.
  const undirected = relationships.filter(
    (relationship) => !isDirectionalRelationshipKind(relationship.kind),
  );
  const byFrom = new Map<string, string[]>();
  for (const relationship of undirected) {
    byFrom.set(relationship.from, [...(byFrom.get(relationship.from) ?? []), relationship.to]);
    byFrom.set(relationship.to, [...(byFrom.get(relationship.to) ?? []), relationship.from]);
  }
  cycles.push(...detectCyclesInGraph(byFrom, "relatedTo", "soft"));

  return Object.freeze(cycles);
}

function detectCyclesInGraph(
  adjacency: Map<string, readonly string[]>,
  kind: string,
  severity: "hard" | "soft",
): readonly RelationshipCycle[] {
  const cycles: RelationshipCycle[] = [];
  const visited = new Set<string>();
  const path: string[] = [];
  const pathSet = new Set<string>();

  const visit = (node: string): void => {
    if (pathSet.has(node)) {
      const start = path.indexOf(node);
      const cyclePages = path.slice(start).concat(node);
      cycles.push({
        relationshipIds: Object.freeze([]),
        pages: Object.freeze(cyclePages),
        kind,
        severity,
      });
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    pathSet.add(node);
    path.push(node);
    for (const next of adjacency.get(node) ?? []) visit(next);
    path.pop();
    pathSet.delete(node);
  };

  for (const node of adjacency.keys()) visit(node);
  return cycles;
}
