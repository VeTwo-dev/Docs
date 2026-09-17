import type { LanguageManager } from "../../languages/index.js";
import { createLanguageManager } from "../../languages/index.js";
import { extensionOf, normalizeExtension } from "../../languages/utils/index.js";
import type { CompilerManager, CompilationResult } from "../../compiler/index.js";
import { createCompilerManager, nowMs, resolveRelativeTarget } from "../../compiler/index.js";
import type { Symbol, SymbolDiagnostic, SymbolInput, SymbolRelationship } from "../models/index.js";
import { createSymbolDiagnostic, isModuleSymbol } from "../models/index.js";
import { buildSymbols } from "../models/index.js";
import type { SymbolExtractorCapabilities } from "../contracts/capabilities.js";
import type { SymbolExtractionInput, SymbolExtractionOptions } from "../contracts/input.js";
import type { SymbolExtractor } from "../contracts/extractor.js";
import type { SymbolExtractorRegistry } from "../registry/index.js";
import { createSymbolExtractorRegistry } from "../registry/index.js";
import { SymbolCache } from "../cache/index.js";
import { buildSymbolGraph, type SymbolGraph } from "../graph/index.js";
import { builtinExtractors } from "../extractors/index.js";
import { packageNameOf, packageSymbolId, projectSymbolId } from "../shared/index.js";
import { stableHash } from "../shared/index.js";
import { symbolToInput } from "../cache/index.js";
import { collectSymbols } from "../visitors/index.js";

/** The sentinel language id used for synthetic project/package roots. */
export const SYNTHETIC_LANGUAGE_ID = "project";

/** Options for creating a {@link SymbolEngine}. */
export interface SymbolEngineOptions {
  /** The language manager used to group files. Defaults to a fresh one. */
  readonly languages?: LanguageManager;
  /** The compiler manager used to compile units. Defaults to a fresh one. */
  readonly compilers?: CompilerManager;
  /** A custom extractor registry. Defaults to a fresh one with built-ins. */
  readonly registry?: SymbolExtractorRegistry;
  /** A shared incremental extraction cache. */
  readonly cache?: SymbolCache;
  /** Register the built-in extractors. Defaults to `true`. */
  readonly autoRegisterBuiltins?: boolean;
}

/** A symbol extraction request. */
export interface SymbolRequest {
  /** The project root directory. */
  readonly rootDir: string;
  /** Relative paths of the files to extract from. */
  readonly files: readonly string[];
  /** File contents keyed by relative path (avoids disk reads). */
  readonly contents?: Readonly<Record<string, string>>;
  /** The project name; defaults to the root directory name. */
  readonly projectName?: string;
  /** Maps a relative file path to its package name. Defaults to `projectName`. */
  readonly packageMapping?: Readonly<Record<string, string>>;
  /** Maps a package name to its version. */
  readonly packageVersions?: Readonly<Record<string, string>>;
  /** Skip the incremental extraction cache. Defaults to `false`. */
  readonly skipCache?: boolean;
  /** Cap the total number of symbols produced. */
  readonly maxSymbols?: number;
  /** A caller-supplied request id (auto-generated when omitted). */
  readonly requestId?: string;
}

/** The extraction summary for a single language. */
export interface PerLanguageExtraction {
  readonly languageId: string;
  readonly extractorId: string;
  readonly files: number;
  readonly extractedFiles: number;
  readonly cachedFiles: number;
  readonly symbolCount: number;
  readonly diagnosticsCount: number;
  readonly extractTimeMs: number;
}

/** Aggregate counters for one extraction request. */
export interface SymbolEngineStatistics {
  readonly files: number;
  readonly extractedFiles: number;
  readonly cachedFiles: number;
  readonly symbolCount: number;
  readonly moduleCount: number;
  readonly packageCount: number;
  readonly diagnosticsCount: number;
  readonly compileTimeMs: number;
  readonly extractTimeMs: number;
}

