/**
 * Documentation Dependency Graph.
 *
 * A graph over documentation pages (independent from the source-code
 * graph). Edges come from planned relationships; the graph drives
 * ordering, impact analysis, and incremental regeneration.
 */

import type { DocumentationRelationship } from "./types.js";

/** Adjacency-list dependency graph over page slugs. */
export interface DocumentationDependencyGraph {
  /** All page slugs in the graph. */
  readonly nodes: readonly string[];
  /** Direct dependencies: slug → pages it depends on. */
  readonly dependencies: Readonly<Record<string, readonly string[]>>;
  /** Direct dependents: slug → pages that depend on it. */
  readonly dependents: Readonly<Record<string, readonly string[]>>;
}

/** Relationship kinds that create a real "must exist first" dependency. */
const DEPENDENCY_KINDS = new Set(["prerequisite", "extends", "depends-on", "example-for"]);

/** Build a documentation dependency graph from relationships. */
export function buildDependencyGraph(
  pageSlugs: readonly string[],
  relationships: readonly DocumentationRelationship[],
): DocumentationDependencyGraph {
  const nodeSet = new Set(pageSlugs);
  const dependencies: Record<string, string[]> = {};
  const dependents: Record<string, string[]> = {};

  for (const rel of relationships) {
    if (!DEPENDENCY_KINDS.has(rel.kind)) continue;
    // A prerequisite edge `from → to` means `from` must exist before `to`,
    // so `to` depends on `from`.
    const dependent = rel.to;
    const dependency = rel.from;
    if (!nodeSet.has(dependent) || !nodeSet.has(dependency) || dependent === dependency) continue;
    (dependencies[dependent] ??= []).push(dependency);
    (dependents[dependency] ??= []).push(dependent);
  }

  return {
    nodes: [...nodeSet],
    dependencies,
    dependents,
  };
}

/**
 * Topologically order pages so dependencies come first.
 * Cycles are broken deterministically (alphabetical) rather than throwing,
 * since documentation graphs may legitimately contain mutual references.
 */
export function topoOrderPages(graph: DocumentationDependencyGraph): readonly string[] {
  const inDegree = new Map<string, number>();
  for (const node of graph.nodes) {
    inDegree.set(node, graph.dependencies[node]?.length ?? 0);
  }

  const queue = [...graph.nodes].filter((n) => (inDegree.get(n) ?? 0) === 0).sort();
  const ordered: string[] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const node = queue.shift();
    if (node === undefined || visited.has(node)) continue;
    visited.add(node);
    ordered.push(node);

    for (const dependent of graph.dependents[node] ?? []) {
      if (visited.has(dependent)) continue;
      const next = (inDegree.get(dependent) ?? 1) - 1;
      inDegree.set(dependent, next);
      if (next <= 0) {
        queue.push(dependent);
        queue.sort();
      }
    }
  }

  // Append any cycle members deterministically at the end.
  for (const node of graph.nodes) {
    if (!visited.has(node)) ordered.push(node);
  }

  return ordered;
}
