import { readFile, resolvePath } from "../../filesystem/index.js";
import { extensionOf, normalizeExtension, satisfiesVersion } from "../../languages/utils/index.js";
import type { LanguageManager } from "../../languages/index.js";
import type {
  CompilerAdapter,
  CompilerSession,
  NativeCompilationOutput,
} from "../contracts/adapter.js";
import {
  CompilerDiagnosticCode,
  createCompilerDiagnostic,
  type CompilerDiagnostic,
} from "../contracts/diagnostics.js";
import type {
  CompilerEvent,
  CompilerEventListener,
  CompilerEvents,
  CompilerSubscription,
} from "../contracts/events.js";
import type { CompileRequest } from "../contracts/request.js";
import {
  createCompilerCache,
  type CompilerCache,
  type CompilerCacheOptions,
} from "../cache/index.js";
import { createCompilationContext } from "../models/context.js";
import { createCompilationResult } from "../models/result.js";
import { createCompilationStatistics } from "../models/statistics.js";
import { createCompilationUnit } from "../models/unit.js";
import {
  createCompilerRegistry,
  type CompilerRegistry,
  type RegistrationResult,
} from "../registry/index.js";
import type { CompilationResult, CompilationUnit } from "../results/index.js";
import {
  createEventEmitter,
  fingerprintCompileRequest,
  hashContent,
  nowMs,
} from "../shared/index.js";
import { builtinCompilers } from "../builtin/index.js";

/** Options for creating a {@link CompilerManager}. */
export interface CompilerManagerOptions {
  /** The manager API version compiler adapters can require against. */
  readonly apiVersion?: string;
  /** A custom registry. Defaults to a fresh {@link CompilerRegistry}. */
  readonly registry?: CompilerRegistry;
  /** Enable the compiler cache. Defaults to `true`. */
  readonly cache?: boolean;
  /** Cache options (max entries, ...). */
  readonly cacheOptions?: CompilerCacheOptions;
  /** Register the built-in TypeScript/JavaScript compilers. Defaults to `true`. */
  readonly autoRegisterBuiltins?: boolean;
  /** A language manager used to detect languages when a request omits them. */
  readonly languages?: LanguageManager;
}

/** The default compiler-manager API version. */
export const DEFAULT_COMPILER_API_VERSION = "1.0.0";

let requestCounter = 0;

/**
 * The compiler manager — the single entry point to the compiler layer.
 *
 * Responsible for compiler discovery/registration, lifecycle, compilation
 * requests, incremental compilation, cache management and watch events. The
 * engine communicates with compilers exclusively through this manager; the
 * manager never exposes native compiler objects.
 */
export class CompilerManager {
  private readonly registry: CompilerRegistry;
  private readonly apiVersion: string;
  private readonly cacheEnabled: boolean;
  private readonly cache: CompilerCache;
  private readonly languages?: LanguageManager;
  private readonly emitter = createEventEmitter<CompilerEvents>();
  private readonly sessions = new Map<string, CompilerSession>();
  private readonly projectFiles = new Map<string, Set<string>>();
  private diagnosticsList: CompilerDiagnostic[] = [];
  private ready = false;

  constructor(options: CompilerManagerOptions = {}) {
    this.registry = options.registry ?? createCompilerRegistry();
    this.apiVersion = options.apiVersion ?? DEFAULT_COMPILER_API_VERSION;
    this.cacheEnabled = options.cache ?? true;
    this.cache = createCompilerCache(options.cacheOptions);
    this.languages = options.languages;
    if (options.autoRegisterBuiltins ?? true) {
      for (const adapter of builtinCompilers) this.register(adapter);
    }
  }

  /** Marks the manager ready (compiler lifecycle). Idempotent. */
  async initialize(): Promise<void> {
    this.ready = true;
  }

  /** Whether the manager has been initialised. */
  get isReady(): boolean {
    return this.ready;
  }

  /** Releases sessions, caches and diagnostics. Compilers stay registered. */
  async dispose(): Promise<void> {
    this.ready = false;
    for (const session of this.sessions.values()) session.dispose();
    this.sessions.clear();
    for (const adapter of this.registry.all()) {
      adapter.hooks?.onDispose?.();
    }
    this.cache.clear();
    this.projectFiles.clear();
    this.diagnosticsList = [];
    this.emitter.clear();
  }

  /** The number of registered compilers. */
  size(): number {
    return this.registry.size();
  }

