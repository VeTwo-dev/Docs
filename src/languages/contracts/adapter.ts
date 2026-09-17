import type { LanguageCapabilities } from "./capabilities.js";
import type { CommentStandard } from "./comment.js";
import type { LanguageConfiguration } from "./configuration.js";
import type { DetectionInput, DetectionResult } from "./detection.js";
import type { FrameworkAssociation } from "./framework.js";
import type { LanguageMetadata } from "./metadata.js";

/**
 * The subset of the language-manager surface available to adapter lifecycle
 * hooks. Kept intentionally small so adapters cannot reach the engine.
 */
export interface LanguageManagerHandle {
  register(adapter: LanguageAdapter): { readonly languageId: string };
  unregister(id: string): boolean;
  get(id: string): { readonly id: string; readonly displayName: string } | undefined;
  detect(input: DetectionInput): readonly DetectionResult[];
}

/** Lifecycle hooks a language adapter may declare. */
export interface LanguageAdapterHooks {
  /** Runs after the adapter is registered. */
  readonly onRegister?: (manager: LanguageManagerHandle) => void | Promise<void>;
  /** Runs after the adapter is unregistered. */
  readonly onUnregister?: (manager: LanguageManagerHandle) => void;
}

/**
 * The universal language adapter contract.
 *
 * Every programming language is implemented as an independent adapter. The
 * core engine communicates with languages exclusively through this interface.
 */
export interface LanguageAdapter {
  /** Language metadata (id, name, extensions, entry points, ...). */
  readonly metadata: LanguageMetadata;
  /** Declared capabilities. */
  readonly capabilities: LanguageCapabilities;
  /** Configuration files recognised by the language. */
  readonly configuration?: LanguageConfiguration | readonly LanguageConfiguration[];
  /** Documentation comment standards the language supports. */
  readonly commentStandards?: readonly CommentStandard[];
  /** Framework associations for the language. */
  readonly frameworkSupport?: readonly FrameworkAssociation[];
  /**
   * Custom detection hook. When present, it replaces signal-based detection
   * for this language.
   */
  readonly detect?: (input: DetectionInput) => DetectionResult | null;
  /** Lifecycle hooks. */
  readonly hooks?: LanguageAdapterHooks;
  /** Minimum language-manager API version required by this adapter. */
  readonly minimumApiVersion?: string;
}

/**
 * Creates a frozen, plain language adapter. This is the public factory for
 * external language packages.
 */
export function createLanguageAdapter(config: LanguageAdapter): LanguageAdapter {
  return Object.freeze({ ...config });
}
