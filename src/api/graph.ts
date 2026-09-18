/**
 * API Relationship Graph.
 *
 * Builds a directed graph of relationships between API symbols:
 * - `extends`: class/interface extends another
 * - `implements`: class implements interface
 * - `returns`: function returns a type defined in the API
 * - `parameters`: function parameter is a type defined in the API
 * - `uses`: type alias references another type
 * - `overloads`: groups overloaded signatures
 * - `member-of`: method/property belongs to a class/interface
 *
 * The graph is used by the page generator to produce cross-references
 * and by the validation layer to detect broken references.
 */

import type { ApiSymbol } from "./models.js";

/** Edge kind in the API graph. */
export type ApiEdgeKind =
  "extends" | "implements" | "returns" | "parameters" | "uses" | "overloads" | "member-of";

/** A directed edge in the API graph. */
export interface ApiEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: ApiEdgeKind;
  readonly label?: string;
}

/** Query result for graph traversal. */
export interface ApiGraphQuery {
  readonly symbol: ApiSymbol;
  readonly edges: readonly ApiEdge[];
  readonly related: readonly ApiSymbol[];
}

/** The API relationship graph. */
export interface ApiGraph {
  /** All edges. */
  readonly edges: readonly ApiEdge[];
  /** Edges indexed by source symbol id. */
  readonly edgesByFrom: ReadonlyMap<string, ApiEdge[]>;
  /** Edges indexed by target symbol id. */
  readonly edgesByTo: ReadonlyMap<string, ApiEdge[]>;
  /** Get outgoing edges for a symbol. */
  readonly outgoing: (symbolId: string, kind?: ApiEdgeKind) => ApiEdge[];
  /** Get incoming edges for a symbol. */
  readonly incoming: (symbolId: string, kind?: ApiEdgeKind) => ApiEdge[];
  /** Get related symbols for a symbol. */
  readonly related: (symbolId: string, kind?: ApiEdgeKind) => ApiSymbol[];
  /** Get all symbols that extend/implement a given symbol. */
  readonly subtypes: (symbolId: string) => ApiSymbol[];
  /** Get all symbols that are extended/implemented by a given symbol. */
  readonly supertypes: (symbolId: string) => ApiSymbol[];
}

/**
 * Build an API relationship graph from a set of symbols.
 *
 * @param symbols - All API symbols to analyze.
 * @returns The relationship graph.
 *
 * @example
 * ```ts
 * const graph = buildApiGraph(symbols);
 * const related = graph.related(classSymbol.id, "implements");
 * ```
 */
