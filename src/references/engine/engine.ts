import type { Symbol, ModuleSymbol, SymbolExtractionResult } from "../../symbols/index.js";
import type { LanguageManager } from "../../languages/index.js";
import { createLanguageManager } from "../../languages/index.js";
import type { CompilationUnit } from "../../compiler/index.js";
import { resolveRelativeTarget } from "../../compiler/index.js";
import type { PackageInfo } from "../../types/public.js";
import type { ReferenceResolverCapabilities } from "../contracts/capabilities.js";
import type { ReferenceBindingInput } from "../contracts/input.js";
import type { ReferenceResolverRegistry } from "../registry/index.js";
import { createReferenceResolverRegistry } from "../registry/index.js";
import { ReferenceCache } from "../cache/index.js";
import type { Reference, ReferenceDiagnostic, ReferenceFileBindings } from "../models/index.js";
import { createReferenceDiagnostic, emptyFileBindings } from "../models/index.js";
import type { ReferenceGraph } from "../graph/index.js";
import { buildReferenceEdges, createReferenceGraph } from "../graph/index.js";
import type { ModuleScopes } from "../scope/index.js";
import { buildModuleScopes } from "../scope/index.js";
import { buildOwnershipTree, type OwnershipTree } from "../ownership/index.js";
import {
  aliasEdges,
  detectCycles,
  inheritanceEdges,
  moduleEdges,
  packageEdges,
  type DetectedCycle,
} from "../cycles/index.js";
import {
  detectSpecialReferenceDiagnostics,
  detectUnresolvedReferences,
} from "../diagnostics/index.js";
import { builtinResolvers } from "../resolvers/index.js";

/** Options for creating a {@link ReferenceEngine}. */
export interface ReferenceEngineOptions {
  /** The language manager used to derive import extensions. Defaults to a fresh one. */
  readonly languages?: LanguageManager;
  /** A custom resolver registry. Defaults to a fresh one with built-ins. */
  readonly registry?: ReferenceResolverRegistry;
  /** A shared incremental binding cache. */
  readonly cache?: ReferenceCache;
  /** Register the built-in resolvers. Defaults to `true`. */
  readonly autoRegisterBuiltins?: boolean;
}

/**
 * A reference resolution request.
 *
 * The engine consumes a finished symbol extraction and (optionally) the
 * compilation units behind it. Without units, only module-level references
 * and local/export name resolution happen; name bindings require units.
 */
export interface ReferenceRequest {
  /** The project root directory. */
  readonly rootDir: string;
  /** A symbol extraction result produced by the symbol engine. */
  readonly extraction: SymbolExtractionResult;
  /** Compilation units for binding recovery (optional but recommended). */
  readonly units?: readonly CompilationUnit[];
  /** Skip the incremental binding cache. Defaults to `false`. */
  readonly skipCache?: boolean;
  /** A caller-supplied request id (auto-generated when omitted). */
  readonly requestId?: string;
  /** Discovered package metadata (used for package/workspace/dependency refs). */
  readonly packages?: readonly PackageInfo[];
}

/** The resolution summary for a single language. */
export interface PerLanguageResolution {
  readonly languageId: string;
  readonly resolverId: string;
  readonly files: number;
  readonly extractedFiles: number;
  readonly cachedFiles: number;
  readonly bindings: number;
  readonly references: number;
  readonly diagnosticsCount: number;
  readonly resolveTimeMs: number;
}

/** Aggregate counters for one resolution request. */
export interface ReferenceEngineStatistics {
  readonly files: number;
  readonly extractedFiles: number;
  readonly cachedFiles: number;
  readonly symbolCount: number;
  readonly moduleCount: number;
  readonly referenceCount: number;
  readonly resolvedCount: number;
  readonly unresolvedCount: number;
  readonly diagnosticsCount: number;
  readonly resolveTimeMs: number;
  /** References reused from the incremental cache. */
  readonly reusedReferenceCount: number;
  /** Number of detected cycles. */
  readonly cycleCount: number;
  /** Number of ownership edges in the graph. */
  readonly ownershipCount: number;
}

