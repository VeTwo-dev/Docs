import type { LanguageAdapter } from "../contracts/adapter.js";
import type { LanguageCapabilities } from "../contracts/capabilities.js";
import type { LanguageMetadata } from "../contracts/metadata.js";
import { createCapabilityModel, type CapabilityModel } from "./capabilities.js";
import { createCommentStandardModel, type CommentStandardModel } from "./comment.js";
import { createConfigurationModel, type ConfigurationModel } from "./configuration.js";
import { createFrameworkAssociationModel, type FrameworkAssociationModel } from "./framework.js";
import { deepFreeze } from "./freeze.js";

/** Normalises a metadata extension (ensures a leading dot, lowercased). */
export function normalizeExtension(ext: string): string {
  let normalized = ext.trim().toLowerCase();
  if (normalized && !normalized.startsWith(".")) normalized = `.${normalized}`;
  return normalized;
}

/** Deduplicates a list while preserving order, storing transformed values. */
function unique(
  values: readonly string[],
  transform: (value: string) => string,
): readonly string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = transform(value);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }
  return Object.freeze(result);
}

/**
 * An immutable, normalised language model — the permanent abstraction the
 * engine talks to. Every collection is frozen; nested models are frozen.
 */
export interface LanguageModel {
  /** The (frozen) source adapter. */
  readonly adapter: LanguageAdapter;
  /** Normalised metadata. */
  readonly metadata: LanguageMetadata;
  /** Unique language id. */
  readonly id: string;
  /** Human-readable display name. */
  readonly displayName: string;
  /** Alternative ids / aliases. */
  readonly aliases: readonly string[];
  /** Adapter version (semver-ish). */
  readonly version?: string;
  /** Detection priority. */
  readonly priority: number;
  /** Normalised extensions (leading dot, lowercase). */
  readonly extensions: readonly string[];
  /** Exact basenames identifying the language. */
  readonly fileNames: readonly string[];
  /** MIME types served by the language. */
  readonly mimeTypes: readonly string[];
  /** Lockfile basenames identifying the ecosystem. */
  readonly lockfiles: readonly string[];
  /** Configuration file basenames. */
  readonly configFiles: readonly string[];
  /** Default entry point basenames. */
  readonly entryFiles: readonly string[];
  /** Optional display colour. */
  readonly color?: string;
  /** Optional icon id. */
  readonly icon?: string;
  /** Immutable capability map. */
  readonly capabilities: CapabilityModel;
  /** Immutable configuration models. */
  readonly configuration: readonly ConfigurationModel[];
  /** Immutable comment standard models. */
  readonly commentStandards: readonly CommentStandardModel[];
  /** Immutable framework association models. */
  readonly frameworkSupport: readonly FrameworkAssociationModel[];
  /** Minimum manager API version required by the adapter. */
  readonly minimumApiVersion?: string;
}

/** Builds an immutable {@link LanguageModel} from an adapter. */
export function createLanguageModel(adapter: LanguageAdapter): LanguageModel {
  const metadata = deepFreeze({ ...adapter.metadata });
  const configurations =
    adapter.configuration === undefined
      ? []
      : Array.isArray(adapter.configuration)
        ? adapter.configuration
        : [adapter.configuration];
  const capabilities: LanguageCapabilities = adapter.capabilities ?? {};

  return deepFreeze({
    adapter: Object.freeze({ ...adapter }),
    metadata,
    id: metadata.id,
    displayName: metadata.displayName,
    aliases: unique(metadata.aliases ?? [], (a) => a.toLowerCase()),
    version: metadata.version,
    priority: metadata.priority ?? 0,
    extensions: unique(metadata.extensions ?? [], normalizeExtension),
    fileNames: unique(metadata.fileNames ?? [], (n) => n),
    mimeTypes: unique(metadata.mimeTypes ?? [], (m) => m.toLowerCase()),
    lockfiles: unique(metadata.lockfiles ?? [], (l) => l),
    configFiles: unique(metadata.configFiles ?? [], (c) => c),
    entryFiles: unique(metadata.defaultEntryFiles ?? [], (e) => e),
    color: metadata.color,
    icon: metadata.icon,
    capabilities: createCapabilityModel(capabilities),
    configuration: configurations.map(createConfigurationModel),
    commentStandards: (adapter.commentStandards ?? []).map(createCommentStandardModel),
    frameworkSupport: (adapter.frameworkSupport ?? []).map(createFrameworkAssociationModel),
    minimumApiVersion: adapter.minimumApiVersion,
  });
}