/** The result of a symbol extraction request. */
export interface SymbolExtractionResult {
  readonly requestId: string;
  readonly rootDir: string;
  readonly projectName: string;
  readonly languageIds: readonly string[];
  /** The root project symbol. */
  readonly project: Symbol;
  readonly packages: readonly Symbol[];
  readonly modules: readonly Symbol[];
  /** Every symbol, sharing one store (project, packages, modules, declarations). */
  readonly symbols: readonly Symbol[];
  readonly relationships: readonly SymbolRelationship[];
  readonly diagnostics: readonly SymbolDiagnostic[];
  readonly graph: SymbolGraph;
  readonly statistics: SymbolEngineStatistics;
  readonly extracts: readonly PerLanguageExtraction[];
}

/**
 * The symbol engine — the facade of the symbol layer.
 *
 * Groups files by language, compiles them through the compiler layer, runs
 * the matching extractors, merges the results into one shared store and
 * builds the structural graph. Incremental extraction is transparent: files
 * whose hash is unchanged are served from the internal cache.
 */
export interface SymbolEngine {
  readonly registry: SymbolExtractorRegistry;
  extract(request: SymbolRequest): Promise<SymbolExtractionResult>;
  invalidate(file?: string): void;
  clearCache(): void;
  getCached(file: string): readonly Symbol[] | undefined;
  capabilitiesOf(languageId: string): SymbolExtractorCapabilities | undefined;
  dispose(): void;
}

let requestCounter = 0;

class SymbolEngineImpl implements SymbolEngine {
  readonly registry: SymbolExtractorRegistry;
  private readonly languages: LanguageManager;
  private readonly compilers: CompilerManager;
  private readonly cache: SymbolCache;
  private disposed = false;

  constructor(options: SymbolEngineOptions = {}) {
    this.languages = options.languages ?? createLanguageManager();
    this.compilers = options.compilers ?? createCompilerManager({ languages: this.languages });
    this.registry = options.registry ?? createSymbolExtractorRegistry();
    this.cache = options.cache ?? new SymbolCache();
    if (options.autoRegisterBuiltins ?? true) {
      for (const extractor of builtinExtractors) this.registry.register(extractor);
    }
  }

  async extract(request: SymbolRequest): Promise<SymbolExtractionResult> {
    this.assertNotDisposed();
    const started = nowMs();
    const requestId = request.requestId ?? `symbol-${Date.now()}-${requestCounter++}`;
    const projectName = request.projectName ?? packageNameOf(basename(request.rootDir));

    const fileToPackage = packageMappingOf(request);
    const grouped = this.groupByLanguage(request.files);
    const diagnostics: SymbolDiagnostic[] = [];

    const modules: Symbol[] = [];
    const extracts: PerLanguageExtraction[] = [];
    let compileTimeMs = 0;

    for (const file of grouped.unknown) {
      diagnostics.push(
        createSymbolDiagnostic({
          code: "missing-extractor",
          severity: "warning",
          message: `No language adapter registered for "${file}".`,
          languageId: "unknown",
          extractorId: "none",
          file,
        }),
      );
    }

    for (const [languageId, files] of grouped.byLanguage) {
      const extractor = this.registry.resolve(languageId);
      if (extractor === undefined) {
        for (const file of files) {
          diagnostics.push(
            createSymbolDiagnostic({
              code: "missing-extractor",
              severity: "warning",
              message: `No symbol extractor registered for language "${languageId}" (file: ${file}).`,
              languageId,
              extractorId: "none",
              file,
            }),
          );
        }
        continue;
      }

      const compilation = await this.compilers.compile({
        rootDir: request.rootDir,
        files,
        contents: request.contents,
        languageId,
        requestId: `${requestId}:${languageId}`,
      });
      compileTimeMs += compilation.statistics.compileTimeMs;
      const perLanguage = this.extractLanguage({
        request,
        requestId,
        projectName,
        fileToPackage,
        languageId,
        extractor,
        compilation,
        diagnostics,
      });
      modules.push(...perLanguage.modules);
      extracts.push(perLanguage.summary);
    }

    const projectAndPackages = this.buildRoots(projectName, fileToPackage, request.packageVersions);
    const allInputs: SymbolInput[] = [
      ...projectAndPackages.inputs,
      ...modules.flatMap((module) => collectSymbols(module).map(symbolToInput)),
    ];
    const { symbols: allSymbols } = buildSymbols(allInputs);
    const project = allSymbols[0]!;
    const packages = allSymbols.slice(1, 1 + projectAndPackages.packageCount);
    const moduleSymbols = allSymbols.filter(isModuleSymbol);

    const graph = buildSymbolGraph(allSymbols, {
      resolveModule: this.moduleResolver(request),
    });

    const extractedFiles = extracts.reduce((sum, e) => sum + e.extractedFiles, 0);
    const cachedFiles = extracts.reduce((sum, e) => sum + e.cachedFiles, 0);

    return {
      requestId,
      rootDir: request.rootDir,
      projectName,
      languageIds: Object.freeze([...grouped.byLanguage.keys()].sort()),
      project,
      packages: Object.freeze(packages),
      modules: Object.freeze(moduleSymbols),
      symbols: Object.freeze(allSymbols),
      relationships: graph.relationships,
      diagnostics: Object.freeze(diagnostics),
      graph,
      statistics: Object.freeze({
        files: request.files.length,
        extractedFiles,
        cachedFiles,
        symbolCount: allSymbols.length,
        moduleCount: moduleSymbols.length,
        packageCount: packages.length,
        diagnosticsCount: diagnostics.length,
        compileTimeMs,
        extractTimeMs: nowMs() - started,
      }),
      extracts: Object.freeze(extracts),
    };
  }