/** The result of a reference resolution request. */
export interface ReferenceResolutionResult {
  readonly requestId: string;
  readonly rootDir: string;
  readonly projectName: string;
  readonly symbols: readonly Symbol[];
  readonly modules: readonly ModuleSymbol[];
  readonly references: readonly Reference[];
  readonly diagnostics: readonly ReferenceDiagnostic[];
  readonly graph: ReferenceGraph;
  readonly statistics: ReferenceEngineStatistics;
  readonly resolutions: readonly PerLanguageResolution[];
  /** The explicit ownership tree (Package → Module → Class → …). */
  readonly ownership: OwnershipTree;
  /** The detected cycles across imports/inheritance/aliases/packages. */
  readonly cycles: readonly DetectedCycle[];
}

/**
 * The reference engine — the facade of the reference layer.
 *
 * Transforms an isolated symbol extraction into a connected reference network:
 * recovers import/export name bindings through the language resolvers, builds
 * per-module scopes, resolves every reference (imports, exports, re-exports,
 * heritage, type aliases) and derives the reference graph. Incremental
 * binding recovery is transparent: files whose module hash is unchanged are
 * served from the internal cache.
 */
export interface ReferenceEngine {
  readonly registry: ReferenceResolverRegistry;
  resolve(request: ReferenceRequest): ReferenceResolutionResult;
  invalidate(file?: string): void;
  clearCache(): void;
  getCached(file: string): ReferenceFileBindings | undefined;
  capabilitiesOf(languageId: string): ReferenceResolverCapabilities | undefined;
  dispose(): void;
}

let requestCounter = 0;

class ReferenceEngineImpl implements ReferenceEngine {
  readonly registry: ReferenceResolverRegistry;
  private readonly languages: LanguageManager;
  private readonly cache: ReferenceCache;
  private readonly moduleReferenceCache = new Map<
    string,
    { hash: string; references: readonly Reference[] }
  >();
  private disposed = false;

  constructor(options: ReferenceEngineOptions = {}) {
    this.languages = options.languages ?? createLanguageManager();
    this.registry = options.registry ?? createReferenceResolverRegistry();
    this.cache = options.cache ?? new ReferenceCache();
    if (options.autoRegisterBuiltins ?? true) {
      for (const resolver of builtinResolvers) this.registry.register(resolver);
    }
  }

