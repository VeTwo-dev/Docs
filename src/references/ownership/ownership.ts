import type { Symbol, SymbolStore } from "../../symbols/index.js";

/**
 * Explicit ownership representation.
 *
 * Ownership is distinct from references: it describes the containment
 * hierarchy (`Package → Module → Class → Method → Parameter`) derived from the
 * symbol model's `parentId`/`childrenIds` edges, not resolved name bindings.
 */

/** A node in the ownership tree. */
export interface OwnershipNode {
  /** The symbol id. */
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  /** The owning node id, or undefined for the root. */
  readonly parentId?: string;
  readonly children: readonly OwnershipNode[];
}

/** The ownership forest for a project. */
export interface OwnershipTree {
  /** Every ownership node indexed by symbol id. */
  readonly nodes: ReadonlyMap<string, OwnershipNode>;
  /** The roots (top-level owners). */
  readonly roots: readonly OwnershipNode[];
  /** The ownership chain for a symbol id (self → ... → root). */
  chainOf(id: string): readonly OwnershipNode[];
  /** Whether `ancestorId` owns `descendantId` (directly or transitively). */
  owns(ancestorId: string, descendantId: string): boolean;
}

/** Builds the ownership tree from the symbol store. */
export function buildOwnershipTree(symbols: SymbolStore): OwnershipTree {
  const nodes = new Map<string, OwnershipNode>();
  const childrenOf = new Map<string, string[]>();

  for (const symbol of symbols.values()) {
    if (symbol.parentId !== undefined) {
      const list = childrenOf.get(symbol.parentId) ?? [];
      if (!list.includes(symbol.id)) list.push(symbol.id);
      childrenOf.set(symbol.parentId, list);
    }
  }

  const buildNode = (symbol: Symbol): OwnershipNode => {
    const existing = nodes.get(symbol.id);
    if (existing !== undefined) return existing;
    const children = (childrenOf.get(symbol.id) ?? [])
      .map((id) => symbols.get(id))
      .filter((child): child is Symbol => child !== undefined)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(buildNode);
    const node: OwnershipNode = Object.freeze({
      id: symbol.id,
      kind: symbol.kind,
      name: symbol.name,
      ...(symbol.parentId !== undefined ? { parentId: symbol.parentId } : {}),
      children: Object.freeze(children),
    });
    nodes.set(symbol.id, node);
    return node;
  };

  for (const symbol of symbols.values()) buildNode(symbol);

  const roots = [...symbols.values()]
    .filter((symbol) => symbol.parentId === undefined)
    .map((symbol) => nodes.get(symbol.id))
    .filter((node): node is OwnershipNode => node !== undefined)
    .sort((a, b) => a.id.localeCompare(b.id));

  const chainOf = (id: string): readonly OwnershipNode[] => {
    const chain: OwnershipNode[] = [];
    let current = nodes.get(id);
    while (current !== undefined) {
      chain.push(current);
      current = current.parentId !== undefined ? nodes.get(current.parentId) : undefined;
    }
    return Object.freeze(chain);
  };

  const owns = (ancestorId: string, descendantId: string): boolean => {
    return chainOf(descendantId).some((node) => node.id === ancestorId);
  };

  return Object.freeze({
    nodes,
    roots: Object.freeze(roots),
    chainOf,
    owns,
  });
}

/**
 * The ownership chain rendered as paths, e.g.
 * `Package → Module → Class → Method`.
 */
export function ownershipPath(tree: OwnershipTree, id: string): readonly string[] {
  return tree.chainOf(id).map((node) => node.name);
}

/** Builds `ownership` and `containment` reference edges from a tree. */
export function ownershipEdges(
  tree: OwnershipTree,
  nodes: ReadonlyMap<string, Symbol>,
): { kind: "ownership" | "containment"; fromId: string; toId: string }[] {
  const edges: { kind: "ownership" | "containment"; fromId: string; toId: string }[] = [];
  for (const node of tree.nodes.values()) {
    if (node.parentId === undefined) continue;
    if (!nodes.has(node.id)) continue;
    edges.push({
      kind: "ownership",
      fromId: node.parentId,
      toId: node.id,
    });
    edges.push({
      kind: "containment",
      fromId: node.parentId,
      toId: node.id,
    });
  }
  return edges;
}