  /** Whether a compiler id is registered. */
  has(id: string): boolean {
    return this.registry.has(id);
  }

  /** All registered compiler adapters (priority-sorted). */
  all(): readonly CompilerAdapter[] {
    return this.registry.all();
  }

  /** Looks up a compiler adapter by exact id. */
  get(id: string): CompilerAdapter | undefined {
    return this.registry.get(id);
  }

  /** Resolves a compiler by id or by language id. */
  resolve(idOrLanguage: string): CompilerAdapter | undefined {
    const byId = this.registry.get(idOrLanguage);
    if (byId !== undefined) return byId;
    return this.registry.byLanguage(idOrLanguage)[0];
  }

  /** Resolves a compiler, throwing when none is registered. */
  require(idOrLanguage: string): CompilerAdapter {
    const adapter = this.resolve(idOrLanguage);
    if (adapter === undefined) {
      throw new Error(
        `No compiler adapter registered for "${idOrLanguage}". Register one via register() first.`,
      );
    }
    return adapter;
  }

  /** Compilers associated with a language (priority-sorted). */
  byLanguage(languageId: string): readonly CompilerAdapter[] {
    return this.registry.byLanguage(languageId);
  }

  /** Compilers declaring a capability (priority-sorted). */
  byCapability(capability: string): readonly CompilerAdapter[] {
    return this.registry.byCapability(capability);
  }

  /** Compilers declaring an extension (priority-sorted). */
  byExtension(extension: string): readonly CompilerAdapter[] {
    return this.registry.byExtension(extension);
  }

  /** Registers a compiler adapter and runs its lifecycle hooks. */
  register(adapter: CompilerAdapter): RegistrationResult {
    const result = this.registry.register(adapter);
    this.diagnosticsList.push(...result.diagnostics);
    if (result.status !== "invalid") {
      this.checkApiCompatibility(adapter);
      const hooks = adapter.hooks;
      if (hooks?.onRegister !== undefined) {
        const returned = hooks.onRegister(this.handle);
        if (returned !== undefined && typeof (returned as Promise<unknown>).then === "function") {
          (returned as Promise<unknown>).catch(() => undefined);
        }
      }
    }
    return result;
  }

  /** Unregisters a compiler adapter, disposing any active session. */
  unregister(id: string): boolean {
    const adapter = this.registry.get(id);
    if (adapter !== undefined) {
      adapter.hooks?.onUnregister?.(this.handle);
      this.sessions.get(id)?.dispose();
      this.sessions.delete(id);
    }
    return this.registry.unregister(id);
  }

  /** The capability level of a resolved compiler, or `0`. */
  capabilityLevel(idOrLanguage: string, capability: string): 0 | 1 | 2 {
    const adapter = this.resolve(idOrLanguage);
    return adapter === undefined
      ? 0
      : this.registry.capabilityLevelOf(adapter.metadata.id, capability);
  }

  /** Whether a resolved compiler declares a capability. */
  hasCapability(idOrLanguage: string, capability: string): boolean {
    const adapter = this.resolve(idOrLanguage);
    return adapter !== undefined && this.registry.hasCapability(adapter.metadata.id, capability);
  }

  /** Configuration of a resolved compiler, if any. */
  configuration(idOrLanguage: string): CompilerAdapter["configuration"] {
    return this.resolve(idOrLanguage)?.configuration;
  }

  /** All diagnostics recorded since the last {@link clearDiagnostics}. */
  getDiagnostics(): readonly CompilerDiagnostic[] {
    return Object.freeze([...this.diagnosticsList]);
  }

  /** Clears recorded diagnostics. */
  clearDiagnostics(): void {
    this.diagnosticsList = [];
  }

  /** Clears the compiler cache. */
  clearCache(): void {
    this.cache.clear();
    this.projectFiles.clear();
  }

  /** Invalidates cached entries for one or more files (or everything). */
  invalidate(compilerId?: string, file?: string): void {
    this.cache.invalidate(compilerId, file);
    if (file !== undefined) {
      for (const files of this.projectFiles.values()) files.delete(file);
    } else if (compilerId === undefined) {
      this.projectFiles.clear();
    }
  }