  resolve(request: ReferenceRequest): ReferenceResolutionResult {
    this.assertNotDisposed();
    const requestId = request.requestId ?? `reference-${Date.now()}-${requestCounter++}`;
    const projectName = request.extraction.projectName;

    const symbols = new Map<string, Symbol>();
    for (const symbol of request.extraction.symbols) symbols.set(symbol.id, symbol);

    const modules = new Map<string, ModuleSymbol>();
    for (const module of request.extraction.modules) {
      const file = module.metadata.location.file;
      if (file.length > 0) modules.set(file, module as ModuleSymbol);
    }

    const diagnostics: ReferenceDiagnostic[] = [];
    const knownFiles = new Set(modules.keys());
    const extensions = [...new Set(this.languages.all().flatMap((model) => model.extensions))];
    const resolveModule = (fromFile: string, specifier: string): string | undefined =>
      resolveRelativeTarget(request.rootDir, fromFile, specifier, extensions, knownFiles);

    const bindings = new Map<string, ReferenceFileBindings>();
    const fileToHash = new Map<string, string>();
    for (const module of modules.values()) {
      fileToHash.set(module.metadata.location.file, module.metadata.hash);
    }

    const perLanguage: PerLanguageResolution[] = [];
    const extractedFiles = new Set<string>();
    const unknown: string[] = [];
    for (const module of modules.values()) {
      if (this.registry.resolve(module.metadata.languageId) === undefined) {
        unknown.push(module.metadata.location.file);
      }
    }
    for (const file of unknown) {
      diagnostics.push(
        createReferenceDiagnostic({
          code: "missing-resolver",
          severity: "warning",
          message: `No reference resolver registered for the module of "${file}".`,
          languageId: "unknown",
          resolverId: "none",
          file,
        }),
      );
    }

    const byLanguage = this.groupByLanguage(modules, new Set(unknown));
    for (const [languageId, files] of byLanguage) {
      const { summary, extracted } = this.resolveLanguage({
        request,
        requestId,
        languageId,
        files,
        fileToHash,
        diagnostics,
        bindings,
      });
      perLanguage.push(summary);
      for (const file of extracted) extractedFiles.add(file);
    }

    const scopes: ModuleScopes = buildModuleScopes({
      symbols,
      modules,
      bindings,
      resolveModule,
    });

    const ownership: OwnershipTree = buildOwnershipTree(symbols);

    // Incremental: reuse per-module references whose module hash is unchanged.
    const { references, reusedCount } = this.reuseReferences(modules, fileToHash, {
      symbols,
      modules,
      scopes,
      resolveModule,
      packages: request.packages,
      ownership,
    });

    const graph = createReferenceGraph(references, symbols, modules);

    // Circular detection over imports, inheritance, aliases and packages.
    const cycles = this.detectAllCycles(graph, request.packages);

    diagnostics.push(...detectUnresolvedReferences(graph, { symbols }));
    diagnostics.push(...detectSpecialReferenceDiagnostics(graph, { symbols }));

    for (const cycle of cycles) {
      diagnostics.push(
        createReferenceDiagnostic({
          code: "circular-reference",
          severity: "warning",
          message: `Circular ${cycle.kind} dependency detected: ${cycle.nodes.join(" → ")}.`,
          languageId: "unknown",
          resolverId: "none",
          symbolId: cycle.nodes[0],
          referenceName: cycle.nodes.join("→"),
        }),
      );
    }

    const referenceCount = graph.references.length;
    const resolvedCount = graph.references.filter((reference) => reference.resolved).length;

    const totals = this.computeTotals(graph, modules, perLanguage, diagnostics, extractedFiles);
    const ownershipCount = references.filter((reference) => reference.kind === "ownership").length;

    return {
      requestId,
      rootDir: request.rootDir,
      projectName,
      symbols: Object.freeze(request.extraction.symbols),
      modules: Object.freeze(request.extraction.modules) as readonly ModuleSymbol[],
      references: graph.references,
      diagnostics: Object.freeze(diagnostics),
      graph,
      statistics: Object.freeze({
        files: totals.files,
        extractedFiles: totals.extractedFiles,
        cachedFiles: totals.cachedFiles,
        symbolCount: totals.symbolCount,
        moduleCount: totals.moduleCount,
        diagnosticsCount: totals.diagnosticsCount,
        resolveTimeMs: totals.resolveTimeMs,
        referenceCount,
        resolvedCount,
        unresolvedCount: referenceCount - resolvedCount,
        reusedReferenceCount: reusedCount,
        cycleCount: cycles.length,
        ownershipCount,
      }),
      resolutions: Object.freeze(totals.resolutions),
      ownership,
      cycles: Object.freeze(cycles),
    };
  }

