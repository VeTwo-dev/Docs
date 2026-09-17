import type { ReferenceGraph } from "../graph/index.js";
import type { Reference } from "../models/index.js";
import type { ReferenceFilter } from "../filters/index.js";
import { acceptAll } from "../filters/index.js";

/** The traversal direction through the reference graph. */
export type ReferenceTraversalOrder = "pre-order" | "post-order";

/** A visitor callback. Return `false` to prune a subtree. */
export type ReferenceVisitor = (reference: Reference, depth: number) => boolean | void;

export interface ReferenceWalkOptions {
  readonly order?: ReferenceTraversalOrder;
  readonly filter?: ReferenceFilter;
  /** Already-visited symbol ids; reused across calls to share the walk. */
  readonly visited?: Set<string>;
}

/** Depth-first traversal following resolved symbol edges. */
export function visitReferences(
  graph: ReferenceGraph,
  rootId: string,
  visitor: ReferenceVisitor,
  options: ReferenceWalkOptions = {},
): void {
  const order = options.order ?? "pre-order";
  const filter = options.filter ?? acceptAll;
  const visited = options.visited ?? new Set<string>();

  const walk = (symbolId: string, depth: number): void => {
    if (visited.has(symbolId)) return;
    visited.add(symbolId);
    for (const reference of graph.referencesOf(symbolId)) {
      if (!filter(reference)) continue;
      if (order === "pre-order" && visitor(reference, depth) === false) continue;
      if (reference.toId !== undefined) walk(reference.toId, depth + 1);
      if (order === "post-order") void visitor(reference, depth);
    }
  };

  walk(rootId, 0);
}

/** Collects every reference reachable from `rootId`. */
export function collectReferences(
  graph: ReferenceGraph,
  rootId: string,
  filter?: ReferenceFilter,
): readonly Reference[] {
  const collected: Reference[] = [];
  visitReferences(
    graph,
    rootId,
    (reference) => {
      collected.push(reference);
    },
    { filter },
  );
  return collected;
}

/** The symbol ids reachable from `rootId` through resolved references. */
export function reachableSymbols(
  graph: ReferenceGraph,
  rootId: string,
  filter?: ReferenceFilter,
): readonly string[] {
  const visited = new Set<string>();
  visitReferences(
    graph,
    rootId,
    () => {
      // no-op; visitReferences tracks visited symbol ids for us
    },
    { filter, visited },
  );
  return [...visited];
}

/** The number of references reachable from `rootId`. */
export function reachableCount(graph: ReferenceGraph, rootId: string): number {
  return collectReferences(graph, rootId).length;
}
