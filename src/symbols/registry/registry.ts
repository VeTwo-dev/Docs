import type { SymbolExtractor, SymbolExtractorMetadata } from "../contracts/extractor.js";
import type { SymbolExtractorCapabilities } from "../contracts/capabilities.js";
import type { SymbolExtractorRegistryHandle } from "../contracts/extractor.js";

const MAX_EXTRACTORS_PER_LANGUAGE = 8;

/**
 * Resolves registered extractors for a language.
 *
 * Multiple extractors may serve one language; the one with the highest
 * priority wins for extraction, but all remain registered.
 */
export interface SymbolExtractorRegistry {
  register(extractor: SymbolExtractor): { readonly extractorId: string };
  unregister(id: string): boolean;
  /** The winning extractor for a language, or undefined. */
  resolve(languageId: string): SymbolExtractor | undefined;
  get(id: string): SymbolExtractor | undefined;
  list(): readonly SymbolExtractor[];
  capabilitiesOf(languageId: string): SymbolExtractorCapabilities | undefined;
}

/** Builds a {@link SymbolExtractorRegistry}. */
export function createSymbolExtractorRegistry(): SymbolExtractorRegistry {
  const byId = new Map<string, SymbolExtractor>();
  const byLanguage = new Map<string, SymbolExtractor[]>();

  const handle: SymbolExtractorRegistryHandle = {
    register: (extractor: SymbolExtractor): { extractorId: string } => {
      const result = registry.register(extractor);
      return { extractorId: result.extractorId };
    },
    unregister: (id: string): boolean => registry.unregister(id),
    get: (id: string): { id: string; displayName: string } | undefined => {
      const extractor = registry.get(id);
      return extractor === undefined
        ? undefined
        : { id: extractor.metadata.id, displayName: extractor.metadata.displayName };
    },
  };

  const addToLanguageIndex = (extractor: SymbolExtractor): void => {
    const existing = byLanguage.get(extractor.metadata.languageId) ?? [];
    byLanguage.set(extractor.metadata.languageId, [...existing, extractor]);
  };

  const rebuildLanguageIndex = (): void => {
    byLanguage.clear();
    for (const extractor of byId.values()) addToLanguageIndex(extractor);
  };

  const registry = {
    register(extractor: SymbolExtractor): { readonly extractorId: string } {
      const id = extractor.metadata.id;
      if (byId.has(id)) {
        throw new Error(`Symbol extractor already registered: ${id}`);
      }
      const perLanguage = byLanguage.get(extractor.metadata.languageId) ?? [];
      if (perLanguage.length >= MAX_EXTRACTORS_PER_LANGUAGE) {
        throw new Error(
          `Too many symbol extractors for language "${extractor.metadata.languageId}" ` +
            `(max ${MAX_EXTRACTORS_PER_LANGUAGE})`,
        );
      }
      byId.set(id, extractor);
      addToLanguageIndex(extractor);
      void extractor.hooks?.onRegister?.(handle);
      return Object.freeze({ extractorId: id });
    },

    unregister(id: string): boolean {
      const extractor = byId.get(id);
      if (extractor === undefined) return false;
      extractor.hooks?.onUnregister?.(handle);
      byId.delete(id);
      rebuildLanguageIndex();
      return true;
    },

    resolve(languageId: string): SymbolExtractor | undefined {
      const candidates = byLanguage.get(languageId) ?? [];
      if (candidates.length === 0) return undefined;
      return [...candidates].sort((a, b) => b.metadata.priority - a.metadata.priority)[0];
    },

    get(id: string): SymbolExtractor | undefined {
      return byId.get(id);
    },

    list(): readonly SymbolExtractor[] {
      return [...byId.values()];
    },

    capabilitiesOf(languageId: string): SymbolExtractorCapabilities | undefined {
      return registry.resolve(languageId)?.capabilities;
    },
  } satisfies SymbolExtractorRegistry;

  return registry;
}

/** Returns the highest-priority extractor metadata per language. */
export function resolverSummary(
  registry: SymbolExtractorRegistry,
): readonly SymbolExtractorMetadata[] {
  const languages = new Set(registry.list().map((extractor) => extractor.metadata.languageId));
  return [...languages].map((languageId) => registry.resolve(languageId)!.metadata);
}