  /** Reuses cached per-module references for unchanged modules. */
  private reuseReferences(
    modules: ReadonlyMap<string, ModuleSymbol>,
    fileToHash: ReadonlyMap<string, string>,
    input: {
      symbols: ReadonlyMap<string, Symbol>;
      modules: ReadonlyMap<string, ModuleSymbol>;
      scopes: ModuleScopes;
      resolveModule: (fromFile: string, specifier: string) => string | undefined;
      packages?: readonly PackageInfo[];
      ownership: OwnershipTree;
    },
  ): { references: readonly Reference[]; reusedCount: number } {
    const moduleReferenceCache = this.moduleReferenceCache;
    const changedFiles = new Set<string>();
    for (const module of modules.values()) {
      const file = module.metadata.location.file;
      const hash = fileToHash.get(file) ?? "";
      const cached = moduleReferenceCache.get(file);
      if (cached === undefined || cached.hash !== hash) changedFiles.add(file);
    }

    let reusedCount = 0;
    if (changedFiles.size === 0 && moduleReferenceCache.size > 0) {
      const allReused: Reference[] = [];
      for (const cached of moduleReferenceCache.values()) {
        allReused.push(...cached.references);
      }
      const globalEdges = buildReferenceEdges({ ...input, moduleFilter: new Set<string>() });
      const merged = [...allReused, ...globalEdges];
      const deduped = [...new Map(merged.map((reference) => [reference.id, reference])).values()];
      return {
        references: this.orderReferences(deduped, modules, input.symbols),
        reusedCount: allReused.length,
      };
    }

    const graphInput = { ...input, moduleFilter: changedFiles };
    const freshReferences = buildReferenceEdges(graphInput);

    const references: Reference[] = [];
    for (const module of modules.values()) {
      const file = module.metadata.location.file;
      const cached = moduleReferenceCache.get(file);
      if (cached !== undefined && cached.hash === (fileToHash.get(file) ?? "")) {
        references.push(...cached.references);
        reusedCount += cached.references.length;
      }
    }
    references.push(...freshReferences);

    // Rebuild the per-module cache entries for changed modules.
    for (const module of modules.values()) {
      const file = module.metadata.location.file;
      if (!changedFiles.has(file)) continue;
      const perModule = freshReferences.filter((reference) => {
        const symbol = input.symbols.get(reference.fromId);
        return symbol?.metadata.location.file === file;
      });
      moduleReferenceCache.set(file, {
        hash: fileToHash.get(file) ?? "",
        references: Object.freeze(perModule),
      });
    }
    const deduped = [...new Map(references.map((reference) => [reference.id, reference])).values()];
    return { references: this.orderReferences(deduped, modules, input.symbols), reusedCount };
  }

  /**
   * Orders references canonically: per-module references grouped by the
   * from-symbol's file (in module order), then global edges
   * (ownership/containment/dependency) sorted by id. Produces identical
   * arrays for fresh and reused builds.
   */
  private orderReferences(
    references: readonly Reference[],
    modules: ReadonlyMap<string, ModuleSymbol>,
    symbols: ReadonlyMap<string, Symbol>,
  ): readonly Reference[] {
    const isGlobalKind = (kind: Reference["kind"]): boolean =>
      kind === "ownership" ||
      kind === "containment" ||
      kind === "dependency" ||
      kind === "circular";
    const moduleFiles = new Set<string>();
    for (const module of modules.values()) moduleFiles.add(module.metadata.location.file);
    const fileOf = (reference: Reference): string | undefined =>
      symbols.get(reference.fromId)?.metadata.location.file;
    const byFile = new Map<string, Reference[]>();
    const global: Reference[] = [];
    for (const reference of references) {
      if (isGlobalKind(reference.kind)) {
        global.push(reference);
        continue;
      }
      const file = fileOf(reference) ?? "";
      const list = byFile.get(file) ?? [];
      list.push(reference);
      byFile.set(file, list);
    }
    const ordered: Reference[] = [];
    for (const module of modules.values()) {
      const file = module.metadata.location.file;
      ordered.push(...(byFile.get(file) ?? []));
      byFile.delete(file);
    }
    for (const [file, refs] of byFile) {
      if (file === "" || !moduleFiles.has(file)) continue;
      ordered.push(...refs);
    }
    ordered.push(...global.sort((a, b) => a.id.localeCompare(b.id)));
    return Object.freeze(ordered);
  }

