import type { Symbol, ModuleSymbol, SymbolExtractionResult } from "../../symbols/index.js";
import type { ReferenceResolutionResult } from "../../references/index.js";
import { createKnowledgeGraph, type KnowledgeGraph } from "../models/index.js";
import type { KnowledgeNode, KnowledgeEdge } from "../models/index.js";
import {
  createGraphContributorRegistry,
  type GraphContributorRegistry,
} from "../registry/index.js";
import { builtinContributors } from "../contributors/index.js";
import type { GraphBuildContext } from "../contracts/index.js";

/** Options for creating a {@link GraphEngine}. */
export interface GraphEngineOptions {
  readonly registry?: GraphContributorRegistry;
  /** Whether to register the built-in contributors (default: true). */
  readonly autoRegisterBuiltins?: boolean;
}

/** A graph build request: a symbol extraction plus an optional resolution. */
export interface GraphBuildRequest {
  readonly rootDir: string;
  readonly extraction: SymbolExtractionResult;
  /** The reference resolution of the same extraction; optional for structural-only graphs. */
  readonly resolution?: ReferenceResolutionResult;
  readonly requestId?: string;
}

/**
 * The graph engine — the facade of the knowledge-graph layer.
 *
 * Derives the universal knowledge graph from a symbol extraction and its
 * reference resolution: contributors add nodes and edges, the engine merges,
 * deduplicates and freezes them into one serializable graph with statistics.
 * Builds with an identical request signature are memoized and served without
 * recomputation. The graph is derived, never annotated.
 */
export interface GraphEngine {
  readonly registry: GraphContributorRegistry;
  build(request: GraphBuildRequest): KnowledgeGraph;
  /** Drops the memoized result; the next build recomputes the graph. */
  invalidate(): void;
  /** Drops the memoized result and resets cache counters. */
  clearCache(): void;
  dispose(): void;
}

function buildRequestKey(request: GraphBuildRequest): string {
  return [
    request.requestId ?? "",
    request.extraction.requestId,
    request.resolution?.requestId ?? "",
  ].join("|");
}

/** Creates a new {@link GraphEngine}. */
export function createGraphEngine(options: GraphEngineOptions = {}): GraphEngine {
  const registry = options.registry ?? createGraphContributorRegistry();
  if (options.autoRegisterBuiltins ?? true) {
    for (const contributor of builtinContributors) registry.register(contributor);
  }

  let memo: { readonly key: string; readonly graph: KnowledgeGraph } | undefined;
  let cacheHits = 0;
  let cacheMisses = 0;
  let disposed = false;

  const assertNotDisposed = (): void => {
    if (disposed) throw new Error("GraphEngine has been disposed.");
  };

  return {
    registry,

    build(request: GraphBuildRequest): KnowledgeGraph {
      assertNotDisposed();
      const key = buildRequestKey(request);
      if (memo !== undefined && memo.key === key) {
        cacheHits += 1;
        return memo.graph;
      }

      cacheMisses += 1;
      const symbols = new Map<string, Symbol>();
      for (const symbol of request.extraction.symbols) symbols.set(symbol.id, symbol);

      const modules = new Map<string, ModuleSymbol>();
      for (const module of request.extraction.modules) {
        const file = module.metadata.location.file;
        if (file.length > 0) modules.set(file, module as ModuleSymbol);
      }

      const references = request.resolution?.references ?? [];
      const context: GraphBuildContext = {
        rootDir: request.rootDir,
        ...(request.requestId !== undefined ? { requestId: request.requestId } : {}),
        symbols,
        modules,
        references,
      };

      const nodes: KnowledgeNode[] = [];
      const edges: KnowledgeEdge[] = [];
      for (const contributor of registry.list()) {
        const contribution = contributor.contributes(context);
        nodes.push(...contribution.nodes);
        edges.push(...contribution.edges);
      }

      const resolved = references.filter((reference) => reference.resolved).length;
      const graph = createKnowledgeGraph({
        nodes,
        edges,
        resolvedReferenceCount: resolved,
        unresolvedReferenceCount: references.length - resolved,
        cacheHits,
        cacheMisses,
      });

      memo = { key, graph };
      return graph;
    },

    invalidate(): void {
      memo = undefined;
    },

    clearCache(): void {
      memo = undefined;
      cacheHits = 0;
      cacheMisses = 0;
    },

    dispose(): void {
      disposed = true;
      memo = undefined;
    },
  };
}