  /**
   * Compiles the requested files into a universal {@link CompilationResult}.
   *
   * Never throws: failures produce partial results with normalized
   * diagnostics, letting downstream systems continue.
   */
  async compile(request: CompileRequest): Promise<CompilationResult> {
    const started = nowMs();
    const requestId = request.requestId ?? `compile-${Date.now()}-${requestCounter++}`;
    const compiler = this.resolveCompiler(request);
    if (compiler === undefined) {
      return this.missingCompilerResult(request, requestId, started);
    }
    const compilerId = compiler.metadata.id;
    const languageId = compiler.metadata.languageId;

    this.emitter.emit("compilation-started", {
      requestId,
      compilerId,
      languageId,
      files: [...request.files],
      timestamp: Date.now(),
    });

    const contents = this.resolveContents(request);
    const hashes: Record<string, string> = {};
    for (const file of request.files) hashes[file] = hashContent(contents[file] ?? "");

    const handled: string[] = [];
    const skipped: string[] = [];
    for (const file of request.files) {
      if (compiler.metadata.extensions.some((e) => normalizeExtension(extensionOf(file)) === e)) {
        handled.push(file);
      } else {
        skipped.push(file);
      }
    }

    const cacheEnabled = this.cacheEnabled && !(request.options?.skipCache ?? false);
    const incremental = request.incremental ?? cacheEnabled;
    const previous = this.projectFiles.get(compilerId);
    const removed: string[] =
      previous === undefined ? [] : [...previous].filter((f) => !request.files.includes(f));
    const changed =
      incremental && cacheEnabled
        ? handled.filter((f) => this.cache.hasChanged(compilerId, f, hashes[f]!))
        : handled;
    const affected = this.transitiveDependents(compilerId, changed);
    const toCompile =
      incremental && cacheEnabled
        ? [...new Set([...changed, ...affected])].filter((f) => request.files.includes(f))
        : handled;
    const cachedFiles =
      incremental && cacheEnabled ? handled.filter((f) => !toCompile.includes(f)) : [];

    let output: NativeCompilationOutput;
    if (incremental && cacheEnabled && toCompile.length === 0) {
      output = {
        units: [],
        dependencies: {},
        failedFiles: [],
        diagnostics: [],
      };
    } else {
      output = await this.runCompiler(compiler, {
        rootDir: request.rootDir,
        files: toCompile,
        contents,
        languageId,
        options: request.options,
        requestId,
      });
    }

    const unitByFile = new Map(output.units.map((unit) => [unit.file, unit]));
    for (const unit of output.units) {
      this.cache.putUnit(compilerId, unit.file, unit, output.dependencies[unit.file] ?? []);
    }

    const units: CompilationUnit[] = handled.map((file) => {
      const unit = unitByFile.get(file);
      if (unit !== undefined) return unit;
      const cached = this.cache.getUnit(compilerId, file);
      if (cached !== undefined) return cached;
      return createCompilationUnit({
        file,
        languageId,
        compilerId,
        status: "skipped",
        diagnostics: [],
        hash: hashes[file]!,
      });
    });

    const diagnostics: CompilerDiagnostic[] = [...output.diagnostics];
    const skippedUnits: CompilationUnit[] = skipped.map((file) => {
      diagnostics.push(
        createCompilerDiagnostic({
          code: CompilerDiagnosticCode.UnsupportedSyntax,
          severity: "warning",
          message: `File "${file}" is not handled by compiler "${compilerId}".`,
          compilerId,
          languageId,
          file,
        }),
      );
      return createCompilationUnit({
        file,
        languageId,
        compilerId,
        status: "skipped",
        diagnostics: [],
        hash: hashes[file]!,
      });
    });

    const failedFiles = [...new Set([...output.failedFiles])].filter((f) =>
      request.files.includes(f),
    );
    const renamed = this.detectRenames(compilerId, changed, removed, hashes);
    const changedFiles = [...new Set([...changed, ...Object.keys(renamed)])].sort();

    this.cache.putResult(
      compilerId,
      fingerprintCompileRequest(compilerId, request.files, {
        ...(request.options ?? {}),
        languageId,
      }),
      createCompilationResult({
        requestId,
        compilerId,
        languageId,
        rootDir: request.rootDir,
        units: [...units, ...skippedUnits],
        failedFiles,
        cachedFiles: [...cachedFiles].sort(),
        skippedFiles: [...skipped].sort(),
        changedFiles,
        removedFiles: [...removed].sort(),
        dependencies: output.dependencies,
        diagnostics,
        statistics: createCompilationStatistics({
          totalFiles: request.files.length,
          compiledFiles: toCompile.length,
          skippedFiles: [...new Set([...skipped, ...cachedFiles])].length,
          cachedFiles: cachedFiles.length,
          failedFiles: failedFiles.length,
          totalTimeMs: nowMs() - started,
          compileTimeMs: units.reduce((sum, unit) => sum + unit.compileTimeMs, 0),
          treeNodes: units.reduce((sum, unit) => sum + (unit.syntaxTree?.nodeCount ?? 0), 0),
          cached: toCompile.length === 0 && incremental && cacheEnabled,
          ...(output.nativeVersion !== undefined ? { nativeVersion: output.nativeVersion } : {}),
        }),
        context: createCompilationContext({
          requestId,
          rootDir: request.rootDir,
          languageId,
          compilerId,
          files: [...request.files],
          compiledFiles: [...toCompile],
          mode: incremental && cacheEnabled ? "incremental" : "full",
          workspace: request.workspace,
          options: request.options ?? {},
        }),
      }),
    );

    const result = this.cache.getResult(
      compilerId,
      fingerprintCompileRequest(compilerId, request.files, {
        ...(request.options ?? {}),
        languageId,
      }),
    )!;

    if (changed.length > 0 || removed.length > 0) {
      this.emitter.emit("project-updated", {
        requestId,
        compilerId,
        languageId,
        changed: changedFiles,
        added: [...changed].sort(),
        removed: [...removed].sort(),
        renamed,
        timestamp: Date.now(),
      });
    }
    for (const unit of [...units, ...skippedUnits]) {
      this.emitter.emit("file-recompiled", {
        requestId,
        compilerId,
        languageId,
        file: unit.file,
        status: unit.status,
        timestamp: Date.now(),
      });
    }

    const files = new Set(this.projectFiles.get(compilerId));
    for (const file of request.files) files.add(file);
    for (const file of removed) files.delete(file);
    this.projectFiles.set(compilerId, files);

    if (result.ok) {
      this.emitter.emit("compilation-finished", {
        requestId,
        compilerId,
        languageId,
        result,
        timestamp: Date.now(),
      });
    } else {
      this.emitter.emit("compilation-failed", {
        requestId,
        compilerId,
        languageId,
        result,
        timestamp: Date.now(),
      });
    }
    return result;
  }

