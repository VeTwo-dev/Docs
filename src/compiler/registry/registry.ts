import type { CompilerAdapter } from "../contracts/adapter.js";
import type { CompilerCapabilities } from "../contracts/capabilities.js";
import {
  CompilerDiagnosticCode,
  createCompilerDiagnostic,
  type CompilerDiagnostic,
} from "../contracts/diagnostics.js";
import {
  capabilityLevel,
  hasCapability,
  validateCompilerCapabilities,
} from "../shared/capabilities.js";
import { validateCompilerMetadata } from "../shared/metadata.js";
import { normalizeExtension } from "../../languages/utils/extension.js";
import { satisfiesVersion } from "../../languages/utils/version.js";

/** The outcome of registering a compiler adapter. */
export interface RegistrationResult {
  /** `invalid` means the adapter was rejected and not stored. */
  readonly status: "registered" | "replaced" | "conflict" | "invalid";
  /** The compiler adapter id. */
  readonly compilerId: string;
  /** Diagnostics produced during registration. */
  readonly diagnostics: readonly CompilerDiagnostic[];
}

/** Filters applied when resolving a compiler. */
export interface CompilerResolveOptions {
  /** A version requirement the compiler adapter version must satisfy. */
  readonly version?: string;
  /** A capability the compiler must declare. */
  readonly capability?: string;
}

function tokenize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * The compiler registry.
 *
 * Holds adapters keyed by compiler id and maintains lookup indexes for
 * language, extension and capability. Resolution is index-driven with
 * priority ordering, version matching and conflict detection — no hardcoded
 * switches.
 */
export class CompilerRegistry {
  private readonly byId = new Map<string, CompilerAdapter>();
  private readonly languageIndex = new Map<string, Set<string>>();
  private readonly extensionIndex = new Map<string, Set<string>>();
  private readonly capabilityIndex = new Map<string, Set<string>>();

  /** The number of registered compilers. */
  size(): number {
    return this.byId.size;
  }

  /** Whether a compiler id is registered. */
  has(id: string): boolean {
    return this.byId.has(tokenize(id));
  }

  /** All registered compiler adapters, priority-sorted (desc) then id. */
  all(): readonly CompilerAdapter[] {
    return [...this.byId.values()].sort(
      (a, b) =>
        b.metadata.priority - a.metadata.priority || a.metadata.id.localeCompare(b.metadata.id),
    );
  }

  /** Looks up a compiler adapter by id. */
  get(id: string): CompilerAdapter | undefined {
    return this.byId.get(tokenize(id));
  }

  /** Looks up a compiler by id, throwing when missing. */
  getOrThrow(id: string): CompilerAdapter {
    const adapter = this.get(id);
    if (adapter === undefined) {
      throw new Error(`No compiler adapter registered for "${id}".`);
    }
    return adapter;
  }

  /** Registers a compiler adapter, maintaining all lookup indexes. */
  register(adapter: CompilerAdapter): RegistrationResult {
    const compilerId = tokenize(adapter.metadata.id);
    const diagnostics: CompilerDiagnostic[] = [
      ...validateCompilerMetadata(adapter.metadata),
      ...validateCompilerCapabilities(adapter.capabilities, compilerId),
    ];
    if (diagnostics.some((d) => d.severity === "error")) {
      return Object.freeze({
        status: "invalid" as const,
        compilerId,
        diagnostics: Object.freeze(diagnostics),
      });
    }

    const existing = this.byId.get(compilerId);
    let status: RegistrationResult["status"] = "registered";
    if (existing !== undefined) {
      status = "replaced";
      diagnostics.push(
        createCompilerDiagnostic({
          code: CompilerDiagnosticCode.ConfigurationError,
          severity: "warning",
          message: `Compiler adapter "${compilerId}" was already registered and has been replaced.`,
          compilerId,
        }),
      );
    }

    const conflicts = this.conflictingCompilers(adapter);
    if (conflicts.length > 0) {
      status = "conflict";
      diagnostics.push(
        createCompilerDiagnostic({
          code: CompilerDiagnosticCode.ConfigurationError,
          severity: "warning",
          message: `Compiler adapter "${compilerId}" conflicts on language "${adapter.metadata.languageId}" with: ${conflicts.join(", ")}.`,
          compilerId,
          related: conflicts,
        }),
      );
    }

    this.index(adapter);
    this.byId.set(compilerId, adapter);
    return Object.freeze({
      status,
      compilerId,
      diagnostics: Object.freeze(diagnostics),
    });
  }

