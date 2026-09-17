import type { LanguageAdapter } from "../contracts/adapter.js";
import {
  createDiagnostic,
  LanguageDiagnosticCode,
  type LanguageDiagnostic,
} from "../contracts/diagnostics.js";
import type { DetectionInput, DetectionSignal } from "../contracts/detection.js";
import type { CapabilityModel } from "../models/capabilities.js";
import type { CommentStandardModel } from "../models/comment.js";
import type { ConfigurationModel } from "../models/configuration.js";
import { createDetectionResultModel, type DetectionResultModel } from "../models/detection.js";
import type { FrameworkAssociationModel } from "../models/framework.js";
import type { LanguageModel } from "../models/language.js";
import {
  createLanguageRegistry,
  type LanguageRegistry,
  type RegistrationResult,
} from "../registry/index.js";
import { capabilityLevel, hasCapability, type CapabilityLevel } from "../utils/capabilities.js";
import { fingerprintDetectionInput } from "../utils/detection.js";
import { extensionOf, normalizeExtension } from "../utils/extension.js";
import { satisfiesVersion } from "../utils/version.js";
import { builtinAdapters } from "../builtin/index.js";

/** Options for creating a {@link LanguageManager}. */
export interface LanguageManagerOptions {
  /** The manager API version adapters can require against. */
  readonly apiVersion?: string;
  /** A custom registry. Defaults to a fresh {@link LanguageRegistry}. */
  readonly registry?: LanguageRegistry;
  /** Register the built-in TypeScript/JavaScript adapters. Defaults to `true`. */
  readonly autoRegisterBuiltins?: boolean;
  /** Cache detection results by input fingerprint. Defaults to `true`. */
  readonly cache?: boolean;
}

/** The default manager API version. */
export const DEFAULT_API_VERSION = "1.0.0";

/**
 * The language manager — the single entry point to the language subsystem.
 *
 * Responsible for registering, loading, resolving and detecting language
 * adapters, adapter lifecycle and capability discovery. The core engine
 * communicates with programming languages exclusively through this manager.
 */
export class LanguageManager {
  private readonly registry: LanguageRegistry;
  private readonly apiVersion: string;
  private readonly cacheEnabled: boolean;
  private readonly detectCache = new Map<string, readonly DetectionResultModel[]>();
  private diagnosticsList: LanguageDiagnostic[] = [];
  private ready = false;

  constructor(options: LanguageManagerOptions = {}) {
    this.registry = options.registry ?? createLanguageRegistry();
    this.apiVersion = options.apiVersion ?? DEFAULT_API_VERSION;
    this.cacheEnabled = options.cache ?? true;
    if (options.autoRegisterBuiltins ?? true) {
      for (const adapter of builtinAdapters) this.register(adapter);
    }
  }

  /** Marks the manager ready (adapter lifecycle). Idempotent. */
  async initialize(): Promise<void> {
    this.ready = true;
  }

  /** Whether the manager has been initialised. */
  get isReady(): boolean {
    return this.ready;
  }

  /** Releases detection caches and diagnostics. Adapters stay registered. */
  async dispose(): Promise<void> {
    this.ready = false;
    this.detectCache.clear();
    this.diagnosticsList = [];
  }

  /** The number of registered languages. */
  size(): number {
    return this.registry.size();
  }

  /** Whether a language id is registered. */
  has(id: string): boolean {
    return this.registry.has(id);
  }

  /** All registered language models (priority-sorted). */
  all(): readonly LanguageModel[] {
    return this.registry.all();
  }

  /** Looks up a language by exact id. */
  get(id: string): LanguageModel | undefined {
    return this.registry.get(id);
  }

  /** Looks up a language by id or alias (case-insensitive). */
  resolve(idOrAlias: string): LanguageModel | undefined {
    const direct = this.registry.get(idOrAlias);
    if (direct !== undefined) return direct;
    const lowered = idOrAlias.toLowerCase();
    return this.registry.all().find((model) => model.aliases.some((alias) => alias === lowered));
  }