  /** Subscribes to a compiler watch event. Returns an unsubscribe handle. */
  on<E extends CompilerEvent>(event: E, listener: CompilerEventListener<E>): CompilerSubscription {
    const off = this.emitter.on(event, listener as CompilerEventListener<CompilerEvent>);
    return { off };
  }

  /** Emits a compiler watch event (used by tests and extensions). */
  emit<E extends CompilerEvent>(event: E, payload: CompilerEvents[E]): void {
    this.emitter.emit(event, payload);
  }

  private async runCompiler(
    compiler: CompilerAdapter,
    input: Parameters<CompilerAdapter["compile"]>[0],
  ): Promise<NativeCompilationOutput> {
    const session = this.sessions.get(compiler.metadata.id);
    if (session !== undefined) {
      try {
        return await session.compile(input);
      } catch (error) {
        return this.failureOutput(
          compiler.metadata.id,
          compiler.metadata.languageId,
          input.files,
          error,
        );
      }
    }
    if (compiler.createIncrementalSession !== undefined && this.cacheEnabled) {
      const created = compiler.createIncrementalSession(input);
      if (created !== undefined) {
        this.sessions.set(compiler.metadata.id, created);
        try {
          return await created.compile(input);
        } catch (error) {
          return this.failureOutput(
            compiler.metadata.id,
            compiler.metadata.languageId,
            input.files,
            error,
          );
        }
      }
    }
    try {
      return await compiler.compile(input);
    } catch (error) {
      return this.failureOutput(
        compiler.metadata.id,
        compiler.metadata.languageId,
        input.files,
        error,
      );
    }
  }

  private failureOutput(
    compilerId: string,
    languageId: string,
    files: readonly string[],
    error: unknown,
  ): NativeCompilationOutput {
    return {
      units: [],
      dependencies: {},
      failedFiles: [...files],
      diagnostics: [
        createCompilerDiagnostic({
          code: CompilerDiagnosticCode.CompilationFailed,
          severity: "error",
          message: error instanceof Error ? error.message : String(error),
          compilerId,
          languageId,
        }),
      ],
    };
  }

  private resolveContents(request: CompileRequest): Readonly<Record<string, string>> {
    const contents: Record<string, string> = {};
    for (const file of request.files) {
      const provided = request.contents?.[file];
      if (provided !== undefined) {
        contents[file] = provided;
        continue;
      }
      try {
        contents[file] = readFile(resolvePath(request.rootDir, ...file.split("/")));
      } catch {
        contents[file] = "";
      }
    }
    return contents;
  }

