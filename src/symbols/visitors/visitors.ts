import type { Symbol } from "../models/index.js";
import type { SymbolFilter } from "../filters/index.js";
import { acceptAll } from "../filters/index.js";

/** The traversal direction. */
export type TraversalOrder = "pre-order" | "post-order";

/** A visitor callback. Return `false` to prune a subtree. */
export type SymbolVisitor = (symbol: Symbol, depth: number) => boolean | void;

export interface WalkOptions {
  readonly order?: TraversalOrder;
  readonly filter?: SymbolFilter;
  readonly visited?: Set<string>;
}

/** Depth-first traversal over a symbol tree. */
export function visitSymbols(
  root: Symbol,
  visitor: SymbolVisitor,
  options: WalkOptions = {},
): void {
  const order = options.order ?? "pre-order";
  const filter = options.filter ?? acceptAll;
  const visited = options.visited ?? new Set<string>();

  const walk = (symbol: Symbol, depth: number): void => {
    if (!filter(symbol)) return;
    if (visited.has(symbol.id)) return;
    visited.add(symbol.id);

    if (order === "pre-order" && visitor(symbol, depth) === false) return;
    for (const childId of symbol.childrenIds) {
      const child = symbol.symbols.get(childId);
      if (child !== undefined) walk(child, depth + 1);
    }
    if (order === "post-order") void visitor(symbol, depth);
  };

  walk(root, 0);
}

/** Walks a set of sibling symbols. */
export function visitSymbolsMany(
  roots: readonly Symbol[],
  visitor: SymbolVisitor,
  options: WalkOptions = {},
): void {
  for (const root of roots) visitSymbols(root, visitor, options);
}

/** Collects every symbol (including `root`) into an array. */
export function collectSymbols(root: Symbol, filter?: SymbolFilter): readonly Symbol[] {
  const collected: Symbol[] = [];
  visitSymbols(
    root,
    (symbol) => {
      collected.push(symbol);
    },
    { filter },
  );
  return collected;
}

/** The ancestors of `symbol`, nearest first. */
export function ancestorSymbols(symbol: Symbol): readonly Symbol[] {
  const ancestors: Symbol[] = [];
  let current = symbol.parentId !== undefined ? symbol.symbols.get(symbol.parentId) : undefined;
  while (current !== undefined) {
    ancestors.push(current);
    current = current.parentId !== undefined ? current.symbols.get(current.parentId) : undefined;
  }
  return ancestors;
}

/** The direct children of `symbol` in declaration order. */
export function childSymbols(symbol: Symbol): readonly Symbol[] {
  return symbol.childrenIds
    .map((childId) => symbol.symbols.get(childId))
    .filter((child): child is Symbol => child !== undefined);
}

/** The leaves of the symbol tree rooted at `root`. */
export function leafSymbols(root: Symbol): readonly Symbol[] {
  const leaves: Symbol[] = [];
  visitSymbols(root, (_symbol) => {
    if (_symbol.childrenIds.length === 0) leaves.push(_symbol);
  });
  return leaves;
}

/** The number of descendant symbols (excluding `root`). */
export function descendantCount(root: Symbol): number {
  let count = 0;
  visitSymbols(root, (_symbol, depth) => {
    if (depth > 0) count += 1;
  });
  return count;
}

/** The maximum depth of the tree rooted at `root`. */
export function maxDepth(root: Symbol): number {
  let deepest = 0;
  visitSymbols(root, (_, depth) => {
    if (depth > deepest) deepest = depth;
  });
  return deepest;
}
