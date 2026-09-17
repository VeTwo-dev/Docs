import type { SymbolExtractionInput } from "./input.js";
import type { SymbolExtractionOutput } from "./output.js";
import type { SymbolExtractorCapabilities } from "./capabilities.js";

/** Metadata describing a {@link SymbolExtractor}. */
export interface SymbolExtractorMetadata {
  /** The unique extractor id (e.g. `typescript`). */
  readonly id: string;
  /** The language adapter id the extractor serves. */
  readonly languageId: string;
  readonly displayName: string;
  readonly version: string;
  /** Higher priorities win when resolving multiple extractors for a language. */
  readonly priority: number;
  readonly source: "builtin" | "external";
}

/** The restricted registry view handed to extractor hooks. */
export interface SymbolExtractorRegistryHandle {
  register(extractor: SymbolExtractor): { readonly extractorId: string };
  unregister(id: string): boolean;
  get(id: string): { readonly id: string; readonly displayName: string } | undefined;
}

/** Lifecycle hooks an extractor may declare. */
export interface SymbolExtractorHooks {
  readonly onRegister?: (registry: SymbolExtractorRegistryHandle) => void | Promise<void>;
  readonly onUnregister?: (registry: SymbolExtractorRegistryHandle) => void;
  readonly onDispose?: () => void;
}

/**
 * The universal symbol extractor contract.
 *
 * The engine communicates with languages only through this contract. An
 * extractor consumes normalized compilation units and produces normalized,
 * fully qualified symbols — it never exposes native nodes.
 */
export interface SymbolExtractor {
  readonly metadata: SymbolExtractorMetadata;
  readonly capabilities: SymbolExtractorCapabilities;
  readonly extract: (input: SymbolExtractionInput) => SymbolExtractionOutput;
  readonly hooks?: SymbolExtractorHooks;
  readonly minimumApiVersion?: string;
}

/** Builds a frozen {@link SymbolExtractor}. */
export function createSymbolExtractor(config: SymbolExtractor): SymbolExtractor {
  return Object.freeze({
    metadata: Object.freeze({ ...config.metadata }),
    capabilities: Object.freeze({ ...config.capabilities }),
    extract: config.extract,
    ...(config.hooks !== undefined ? { hooks: Object.freeze({ ...config.hooks }) } : {}),
    ...(config.minimumApiVersion !== undefined
      ? { minimumApiVersion: config.minimumApiVersion }
      : {}),
  });
}