  invalidate(file?: string): void {
    if (file === undefined) this.cache.clear();
    else this.cache.delete(file);
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCached(file: string): readonly Symbol[] | undefined {
    return this.cache.peek(file);
  }

  capabilitiesOf(languageId: string): SymbolExtractorCapabilities | undefined {
    return this.registry.capabilitiesOf(languageId);
  }

  dispose(): void {
    if (this.disposed) return;
    for (const extractor of this.registry.list()) {
      extractor.hooks?.onDispose?.();
    }
    this.cache.clear();
    this.disposed = true;
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error("SymbolEngine has been disposed.");
    }
  }

  private groupByLanguage(files: readonly string[]): {
    byLanguage: Map<string, string[]>;
    unknown: readonly string[];
  } {
    const byLanguage = new Map<string, string[]>();
    const unknown: string[] = [];
    for (const file of files) {
      const extension = normalizeExtension(extensionOf(file));
      const model = this.languages.byExtension(extension)[0];
      if (model === undefined) {
        unknown.push(file);
        continue;
      }
      byLanguage.set(model.id, [...(byLanguage.get(model.id) ?? []), file]);
    }
    return { byLanguage, unknown };
  }

  private extractLanguage(input: {
    request: SymbolRequest;
    requestId: string;
    projectName: string;
    fileToPackage: Readonly<Record<string, string>>;
    languageId: string;
    extractor: SymbolExtractor;
    compilation: CompilationResult;
    diagnostics: SymbolDiagnostic[];
  }): { modules: readonly Symbol[]; summary: PerLanguageExtraction } {
    const skipCache = input.request.skipCache ?? false;
    const options: SymbolExtractionOptions | undefined =
      input.request.maxSymbols !== undefined ? { maxSymbols: input.request.maxSymbols } : undefined;

    const okUnits = input.compilation.units.filter(
      (unit) => unit.status === "ok" && unit.syntaxTree !== undefined,
    );
    const changedUnits = okUnits.filter(
      (unit) => skipCache || !this.cache.has(unit.file, unit.hash),
    );

    const extractionInput: SymbolExtractionInput = {
      rootDir: input.request.rootDir,
      requestId: input.requestId,
      languageId: input.languageId,
      extractorId: input.extractor.metadata.id,
      projectName: input.projectName,
      units: changedUnits,
      fileToPackage: input.fileToPackage,
      options,
    };
    const output = changedUnits.length > 0 ? input.extractor.extract(extractionInput) : undefined;
    if (output !== undefined) {
      for (const unit of changedUnits) {
        const fileModules = output.modules.filter(
          (module) => module.metadata.location.file === unit.file,
        );
        this.cache.put(unit.file, unit.hash, fileModules);
      }
      input.diagnostics.push(...output.diagnostics);
    }

    const extractedByFile = new Map<string, readonly Symbol[]>();
    for (const unit of changedUnits) {
      const fileModules = output?.modules.filter(
        (module) => module.metadata.location.file === unit.file,
      );
      if (fileModules !== undefined && fileModules.length > 0) {
        extractedByFile.set(unit.file, fileModules);
      }
    }

    const modules: Symbol[] = [];
    for (const unit of okUnits) {
      const extracted = extractedByFile.get(unit.file);
      if (extracted !== undefined) {
        modules.push(...extracted);
        continue;
      }
      const cached = this.cache.get(unit.file, unit.hash);
      if (cached !== undefined) modules.push(...cached);
    }

    const summary: PerLanguageExtraction = Object.freeze({
      languageId: input.languageId,
      extractorId: input.extractor.metadata.id,
      files: okUnits.length,
      extractedFiles: changedUnits.length,
      cachedFiles: okUnits.length - changedUnits.length,
      symbolCount: modules.flatMap((module) => collectSymbols(module)).length,
      diagnosticsCount: output?.diagnostics.length ?? 0,
      extractTimeMs: output?.statistics.extractTimeMs ?? 0,
    });

    return { modules, summary };
  }

