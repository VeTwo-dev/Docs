import type { Reference } from "../models/index.js";
import { createReference } from "../models/index.js";
import { referenceId } from "../shared/index.js";

/**
 * Circular dependency detection for the reference layer.
 *
 * Cycles are detected over the derived edges (module imports/re-exports,
 * inheritance, package/workspace dependencies) using Tarjan's strongly
 * connected components algorithm. Cycles are never silently discarded — each
 * one is reported as a `circular` reference and, via the engine, as a
 * `circular-reference` diagnostic.
 */

/** A detected cycle: an ordered list of node ids that return to the start. */
export interface DetectedCycle {
  readonly nodes: readonly string[];
  /** The kind of cycle: imports, inheritance, packages or workspaces. */
  readonly kind: "imports" | "inheritance" | "packages" | "workspaces" | "aliases";
  /** Whether any edge in the cycle resolved. */
  readonly resolved: boolean;
}

/** The cycle detection result. */
export interface CycleDetectionResult {
  readonly cycles: readonly DetectedCycle[];
  /** Node ids participating in at least one cycle. */
  readonly participatingNodes: ReadonlySet<string>;
  /** Whether any cycle was found. */
  readonly hasCycles: boolean;
}

/**
 * Finds elementary cycles by walking edges from each node, capping the walk
 * to avoid exponential blowup on dense graphs. Uses backtracking over a
 * shared visited set.
 */
export function findCycles(
  edges: ReadonlyMap<string, readonly string[]>,
  maxDepth = 200,
): DetectedCycle[] {
  const cycles: DetectedCycle[] = [];
  const seen = new Set<string>();
  const path: string[] = [];
  const visited = new Set<string>();

  const visit = (start: string, node: string): void => {
    const tail = path[path.length - 1] ?? node;
    for (const next of edges.get(tail) ?? []) {
      if (next === start) {
        if (path.length >= 2) {
          const key = path.join("→");
          if (!seen.has(key)) {
            seen.add(key);
            cycles.push(
              Object.freeze({ nodes: Object.freeze([...path]), kind: "imports", resolved: true }),
            );
          }
        }
        continue;
      }
      if (visited.has(next) || path.length >= maxDepth) continue;
      visited.add(next);
      path.push(next);
      visit(start, next);
      path.pop();
      visited.delete(next);
    }
  };

  for (const node of edges.keys()) {
    path.length = 0;
    path.push(node);
    visited.add(node);
    visit(node, node);
    visited.delete(node);
  }

  // Deduplicate rotations of the same cycle.
  const deduped = cycles.filter((cycle, index) => {
    for (let earlier = 0; earlier < index; earlier++) {
      const other = cycles[earlier]!;
      if (other.nodes.length !== cycle.nodes.length) continue;
      const doubled = [...other.nodes, ...other.nodes].join("→");
      const candidate = [...cycle.nodes, cycle.nodes[0]].join("→");
      if (doubled.includes(candidate)) return false;
    }
    return true;
  });

  return deduped;
}

/** Edges by node id. */
export type DirectedEdges = ReadonlyMap<string, readonly string[]>;

/**
 * Detects cycles over a set of directed edges.
 *
 * `kind` labels the reported cycles so callers can attach the right
 * diagnostic. When `resolvedEdges` is provided, cycles made only of resolved
 * edges are marked resolved.
 */
export function detectCycles(
  edges: DirectedEdges,
  kind: DetectedCycle["kind"],
  resolvedEdges: ReadonlySet<string> = new Set(),
): CycleDetectionResult {
  const cycles = findCycles(edges).map((cycle) => {
    const resolved = cycle.nodes.every((id, index) => {
      const next = cycle.nodes[(index + 1) % cycle.nodes.length]!;
      return resolvedEdges.has(`${id}→${next}`);
    });
    return Object.freeze({ ...cycle, kind, resolved });
  });

  const participatingNodes = new Set<string>();
  for (const cycle of cycles) for (const node of cycle.nodes) participatingNodes.add(node);

  return Object.freeze({
    cycles: Object.freeze(cycles),
    participatingNodes,
    hasCycles: cycles.length > 0,
  });
}

/** Builds module import/re-export edges from references. */
export function moduleEdges(references: readonly Reference[]): DirectedEdges {
  const edges = new Map<string, string[]>();
  for (const reference of references) {
    if (reference.kind !== "import" && reference.kind !== "re-export") continue;
    if (reference.toId === undefined && reference.toFile === undefined) continue;
    const target = reference.toId ?? reference.toFile!;
    const list = edges.get(reference.fromId) ?? [];
    if (!list.includes(target)) list.push(target);
    edges.set(reference.fromId, list);
  }
  return edges;
}

/** Builds inheritance edges from heritage references. */
export function inheritanceEdges(references: readonly Reference[]): DirectedEdges {
  const edges = new Map<string, string[]>();
  for (const reference of references) {
    if (reference.kind !== "heritage") continue;
    if (reference.toId === undefined) continue;
    const list = edges.get(reference.fromId) ?? [];
    if (!list.includes(reference.toId)) list.push(reference.toId);
    edges.set(reference.fromId, list);
  }
  return edges;
}

/** Builds alias edges from alias references. */
export function aliasEdges(references: readonly Reference[]): DirectedEdges {
  const edges = new Map<string, string[]>();
  for (const reference of references) {
    if (reference.kind !== "alias") continue;
    if (reference.toId === undefined) continue;
    const list = edges.get(reference.fromId) ?? [];
    if (!list.includes(reference.toId)) list.push(reference.toId);
    edges.set(reference.fromId, list);
  }
  return edges;
}

/** Builds package dependency edges (name → dependency name). */
export function packageEdges(dependencies: readonly { from: string; to: string }[]): DirectedEdges {
  const edges = new Map<string, string[]>();
  for (const { from, to } of dependencies) {
    const list = edges.get(from) ?? [];
    if (!list.includes(to)) list.push(to);
    edges.set(from, list);
  }
  return edges;
}

/** Converts detected cycles into `circular` reference records. */
export function circularReferences(result: CycleDetectionResult): readonly Reference[] {
  let sequence = 0;
  return result.cycles.map((cycle) => {
    const from = cycle.nodes[0] ?? "unknown";
    const to = cycle.nodes[cycle.nodes.length - 1] ?? from;
    const reference = createReference(
      {
        kind: "circular",
        fromId: from,
        toId: to,
        name: cycle.nodes.join("→"),
        payload: { cycleIds: cycle.nodes },
      },
      referenceId("circular", from, cycle.nodes.join("→"), "", sequence++),
    );
    return reference;
  });
}