export function buildApiGraph(symbols: readonly ApiSymbol[]): ApiGraph {
  const symbolsById = new Map<string, ApiSymbol>();
  const symbolsByQualifiedName = new Map<string, ApiSymbol>();
  for (const sym of symbols) {
    symbolsById.set(sym.id, sym);
    symbolsByQualifiedName.set(sym.qualifiedName, sym);
    symbolsByQualifiedName.set(sym.name, sym);
  }

  const edges: ApiEdge[] = [];

  for (const sym of symbols) {
    // extends edges
    if (sym.extends !== undefined) {
      const target = findSymbolByName(sym.extends, symbols, symbolsById);
      if (target !== undefined) {
        edges.push({
          from: sym.id,
          to: target!.id,
          kind: "extends",
          label: sym.extends,
        });
      }
    }

    // implements edges
    if (sym.implements !== undefined) {
      for (const iface of sym.implements) {
        const target = findSymbolByName(iface, symbols, symbolsById);
        if (target !== undefined) {
          edges.push({
            from: sym.id,
            to: target!.id,
            kind: "implements",
            label: iface,
          });
        }
      }
    }

    // returns edges
    if (sym.returnType !== undefined) {
      const target = findSymbolByTypeName(sym.returnType, symbols, symbolsById);
      if (target !== undefined) {
        edges.push({
          from: sym.id,
          to: target!.id,
          kind: "returns",
          label: sym.returnType,
        });
      }
    }

    // parameters edges
    if (sym.parameters !== undefined) {
      for (const param of sym.parameters) {
        const target = findSymbolByTypeName(param.type, symbols, symbolsById);
        if (target !== undefined) {
          edges.push({
            from: sym.id,
            to: target!.id,
            kind: "parameters",
            label: param.name,
          });
        }
      }
    }

    // member-of edges (for members of classes/interfaces)
    if (
      sym.kind === "method" ||
      sym.kind === "property" ||
      sym.kind === "constructor" ||
      sym.kind === "getter" ||
      sym.kind === "setter"
    ) {
      const parentName = sym.qualifiedName.split(".").slice(0, -1).join(".");
      const parent = symbols.find((s) => s.qualifiedName === parentName);
      if (parent !== undefined) {
        edges.push({
          from: parent.id,
          to: sym.id,
          kind: "member-of",
          label: sym.name,
        });
      }
    }

    // overloads edges
    if (sym.overloads !== undefined && sym.overloads.length > 0) {
      for (const overload of sym.overloads) {
        edges.push({
          from: sym.id,
          to: overload.id,
          kind: "overloads",
          label: "overload",
        });
      }
    }

    // uses edges (for type aliases referencing other types)
    if (sym.kind === "type-alias" && sym.returnType !== undefined) {
      const referencedTypes = extractTypeReferences(sym.returnType);
      for (const typeName of referencedTypes) {
        const target = symbols.find((s) => s.name === typeName || s.qualifiedName === typeName);
        if (target !== undefined && target.id !== sym.id) {
          edges.push({
            from: sym.id,
            to: target!.id,
            kind: "uses",
            label: typeName,
          });
        }
      }
    }
  }

  // Build indices
  const edgesByFrom = new Map<string, ApiEdge[]>();
  const edgesByTo = new Map<string, ApiEdge[]>();

  for (const edge of edges) {
    (edgesByFrom.get(edge.from) ?? edgesByFrom.set(edge.from, []).get(edge.from)!).push(edge);
    (edgesByTo.get(edge.to) ?? edgesByTo.set(edge.to, []).get(edge.to)!).push(edge);
  }

  // Build symbol lookup
  function findSymbolByName(
    name: string,
    allSymbols: readonly ApiSymbol[],
    _byId: Map<string, ApiSymbol>,
  ): ApiSymbol | undefined {
    // Try exact qualified name match first
    const byQN = symbolsByQualifiedName.get(name);
    if (byQN !== undefined) return byQN;
    // Try simple name match
    const simple = name.split(".").pop() ?? name;
    return allSymbols.find((s) => s.name === simple);
  }

  function findSymbolByTypeName(
    typeName: string,
    allSymbols: readonly ApiSymbol[],
    byId: Map<string, ApiSymbol>,
  ): ApiSymbol | undefined {
    // Strip array notation, generics, etc.
    const cleaned = typeName
      .replace(/\[\]$/, "")
      .replace(/<[^>]*>/g, "")
      .replace(/\s/g, "");
    return findSymbolByName(cleaned, allSymbols, byId);
  }

  function outgoing(symbolId: string, kind?: ApiEdgeKind): ApiEdge[] {
    const edges = edgesByFrom.get(symbolId) ?? [];
    return kind !== undefined ? edges.filter((e) => e.kind === kind) : edges;
  }

  function incoming(symbolId: string, kind?: ApiEdgeKind): ApiEdge[] {
    const edges = edgesByTo.get(symbolId) ?? [];
    return kind !== undefined ? edges.filter((e) => e.kind === kind) : edges;
  }

  function related(symbolId: string, kind?: ApiEdgeKind): ApiSymbol[] {
    const outEdges = outgoing(symbolId, kind);
    const inEdges = incoming(symbolId, kind);
    const ids = new Set([...outEdges.map((e) => e.to), ...inEdges.map((e) => e.from)]);
    return [...ids].map((id) => symbolsById.get(id)).filter((s): s is ApiSymbol => s !== undefined);
  }

  function subtypes(symbolId: string): ApiSymbol[] {
    const inEdges = incoming(symbolId).filter(
      (e) => e.kind === "extends" || e.kind === "implements",
    );
    return inEdges
      .map((e) => symbolsById.get(e.from))
      .filter((s): s is ApiSymbol => s !== undefined);
  }

  function supertypes(symbolId: string): ApiSymbol[] {
    const outEdges = outgoing(symbolId).filter(
      (e) => e.kind === "extends" || e.kind === "implements",
    );
    return outEdges
      .map((e) => symbolsById.get(e.to))
      .filter((s): s is ApiSymbol => s !== undefined);
  }

  return {
    edges,
    edgesByFrom,
    edgesByTo,
    outgoing,
    incoming,
    related,
    subtypes,
    supertypes,
  };
}

/** Extract referenced type names from a type string (simple heuristic). */
function extractTypeReferences(typeStr: string): string[] {
  const refs: string[] = [];
  // Match capitalized identifiers that look like type references
  const typeRefPattern = /\b([A-Z]\w+)\b/g;
  let match;
  while ((match = typeRefPattern.exec(typeStr)) !== null) {
    refs.push(match[1]!);
  }
  // Also match generic parameter types
  const genericPattern = /<([A-Z]\w+)(?:\s*,\s*([A-Z]\w+))*>/g;
  while ((match = genericPattern.exec(typeStr)) !== null) {
    if (match[1] !== undefined) refs.push(match[1]);
    if (match[2] !== undefined) refs.push(match[2]);
  }
  return [...new Set(refs)];
}