  private resolveCompiler(request: CompileRequest): CompilerAdapter | undefined {
    if (request.compilerId !== undefined) {
      const byId = this.registry.get(request.compilerId);
      if (byId !== undefined) return byId;
    }
    let languageId = request.languageId;
    if (languageId === undefined && this.languages !== undefined) {
      languageId = this.languages.detectLanguage({
        rootDir: request.rootDir,
        files: request.files,
      })?.languageId;
    }
    if (languageId !== undefined) {
      const byLanguage = this.registry.byLanguage(languageId);
      if (byLanguage.length > 0) return byLanguage[0];
    }
    for (const file of request.files) {
      const byExtension = this.registry.byExtension(normalizeExtension(extensionOf(file)));
      if (byExtension.length > 0) return byExtension[0];
    }
    return undefined;
  }

  private transitiveDependents(compilerId: string, changed: readonly string[]): readonly string[] {
    const affected = new Set<string>(changed);
    const known = this.projectFiles.get(compilerId) ?? [];
    let grew = true;
    while (grew) {
      grew = false;
      for (const file of known) {
        if (affected.has(file)) continue;
        const dependencies = this.cache.getDependencies(compilerId, file) ?? [];
        if (dependencies.some((dependency) => affected.has(dependency))) {
          affected.add(file);
          grew = true;
        }
      }
    }
    return [...affected];
  }

  private detectRenames(
    compilerId: string,
    changed: readonly string[],
    removed: readonly string[],
    hashes: Readonly<Record<string, string>>,
  ): Record<string, string> {
    const renamed: Record<string, string> = {};
    for (const oldFile of removed) {
      const oldHash = this.cache.getHash(compilerId, oldFile);
      if (oldHash === undefined) continue;
      const newFile = changed.find((file) => hashes[file] === oldHash);
      if (newFile !== undefined) renamed[newFile] = oldFile;
    }
    return renamed;
  }

  private missingCompilerResult(
    request: CompileRequest,
    requestId: string,
    started: number,
  ): CompilationResult {
    const languageId = request.languageId ?? "unknown";
    const diagnostic = createCompilerDiagnostic({
      code: CompilerDiagnosticCode.MissingCompiler,
      severity: "error",
      message: `No compiler adapter registered for this request. Register one via register() first.`,
      languageId,
    });
    return createCompilationResult({
      requestId,
      compilerId: "unknown",
      languageId,
      rootDir: request.rootDir,
      units: [],
      failedFiles: [...request.files],
      diagnostics: [diagnostic],
      statistics: createCompilationStatistics({
        totalFiles: request.files.length,
        failedFiles: request.files.length,
        totalTimeMs: nowMs() - started,
      }),
      context: createCompilationContext({
        requestId,
        rootDir: request.rootDir,
        languageId,
        compilerId: "unknown",
        files: [...request.files],
        compiledFiles: [],
        mode: "full",
        options: request.options ?? {},
      }),
    });
  }

  private checkApiCompatibility(adapter: CompilerAdapter): void {
    const minimum = adapter.minimumApiVersion;
    if (minimum !== undefined && !satisfiesVersion(this.apiVersion, minimum)) {
      this.diagnosticsList.push(
        createCompilerDiagnostic({
          code: CompilerDiagnosticCode.ConfigurationError,
          severity: "error",
          message: `Compiler adapter "${adapter.metadata.id}" requires API version "${minimum}" but the manager is at "${this.apiVersion}".`,
          compilerId: adapter.metadata.id,
        }),
      );
    }
  }

  private readonly handle = {
    register: (adapter: CompilerAdapter): { compilerId: string } => {
      const result = this.register(adapter);
      return { compilerId: result.compilerId };
    },
    unregister: (id: string): boolean => this.unregister(id),
    get: (id: string): { id: string; displayName: string } | undefined => {
      const adapter = this.get(id);
      return adapter === undefined
        ? undefined
        : { id: adapter.metadata.id, displayName: adapter.metadata.displayName };
    },
    compile: (request: CompileRequest): Promise<CompilationResult> => this.compile(request),
  };
}

/** Creates a new {@link CompilerManager}, optionally pre-registering built-ins. */
export function createCompilerManager(options: CompilerManagerOptions = {}): CompilerManager {
  return new CompilerManager(options);
}