  /** Resolves a language, throwing when no adapter is registered. */
  require(idOrAlias: string): LanguageModel {
    const model = this.resolve(idOrAlias);
    if (model === undefined) {
      throw new Error(
        `No language adapter registered for "${idOrAlias}". Register one via register() first.`,
      );
    }
    return model;
  }

  /** Languages declaring `extension` (priority-sorted). */
  byExtension(extension: string): readonly LanguageModel[] {
    return this.registry.byExtension(extension);
  }

  /** Languages declaring `mimeType` (priority-sorted). */
  byMimeType(mimeType: string): readonly LanguageModel[] {
    return this.registry.byMimeType(mimeType);
  }

  /** Languages declaring exact basename `name`. */
  byFileName(name: string): readonly LanguageModel[] {
    return this.registry.byFileName(name);
  }

  /** Languages associated with `frameworkId`. */
  byFramework(frameworkId: string): readonly LanguageModel[] {
    return this.registry.byFramework(frameworkId);
  }

  /** Registers a language adapter and runs its lifecycle hooks. */
  register(adapter: LanguageAdapter): RegistrationResult {
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

  /** Unregisters a language adapter and runs its lifecycle hooks. */
  unregister(id: string): boolean {
    const model = this.registry.get(id);
    if (model !== undefined) {
      model.adapter.hooks?.onUnregister?.(this.handle);
    }
    return this.registry.unregister(id);
  }

  /** All diagnostics recorded since the last {@link clearDiagnostics}. */
  getDiagnostics(): readonly LanguageDiagnostic[] {
    return Object.freeze([...this.diagnosticsList]);
  }

  /** Clears recorded diagnostics. */
  clearDiagnostics(): void {
    this.diagnosticsList = [];
  }

  /** Diagnostics for extensions no adapter claims (`unsupported-language`). */
  diagnoseUnsupported(extensions: readonly string[]): readonly LanguageDiagnostic[] {
    const unmatched = [...new Set(extensions.map(normalizeExtension))].filter(
      (extension) => this.registry.byExtension(extension).length === 0,
    );
    return unmatched.map((extension) =>
      createDiagnostic({
        code: LanguageDiagnosticCode.UnsupportedLanguage,
        severity: "warning",
        message: `No language adapter registered for extension "${extension}".`,
      }),
    );
  }

  /** Diagnostics for language ids no adapter claims (`unknown-language`). */
  diagnoseUnknown(languageIds: readonly string[]): readonly LanguageDiagnostic[] {
    const missing = [...new Set(languageIds.map((id) => id.toLowerCase()))].filter(
      (id) => !this.registry.has(id),
    );
    return missing.map((id) =>
      createDiagnostic({
        code: LanguageDiagnosticCode.UnknownLanguage,
        severity: "warning",
        message: `Unknown language "${id}": no adapter is registered.`,
        languageId: id,
      }),
    );
  }

  /** Diagnostics for adapters expected but not registered (`missing-adapter`). */
  diagnoseMissing(languageIds: readonly string[]): readonly LanguageDiagnostic[] {
    const missing = [...new Set(languageIds.map((id) => id.toLowerCase()))].filter(
      (id) => !this.registry.has(id),
    );
    return missing.map((id) =>
      createDiagnostic({
        code: LanguageDiagnosticCode.MissingAdapter,
        severity: "error",
        message: `Missing language adapter for "${id}".`,
        languageId: id,
      }),
    );
  }

  /** The capability map of a registered language, if present. */
  capabilities(idOrAlias: string): CapabilityModel | undefined {
    return this.resolve(idOrAlias)?.capabilities;
  }

  /** Whether a registered language declares a capability above `none`. */
  hasCapability(idOrAlias: string, capability: string): boolean {
    const capabilities = this.capabilities(idOrAlias);
    return capabilities !== undefined && hasCapability(capabilities, capability);
  }

  /** The capability level of a registered language. */
  capabilityLevel(idOrAlias: string, capability: string): CapabilityLevel {
    const capabilities = this.capabilities(idOrAlias);
    return capabilities !== undefined ? capabilityLevel(capabilities, capability) : 0;
  }

  /** Framework associations of a registered language. */
  frameworks(idOrAlias: string): readonly FrameworkAssociationModel[] {
    return this.resolve(idOrAlias)?.frameworkSupport ?? [];
  }

  /** Configuration models of a registered language. */
  configurations(idOrAlias: string): readonly ConfigurationModel[] {
    return this.resolve(idOrAlias)?.configuration ?? [];
  }

  /** Comment standards of a registered language. */
  commentStandards(idOrAlias: string): readonly CommentStandardModel[] {
    return this.resolve(idOrAlias)?.commentStandards ?? [];
  }

  /**
   * Detects the languages present in `input`, ordered by confidence.
   *
   * Results are cached per input fingerprint; call {@link clearCache} to
   * invalidate. Multiple languages in one project are all returned.
   */
  detect(input: DetectionInput): readonly DetectionResultModel[] {
    const key = this.cacheEnabled ? fingerprintDetectionInput(input) : undefined;
    if (key !== undefined) {
      const cached = this.detectCache.get(key);
      if (cached !== undefined) return cached;
    }
    const results = this.runDetection(input);
    if (key !== undefined) this.detectCache.set(key, results);
    return results;
  }

  /** The highest-confidence language in `input`, if any. */
  detectLanguage(input: DetectionInput): DetectionResultModel | undefined {
    return this.detect(input)[0];
  }

  /** Clears the detection result cache. */
  clearCache(): void {
    this.detectCache.clear();
  }

  private runDetection(input: DetectionInput): readonly DetectionResultModel[] {
    const candidates = this.prepareCandidates(input);
    const results: DetectionResultModel[] = [];
    for (const model of this.registry.all()) {
      const custom = model.adapter.detect;
      if (custom !== undefined) {
        const customResult = custom(input);
        if (customResult !== null && customResult !== undefined) {
          results.push(
            createDetectionResultModel({
              languageId: model.id,
              confidence: customResult.confidence,
              signals: customResult.signals,
              frameworks: customResult.frameworks,
            }),
          );
        }
        continue;
      }
      const gathered = this.gatherSignals(model, candidates, input);
      if (gathered.weight > 0) {
        results.push(
          createDetectionResultModel({
            languageId: model.id,
            confidence: gathered.weight,
            signals: gathered.signals,
            frameworks: gathered.frameworks,
          }),
        );
      }
    }
    const priority = new Map(this.registry.all().map((model) => [model.id, model.priority]));
    return results.sort(
      (a, b) =>
        b.confidence - a.confidence ||
        (priority.get(b.languageId) ?? 0) - (priority.get(a.languageId) ?? 0) ||
        a.languageId.localeCompare(b.languageId),
    );
  }

  private prepareCandidates(input: DetectionInput): {
    readonly extensions: ReadonlySet<string>;
    readonly fileNames: ReadonlySet<string>;
  } {
    const extensions = new Set<string>();
    const fileNames = new Set<string>();
    for (const extension of input.extensions ?? []) extensions.add(normalizeExtension(extension));
    for (const file of input.files ?? []) {
      const extension = extensionOf(file);
      if (extension) extensions.add(normalizeExtension(extension));
      fileNames.add(file.split("/").at(-1) ?? file);
    }
    for (const name of input.fileNames ?? []) fileNames.add(name);
    return { extensions, fileNames };
  }

  private gatherSignals(
    model: LanguageModel,
    candidates: {
      readonly extensions: ReadonlySet<string>;
      readonly fileNames: ReadonlySet<string>;
    },
    input: DetectionInput,
  ): {
    readonly signals: readonly DetectionSignal[];
    readonly weight: number;
    readonly frameworks: readonly string[];
  } {
    const signals: DetectionSignal[] = [];
    const frameworks = new Set<string>();
    let weight = 0;

    const matchedExtensions = model.extensions.filter((extension) =>
      candidates.extensions.has(extension),
    );
    for (const extension of matchedExtensions.slice(0, 2)) {
      signals.push({ source: "extension", weight: 0.35, detail: extension });
      weight += 0.35;
    }

    const matchedNames = model.fileNames.filter((name) => candidates.fileNames.has(name));
    if (matchedNames.length > 0) {
      signals.push({ source: "fileName", weight: 0.5, detail: matchedNames[0] });
      weight += 0.5;
    }

    const matchedConfigs = (input.configFiles ?? []).filter((name) =>
      model.configFiles.includes(name),
    );
    if (matchedConfigs.length > 0) {
      signals.push({ source: "configFile", weight: 0.55, detail: matchedConfigs[0] });
      weight += 0.55;
    }

    weight += this.gatherFrameworkSignals(model, input, signals, frameworks);

    const matchedLocks = (input.lockfiles ?? []).filter((name) => model.lockfiles.includes(name));
    if (matchedLocks.length > 0) {
      signals.push({ source: "lockfile", weight: 0.2, detail: matchedLocks[0] });
      weight += 0.2;
    }

    if (input.workspace?.monorepo === true && model.configFiles.length > 0) {
      signals.push({ source: "workspace", weight: 0.15, detail: "monorepo" });
      weight += 0.15;
    }

    const repository = input.repository;
    if (repository?.language !== undefined) {
      if (repository.language.toLowerCase() === model.id) {
        signals.push({ source: "repository", weight: 0.6, detail: model.id });
        weight += 0.6;
      } else {
        const topicFramework = (repository.topics ?? []).find((topic) =>
          model.frameworkSupport.some((framework) => framework.id === topic.toLowerCase()),
        );
        if (topicFramework !== undefined) {
          signals.push({ source: "repository", weight: 0.4, detail: topicFramework });
          weight += 0.4;
          frameworks.add(topicFramework);
        }
      }
    }

    for (const frameworkId of input.frameworks ?? []) {
      const framework = model.frameworkSupport.find((fw) => fw.id === frameworkId);
      if (framework !== undefined) {
        signals.push({ source: "framework", weight: 0.5, detail: framework.id });
        weight += 0.5;
        frameworks.add(framework.id);
      }
    }

    return { signals, weight: Math.min(1, weight), frameworks: [...frameworks].sort() };
  }

  private gatherFrameworkSignals(
    model: LanguageModel,
    input: DetectionInput,
    signals: DetectionSignal[],
    frameworks: Set<string>,
  ): number {
    let weight = 0;
    const runtime = input.dependencies ?? {};
    const dev = input.devDependencies ?? {};
    for (const framework of model.frameworkSupport) {
      const runtimeMatch = framework.dependencies.find((dependency) =>
        Object.hasOwn(runtime, dependency),
      );
      if (runtimeMatch !== undefined) {
        signals.push({ source: "dependency", weight: 0.5, detail: framework.id });
        weight += 0.5;
        frameworks.add(framework.id);
        continue;
      }
      const devMatch = framework.dependencies.find((dependency) => Object.hasOwn(dev, dependency));
      if (devMatch !== undefined) {
        signals.push({ source: "devDependency", weight: 0.35, detail: framework.id });
        weight += 0.35;
        frameworks.add(framework.id);
      }
    }
    return Math.min(1, weight);
  }

  private checkApiCompatibility(adapter: LanguageAdapter): void {
    const minimum = adapter.minimumApiVersion;
    if (minimum !== undefined && !satisfiesVersion(this.apiVersion, minimum)) {
      this.diagnosticsList.push(
        createDiagnostic({
          code: LanguageDiagnosticCode.VersionIncompatibility,
          severity: "error",
          message: `Adapter "${adapter.metadata.id}" requires API version "${minimum}" but the manager is at "${this.apiVersion}".`,
          languageId: adapter.metadata.id,
        }),
      );
    }
  }

  private readonly handle = {
    register: (adapter: LanguageAdapter): { languageId: string } => this.register(adapter),
    unregister: (id: string): boolean => this.unregister(id),
    get: (id: string): { id: string; displayName: string } | undefined => {
      const model = this.get(id);
      return model === undefined ? undefined : { id: model.id, displayName: model.displayName };
    },
    detect: (input: DetectionInput): readonly DetectionResultModel[] => this.detect(input),
  };
}

/** Creates a new {@link LanguageManager}, optionally pre-registering built-ins. */
export function createLanguageManager(options: LanguageManagerOptions = {}): LanguageManager {
  return new LanguageManager(options);
}
