/**
 * AI Provider Registry.
 *
 * A dependency-injected registry for managing AI providers. Supports
 * registration, lookup, fallback chains, default provider selection, and
 * alias resolution. No singleton abuse — the registry is always injected.
 *
 * @example
 * ```ts
 * const registry = createAIProviderRegistry();
 * registry.register(myProvider);
 * const provider = registry.resolve("openwiki");
 * ```
 */

import type { AIProvider, AIProviderFactory } from "./provider.js";
import type { AIProviderMetadata } from "./metadata.js";
import type { AIProviderHealth } from "./health.js";

/** Configuration for a provider in the registry. */
export interface AIProviderEntry {
  /** The provider factory (for lazy instantiation). */
  readonly factory: AIProviderFactory;
  /** Whether this provider is enabled. */
  enabled: boolean;
  /** Priority (lower = higher priority). Used for fallback ordering. */
  priority: number;
}

/** Fallback chain configuration. */
export interface AIFallbackChain {
  /** Ordered list of provider IDs to try. */
  readonly providers: readonly string[];
  /** Whether to attempt deterministic fallback on all-provider failure. */
  readonly deterministicFallback: boolean;
}

/** The AI Provider Registry interface. */
export interface AIProviderRegistry {
  /** Register a provider factory. */
  register(factory: AIProviderFactory, options?: { enabled?: boolean; priority?: number }): void;

  /** Unregister a provider by ID. */
  unregister(id: string): boolean;

  /** Get a provider factory by ID (returns undefined if not found). */
  get(id: string): AIProviderFactory | undefined;

  /** Check whether a provider is registered. */
  has(id: string): boolean;

  /** List all registered provider metadata. */
  list(): readonly AIProviderMetadata[];

  /** List all registered provider entries with config. */
  listEntries(): readonly (AIProviderEntry & { id: string })[];

  /**
   * Resolve a provider by ID, alias, or partial match.
   * Returns undefined if no match.
   */
  resolve(id: string): AIProviderFactory | undefined;

  /** Get the default provider (highest priority enabled provider). */
  getDefault(): AIProviderFactory | undefined;

  /** Set the default provider by ID. */
  setDefault(id: string): void;

  /** Get the active fallback chain. */
  getFallbackChain(): AIFallbackChain;

  /** Set the fallback chain. */
  setFallbackChain(chain: AIFallbackChain): void;

  /** Get health for a specific provider. */
  getHealth(id: string): AIProviderHealth | undefined;

  /** Set health for a specific provider. */
  setHealth(id: string, health: AIProviderHealth): void;

  /** Create a provider instance by ID. */
  createProvider(id: string): AIProvider | undefined;
}

interface InternalEntry {
  factory: AIProviderFactory;
  enabled: boolean;
  priority: number;
}

class AIProviderRegistryImpl implements AIProviderRegistry {
  private readonly providers = new Map<string, InternalEntry>();
  private readonly aliases = new Map<string, string>();
  private readonly health = new Map<string, AIProviderHealth>();
  private defaultId: string | undefined;
  private fallbackChain: AIFallbackChain = {
    providers: [],
    deterministicFallback: true,
  };

  register(factory: AIProviderFactory, options?: { enabled?: boolean; priority?: number }): void {
    const id = factory.metadata.id;
    this.providers.set(id, {
      factory,
      enabled: options?.enabled ?? true,
      priority: options?.priority ?? 100,
    });
    for (const alias of factory.metadata.aliases ?? []) {
      this.aliases.set(alias, id);
    }
  }

  unregister(id: string): boolean {
    const entry = this.providers.get(id);
    if (entry === undefined) return false;
    this.providers.delete(id);
    if (this.defaultId === id) this.defaultId = undefined;
    // Remove aliases pointing to this id
    for (const [alias, target] of this.aliases) {
      if (target === id) this.aliases.delete(alias);
    }
    return true;
  }

  get(id: string): AIProviderFactory | undefined {
    return this.providers.get(id)?.factory;
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }

  list(): readonly AIProviderMetadata[] {
    return [...this.providers.values()].map((e) => e.factory.metadata);
  }

  listEntries(): readonly (AIProviderEntry & { id: string })[] {
    return [...this.providers.entries()].map(([id, e]) => ({
      id,
      factory: e.factory,
      enabled: e.enabled,
      priority: e.priority,
    }));
  }

  resolve(id: string): AIProviderFactory | undefined {
    // Direct match
    const direct = this.providers.get(id);
    if (direct !== undefined) return direct.factory;
    // Alias match
    const aliasTarget = this.aliases.get(id);
    if (aliasTarget !== undefined) {
      const aliased = this.providers.get(aliasTarget);
      if (aliased !== undefined) return aliased.factory;
    }
    return undefined;
  }

  getDefault(): AIProviderFactory | undefined {
    if (this.defaultId !== undefined) {
      return this.resolve(this.defaultId);
    }
    // Fall back to highest-priority enabled provider
    const enabled = [...this.providers.entries()]
      .filter(([, e]) => e.enabled)
      .sort(([, a], [, b]) => a.priority - b.priority);
    return enabled[0]?.[1].factory;
  }

  setDefault(id: string): void {
    if (!this.providers.has(id)) {
      throw new Error(`Cannot set default: provider "${id}" is not registered`);
    }
    this.defaultId = id;
  }

  getFallbackChain(): AIFallbackChain {
    return this.fallbackChain;
  }

  setFallbackChain(chain: AIFallbackChain): void {
    this.fallbackChain = chain;
  }

  getHealth(id: string): AIProviderHealth | undefined {
    return this.health.get(id);
  }

  setHealth(id: string, healthStatus: AIProviderHealth): void {
    this.health.set(id, healthStatus);
  }

  createProvider(id: string): AIProvider | undefined {
    const entry = this.providers.get(id);
    if (entry === undefined) return undefined;
    return entry.factory.create();
  }
}

/** Create a new, empty AI provider registry. */
export function createAIProviderRegistry(): AIProviderRegistry {
  return new AIProviderRegistryImpl();
}

/**
 * Create a registry pre-populated with registered providers.
 * Providers are registered in the order given; first enabled provider
 * with the lowest priority number becomes the default.
 */
export function createAIProviderRegistryWith(
  entries: readonly { factory: AIProviderFactory; enabled?: boolean; priority?: number }[],
): AIProviderRegistry {
  const registry = createAIProviderRegistry();
  for (const entry of entries) {
    registry.register(entry.factory, { enabled: entry.enabled, priority: entry.priority });
  }
  return registry;
}