  /** Detects cycles across imports, inheritance, aliases and package deps. */
  private detectAllCycles(
    graph: ReferenceGraph,
    packages: readonly PackageInfo[] | undefined,
  ): readonly DetectedCycle[] {
    const cycles: DetectedCycle[] = [];
    for (const kind of ["imports", "inheritance", "aliases"] as const) {
      const edges =
        kind === "imports"
          ? moduleEdges(graph.references)
          : kind === "inheritance"
            ? inheritanceEdges(graph.references)
            : aliasEdges(graph.references);
      cycles.push(...detectCycles(edges, kind).cycles);
    }
    if (packages !== undefined && packages.length > 0) {
      const dependencies: { from: string; to: string }[] = [];
      for (const pkg of packages) {
        for (const name of Object.keys(pkg.dependencies ?? {})) {
          dependencies.push({ from: pkg.name, to: name });
        }
        for (const name of Object.keys(pkg.devDependencies ?? {})) {
          dependencies.push({ from: pkg.name, to: name });
        }
      }
      cycles.push(...detectCycles(packageEdges(dependencies), "packages").cycles);
      const workspaceEdges = new Map<string, string[]>();
      for (const { from, to } of dependencies) {
        if (!packages.some((pkg) => pkg.name === to)) continue;
        const list = workspaceEdges.get(from) ?? [];
        if (!list.includes(to)) list.push(to);
        workspaceEdges.set(from, list);
      }
      cycles.push(...detectCycles(workspaceEdges, "workspaces").cycles);
    }
    return cycles;
  }

  invalidate(file?: string): void {
    if (file === undefined) {
      this.cache.clear();
      this.moduleReferenceCache.clear();
    } else {
      this.cache.delete(file);
      this.moduleReferenceCache.delete(file);
    }
  }

  clearCache(): void {
    this.cache.clear();
    this.moduleReferenceCache.clear();
  }

  getCached(file: string): ReferenceFileBindings | undefined {
    return this.cache.peek(file);
  }

  capabilitiesOf(languageId: string): ReferenceResolverCapabilities | undefined {
    return this.registry.capabilitiesOf(languageId);
  }

