import type { LanguageAdapter } from "../contracts/adapter.js";
import {
  createDiagnostic,
  LanguageDiagnosticCode,
  type LanguageDiagnostic,
} from "../contracts/diagnostics.js";
import { createLanguageModel, type LanguageModel } from "../models/language.js";
import { validateCapabilities } from "../utils/capabilities.js";
import { normalizeExtension } from "../utils/extension.js";
import { validateMetadata } from "../utils/metadata.js";

/** The outcome of registering an adapter. */
export interface RegistrationResult {
  /** `invalid` means the adapter was rejected and not stored. */
  readonly status: "registered" | "replaced" | "conflict" | "invalid";
  /** The adapter's language id. */
  readonly languageId: string;
  /** Diagnostics produced during registration. */
  readonly diagnostics: readonly LanguageDiagnostic[];
}

/** A secondary index keyed by a normalised token. */
function tokenize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * The language registry.
 *
 * Holds adapters keyed by language id and maintains lookup indexes for
 * extensions, MIME types, exact basenames and frameworks. All lookups are
 * index-driven — there are no hardcoded switches.
 */
export class LanguageRegistry {
  private readonly byId = new Map<string, LanguageModel>();
  private readonly extensionsIndex = new Map<string, Set<string>>();
  private readonly mimeTypesIndex = new Map<string, Set<string>>();
  private readonly fileNamesIndex = new Map<string, Set<string>>();
  private readonly frameworksIndex = new Map<string, Set<string>>();

  /** The number of registered languages. */
  size(): number {
    return this.byId.size;
  }

  /** Whether a language id is registered. */
  has(id: string): boolean {
    return this.byId.has(id.toLowerCase());
  }

  /** All registered language models, sorted by priority (desc) then id. */
  all(): readonly LanguageModel[] {
    return [...this.byId.values()].sort(
      (a, b) => b.priority - a.priority || a.id.localeCompare(b.id),
    );
  }

  /** Looks up a language by id. */
  get(id: string): LanguageModel | undefined {
    return this.byId.get(id.toLowerCase());
  }

  /** Looks up a language by id, throwing when the adapter is missing. */
  getOrThrow(id: string): LanguageModel {
    const model = this.get(id);
    if (model === undefined) {
      throw new Error(`No language adapter registered for "${id}".`);
    }
    return model;
  }

  /** Registers an adapter, maintaining all lookup indexes. */
  register(adapter: LanguageAdapter): RegistrationResult {
    const languageId = adapter.metadata.id.toLowerCase();
    const diagnostics: LanguageDiagnostic[] = [
      ...validateMetadata(adapter.metadata),
      ...validateCapabilities(adapter.capabilities ?? {}, languageId),
    ];
    if (
      diagnostics.some(
        (d) => d.code === LanguageDiagnosticCode.InvalidAdapter && d.severity === "error",
      )
    ) {
      return Object.freeze({
        status: "invalid" as const,
        languageId,
        diagnostics: Object.freeze(diagnostics),
      });
    }

    const model = createLanguageModel(adapter);
    const existing = this.byId.get(languageId);
    let status: RegistrationResult["status"] = "registered";
    if (existing !== undefined) {
      status = "replaced";
      diagnostics.push(
        createDiagnostic({
          code: LanguageDiagnosticCode.DuplicateRegistration,
          severity: "warning",
          message: `Language adapter "${languageId}" was already registered and has been replaced.`,
          languageId,
        }),
      );
    }

    const conflicts = this.conflictingLanguages(model);
    if (conflicts.length > 0) {
      status = "conflict";
      diagnostics.push(
        createDiagnostic({
          code: LanguageDiagnosticCode.ConflictingAdapters,
          severity: "warning",
          message: `Language adapter "${languageId}" shares extensions with: ${conflicts.join(", ")}.`,
          languageId,
          related: conflicts,
        }),
      );
    }

    this.index(model);
    this.byId.set(languageId, model);
    return Object.freeze({
      status,
      languageId,
      diagnostics: Object.freeze(diagnostics),
    });
  }

  /** Removes a language by id, rebuilding indexes. Returns false when absent. */
  unregister(id: string): boolean {
    const removed = this.byId.delete(id.toLowerCase());
    if (removed) this.rebuildIndexes();
    return removed;
  }

  /** Removes every registered language. */
  clear(): void {
    this.byId.clear();
    this.rebuildIndexes();
  }

  /** Languages declaring `extension` (normalised, priority-sorted). */
  byExtension(extension: string): readonly LanguageModel[] {
    return this.sorted(this.extensionsIndex.get(normalizeExtension(extension)));
  }

  /** Languages declaring `mimeType` (priority-sorted). */
  byMimeType(mimeType: string): readonly LanguageModel[] {
    return this.sorted(this.mimeTypesIndex.get(tokenize(mimeType)));
  }

  /** Languages declaring exact basename `name` (priority-sorted). */
  byFileName(name: string): readonly LanguageModel[] {
    return this.sorted(this.fileNamesIndex.get(name));
  }

  /** Languages associated with framework id `frameworkId` (priority-sorted). */
  byFramework(frameworkId: string): readonly LanguageModel[] {
    return this.sorted(this.frameworksIndex.get(tokenize(frameworkId)));
  }

  private sorted(ids: ReadonlySet<string> | undefined): readonly LanguageModel[] {
    if (ids === undefined) return [];
    return [...ids]
      .map((id) => this.byId.get(id))
      .filter((model): model is LanguageModel => model !== undefined)
      .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  }

  private index(model: LanguageModel): void {
    for (const extension of model.extensions) {
      this.addIndex(this.extensionsIndex, tokenize(extension), model.id);
    }
    for (const mime of model.mimeTypes) {
      this.addIndex(this.mimeTypesIndex, tokenize(mime), model.id);
    }
    for (const name of [...model.fileNames, ...model.configFiles, ...model.entryFiles]) {
      this.addIndex(this.fileNamesIndex, name, model.id);
    }
    for (const framework of model.frameworkSupport) {
      this.addIndex(this.frameworksIndex, tokenize(framework.id), model.id);
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
    this.extensionsIndex.clear();
    this.mimeTypesIndex.clear();
    this.fileNamesIndex.clear();
    this.frameworksIndex.clear();
    for (const model of this.byId.values()) this.index(model);
  }

  /** Other languages sharing any extension with `model`. */
  private conflictingLanguages(model: LanguageModel): readonly string[] {
    const conflicts = new Set<string>();
    for (const extension of model.extensions) {
      const owners = this.extensionsIndex.get(extension);
      if (owners === undefined) continue;
      for (const owner of owners) {
        const ownerModel = this.byId.get(owner);
        if (ownerModel === undefined || ownerModel.id === model.id) continue;
        conflicts.add(ownerModel.id);
      }
    }
    return [...conflicts].sort();
  }
}

/** Creates a new empty {@link LanguageRegistry}. */
export function createLanguageRegistry(): LanguageRegistry {
  return new LanguageRegistry();
}