  private buildRoots(
    projectName: string,
    fileToPackage: Readonly<Record<string, string>>,
    packageVersions: Readonly<Record<string, string>> | undefined,
  ): { inputs: readonly SymbolInput[]; packageCount: number } {
    const packageNames = [...new Set(Object.values(fileToPackage))].sort();
    const projectId = projectSymbolId(projectName);
    const projectInput: SymbolInput = {
      kind: "project",
      identifier: projectName,
      qualifiedName: projectName,
      displayName: projectName,
      visibility: "public",
      modifiers: [],
      file: "",
      languageId: SYNTHETIC_LANGUAGE_ID,
      compiler: { compilerId: "symbol-engine", format: "synthetic" },
      childrenIds: [],
      id: projectId,
      hash: stableHash("project", projectName),
    };
    const packageInputs: SymbolInput[] = packageNames.map((packageName) => ({
      kind: "package",
      identifier: packageName,
      qualifiedName: packageName,
      displayName: packageName,
      visibility: "public",
      modifiers: [],
      file: "",
      languageId: SYNTHETIC_LANGUAGE_ID,
      packageName,
      compiler: { compilerId: "symbol-engine", format: "synthetic" },
      parentId: projectId,
      childrenIds: [],
      id: packageSymbolId(projectName, packageName),
      hash: stableHash("package", projectName, packageName),
      ...(packageVersions?.[packageName] !== undefined
        ? { version: packageVersions[packageName] }
        : {}),
    }));
    return { inputs: [projectInput, ...packageInputs], packageCount: packageInputs.length };
  }

  private moduleResolver(
    request: SymbolRequest,
  ): (fromFile: string, specifier: string) => string | undefined {
    const knownFiles = new Set(request.files);
    const extensions = [...new Set(this.languages.all().flatMap((model) => model.extensions))];
    return (fromFile, specifier) =>
      resolveRelativeTarget(request.rootDir, fromFile, specifier, extensions, knownFiles);
  }
}

function packageMappingOf(request: SymbolRequest): Readonly<Record<string, string>> {
  const mapping: Record<string, string> = {};
  const projectName = request.projectName ?? packageNameOf(basename(request.rootDir));
  for (const file of request.files) {
    mapping[file] = request.packageMapping?.[file] ?? projectName;
  }
  return mapping;
}

function basename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts.filter((part) => part.length > 0).at(-1) ?? "default";
}

/** Creates a new {@link SymbolEngine}. */
export function createSymbolEngine(options: SymbolEngineOptions = {}): SymbolEngine {
  return new SymbolEngineImpl(options);
}