  dispose(): void {
    if (this.disposed) return;
    for (const resolver of this.registry.list()) {
      resolver.hooks?.onDispose?.();
    }
    this.cache.clear();
    this.moduleReferenceCache.clear();
    this.disposed = true;
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error("ReferenceEngine has been disposed.");
    }
  }

  private groupByLanguage(
    modules: ReadonlyMap<string, ModuleSymbol>,
    skipFiles: ReadonlySet<string>,
  ): Map<string, string[]> {
    const byLanguage = new Map<string, string[]>();
    for (const module of modules.values()) {
      const file = module.metadata.location.file;
      if (skipFiles.has(file)) continue;
      const languageId = module.metadata.languageId;
      byLanguage.set(languageId, [...(byLanguage.get(languageId) ?? []), file]);
    }
    return byLanguage;
  }

  private resolveLanguage(input: {
    request: ReferenceRequest;
    requestId: string;
    languageId: string;
    files: readonly string[];
    fileToHash: ReadonlyMap<string, string>;
    diagnostics: ReferenceDiagnostic[];
    bindings: Map<string, ReferenceFileBindings>;
  }): { summary: PerLanguageResolution; extracted: ReadonlySet<string> } {
    const resolver = this.registry.resolve(input.languageId)!;
    const resolverId = resolver.metadata.id;
    const skipCache = input.request.skipCache ?? false;
    const fileSet = new Set(input.files);

    const units = (input.request.units ?? [])
      .filter((unit) => unit.languageId === input.languageId && fileSet.has(unit.file))
      .sort((a, b) => a.file.localeCompare(b.file));

    const changedUnits = units.filter(
      (unit) => skipCache || !this.cache.has(unit.file, input.fileToHash.get(unit.file) ?? ""),
    );

    let resolveTimeMs = 0;
    if (changedUnits.length > 0) {
      const bindingInput: ReferenceBindingInput = {
        rootDir: input.request.rootDir,
        requestId: input.requestId,
        languageId: input.languageId,
        resolverId,
        units: changedUnits,
        options: { skipCache },
      };
      const output = resolver.extractBindings(bindingInput);
      for (const unit of changedUnits) {
        this.cache.put(
          unit.file,
          input.fileToHash.get(unit.file) ?? "",
          output.bindings[unit.file] ?? emptyFileBindings(unit.file),
        );
      }
      input.diagnostics.push(...output.diagnostics);
      resolveTimeMs = output.statistics.extractTimeMs;
    }

    const extractedFiles = new Set(changedUnits.map((unit) => unit.file));
    for (const file of input.files) {
      const hash = input.fileToHash.get(file) ?? "";
      const cached = this.cache.get(file, hash);
      input.bindings.set(file, cached ?? emptyFileBindings(file));
    }

    const bindingsCount = [...input.bindings.values()].reduce(
      (sum, fileBindings) =>
        sum +
        fileBindings.imports.length +
        fileBindings.exportAliases.length +
        fileBindings.reExports.length,
      0,
    );

    const resolverDiagnostics = input.diagnostics.filter(
      (diagnostic) =>
        diagnostic.languageId === input.languageId || diagnostic.resolverId === resolverId,
    ).length;

    return {
      summary: Object.freeze({
        languageId: input.languageId,
        resolverId,
        files: input.files.length,
        extractedFiles: extractedFiles.size,
        cachedFiles: input.files.length - extractedFiles.size,
        bindings: bindingsCount,
        references: 0,
        diagnosticsCount: resolverDiagnostics,
        resolveTimeMs,
      }),
      extracted: extractedFiles,
    };
  }

  private computeTotals(
    graph: ReferenceGraph,
    modules: ReadonlyMap<string, ModuleSymbol>,
    perLanguage: readonly PerLanguageResolution[],
    diagnostics: readonly ReferenceDiagnostic[],
    extractedFiles: ReadonlySet<string>,
  ): {
    files: number;
    extractedFiles: number;
    cachedFiles: number;
    symbolCount: number;
    moduleCount: number;
    diagnosticsCount: number;
    resolveTimeMs: number;
    resolutions: readonly PerLanguageResolution[];
  } {
    const languageOf = new Map<string, string>();
    for (const module of modules.values()) {
      languageOf.set(module.metadata.location.file, module.metadata.languageId);
    }
    const referenceCounts = new Map<string, number>();
    for (const reference of graph.references) {
      const symbol = graph.symbols.get(reference.fromId);
      const file = symbol?.metadata.location.file;
      const languageId = file !== undefined ? languageOf.get(file) : undefined;
      if (languageId === undefined) continue;
      referenceCounts.set(languageId, (referenceCounts.get(languageId) ?? 0) + 1);
    }

    let cachedFiles = 0;
    let resolveTimeMs = 0;
    for (const resolution of perLanguage) {
      cachedFiles += resolution.cachedFiles;
      resolveTimeMs += resolution.resolveTimeMs;
    }

    const resolutions: PerLanguageResolution[] = perLanguage.map((resolution) =>
      Object.freeze({
        ...resolution,
        references: referenceCounts.get(resolution.languageId) ?? 0,
      }),
    );

    return {
      files: modules.size,
      extractedFiles: extractedFiles.size,
      cachedFiles,
      symbolCount: graph.symbols.size,
      moduleCount: modules.size,
      diagnosticsCount: diagnostics.length,
      resolveTimeMs,
      resolutions,
    };
  }
}

/** Creates a new {@link ReferenceEngine}. */
export function createReferenceEngine(options: ReferenceEngineOptions = {}): ReferenceEngine {
  return new ReferenceEngineImpl(options);
}