  /** Removes a compiler by id, rebuilding indexes. Returns false when absent. */
  unregister(id: string): boolean {
    const removed = this.byId.delete(tokenize(id));
    if (removed) this.rebuildIndexes();
    return removed;
  }

  /** Removes every registered compiler. */
  clear(): void {
    this.byId.clear();
    this.rebuildIndexes();
  }

  /** Compilers associated with `languageId` (priority-sorted). */
  byLanguage(languageId: string): readonly CompilerAdapter[] {
    return this.sorted(this.languageIndex.get(tokenize(languageId)));
  }

  /** Compilers declaring `extension` (priority-sorted). */
  byExtension(extension: string): readonly CompilerAdapter[] {
    return this.sorted(this.extensionIndex.get(normalizeExtension(extension)));
  }

  /** Compilers declaring `capability` (priority-sorted). */
  byCapability(capability: string): readonly CompilerAdapter[] {
    return this.sorted(this.capabilityIndex.get(tokenize(capability)));
  }

  /**
   * Resolves the best compiler for `languageId`, applying optional version and
   * capability filters. Picks the highest-priority match.
   */
  resolve(languageId: string, options: CompilerResolveOptions = {}): CompilerAdapter | undefined {
    return this.applyFilters(this.byLanguage(languageId), options)[0];
  }

  /** The capability level of a registered compiler, or `0`. */
  capabilityLevelOf(id: string, capability: string): 0 | 1 | 2 {
    const adapter = this.get(id);
    return adapter === undefined ? 0 : capabilityLevel(adapter.capabilities, capability);
  }

  /** Whether a registered compiler declares `capability`. */
  hasCapability(id: string, capability: string): boolean {
    const adapter = this.get(id);
    return adapter !== undefined && hasCapability(adapter.capabilities, capability);
  }

  private applyFilters(
    adapters: readonly CompilerAdapter[],
    options: CompilerResolveOptions,
  ): readonly CompilerAdapter[] {
    return adapters.filter((adapter) => {
      if (
        options.capability !== undefined &&
        !hasCapability(adapter.capabilities, options.capability)
      ) {
        return false;
      }
      if (
        options.version !== undefined &&
        !satisfiesVersion(adapter.metadata.version, options.version)
      ) {
        return false;
      }
      return true;
    });
  }

  private sorted(ids: ReadonlySet<string> | undefined): readonly CompilerAdapter[] {
    if (ids === undefined) return [];
    return [...ids]
      .map((id) => this.byId.get(id))
      .filter((adapter): adapter is CompilerAdapter => adapter !== undefined)
      .sort(
        (a, b) =>
          b.metadata.priority - a.metadata.priority || a.metadata.id.localeCompare(b.metadata.id),
      );
  }

  private index(adapter: CompilerAdapter): void {
    const languageKey = tokenize(adapter.metadata.languageId);
    this.addIndex(this.languageIndex, languageKey, adapter.metadata.id);
    for (const extension of adapter.metadata.extensions) {
      this.addIndex(this.extensionIndex, normalizeExtension(extension), adapter.metadata.id);
    }
    for (const name of Object.keys(adapter.capabilities as CompilerCapabilities)) {
      this.addIndex(this.capabilityIndex, tokenize(name), adapter.metadata.id);
    }
  }

  private addIndex(index: Map<string, Set<string>>, key: string, id: string): void {
    let ids = index.get(key);
    if (ids === undefined) {
      ids = new Set();
      index.set(key, ids);
    }
    ids.add(id);
  }

  private rebuildIndexes(): void {
    this.languageIndex.clear();
    this.extensionIndex.clear();
    this.capabilityIndex.clear();
    for (const adapter of this.byId.values()) this.index(adapter);
  }

  /** Compilers sharing both language and an extension with `adapter`. */
  private conflictingCompilers(adapter: CompilerAdapter): readonly string[] {
    const conflicts = new Set<string>();
    const languageOwners = this.languageIndex.get(tokenize(adapter.metadata.languageId));
    if (languageOwners === undefined) return [];
    for (const extension of adapter.metadata.extensions) {
      const owners = this.extensionIndex.get(normalizeExtension(extension));
      if (owners === undefined) continue;
      for (const owner of owners) {
        if (!languageOwners.has(owner)) continue;
        if (owner === adapter.metadata.id) continue;
        conflicts.add(owner);
      }
    }
    return [...conflicts].sort();
  }
}

/** Creates a new empty {@link CompilerRegistry}. */
export function createCompilerRegistry(): CompilerRegistry {
  return new CompilerRegistry();
}
