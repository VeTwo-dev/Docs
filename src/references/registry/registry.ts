import type {
  ReferenceResolver,
  ReferenceResolverMetadata,
  ReferenceResolverRegistryHandle,
} from "../contracts/resolver.js";
import type { ReferenceResolverCapabilities } from "../contracts/capabilities.js";

const MAX_RESOLVERS_PER_LANGUAGE = 8;

/**
 * Resolves registered reference resolvers for a language.
 *
 * Multiple resolvers may serve one language; the one with the highest
 * priority wins for binding extraction, but all remain registered.
 */
export interface ReferenceResolverRegistry {
  register(resolver: ReferenceResolver): { readonly resolverId: string };
  unregister(id: string): boolean;
  /** The winning resolver for a language, or undefined. */
  resolve(languageId: string): ReferenceResolver | undefined;
  get(id: string): ReferenceResolver | undefined;
  list(): readonly ReferenceResolver[];
  capabilitiesOf(languageId: string): ReferenceResolverCapabilities | undefined;
  /** Whether a resolver serves `languageId` (optionally satisfying a capability). */
  supports(languageId: string, capability?: string): boolean;
}

/** Builds a {@link ReferenceResolverRegistry}. */
export function createReferenceResolverRegistry(): ReferenceResolverRegistry {
  const byId = new Map<string, ReferenceResolver>();
  const byLanguage = new Map<string, ReferenceResolver[]>();

  const handle: ReferenceResolverRegistryHandle = {
    register: (resolver: ReferenceResolver): { resolverId: string } => {
      const result = registry.register(resolver);
      return { resolverId: result.resolverId };
    },
    unregister: (id: string): boolean => registry.unregister(id),
    get: (id: string): { id: string; displayName: string } | undefined => {
      const resolver = registry.get(id);
      return resolver === undefined
        ? undefined
        : { id: resolver.metadata.id, displayName: resolver.metadata.displayName };
    },
  };

  const addToLanguageIndex = (resolver: ReferenceResolver): void => {
    const existing = byLanguage.get(resolver.metadata.languageId) ?? [];
    byLanguage.set(resolver.metadata.languageId, [...existing, resolver]);
  };

  const rebuildLanguageIndex = (): void => {
    byLanguage.clear();
    for (const resolver of byId.values()) addToLanguageIndex(resolver);
  };

  const registry = {
    register(resolver: ReferenceResolver): { readonly resolverId: string } {
      const id = resolver.metadata.id;
      if (byId.has(id)) {
        throw new Error(`Reference resolver already registered: ${id}`);
      }
      const perLanguage = byLanguage.get(resolver.metadata.languageId) ?? [];
      if (perLanguage.length >= MAX_RESOLVERS_PER_LANGUAGE) {
        throw new Error(
          `Too many reference resolvers for language "${resolver.metadata.languageId}" ` +
            `(max ${MAX_RESOLVERS_PER_LANGUAGE})`,
        );
      }
      byId.set(id, resolver);
      addToLanguageIndex(resolver);
      void resolver.hooks?.onRegister?.(handle);
      return Object.freeze({ resolverId: id });
    },

    unregister(id: string): boolean {
      const resolver = byId.get(id);
      if (resolver === undefined) return false;
      resolver.hooks?.onUnregister?.(handle);
      byId.delete(id);
      rebuildLanguageIndex();
      return true;
    },

    resolve(languageId: string): ReferenceResolver | undefined {
      const candidates = byLanguage.get(languageId) ?? [];
      if (candidates.length === 0) return undefined;
      return [...candidates].sort((a, b) => b.metadata.priority - a.metadata.priority)[0];
    },

    get(id: string): ReferenceResolver | undefined {
      return byId.get(id);
    },

    list(): readonly ReferenceResolver[] {
      return [...byId.values()];
    },

    capabilitiesOf(languageId: string): ReferenceResolverCapabilities | undefined {
      return registry.resolve(languageId)?.capabilities;
    },

    supports(languageId: string, capability?: string): boolean {
      const resolver = registry.resolve(languageId);
      if (resolver === undefined) return false;
      if (capability === undefined) return true;
      return (
        (resolver.capabilities[capability as keyof ReferenceResolverCapabilities] ?? "none") !==
        "none"
      );
    },
  } satisfies ReferenceResolverRegistry;

  return registry;
}

/** Returns the highest-priority resolver metadata per language. */
export function resolverSummary(
  registry: ReferenceResolverRegistry,
): readonly ReferenceResolverMetadata[] {
  const languages = new Set(registry.list().map((resolver) => resolver.metadata.languageId));
  return [...languages].map((languageId) => registry.resolve(languageId)!.metadata);
}
