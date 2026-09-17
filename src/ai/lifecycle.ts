/**
 * AI Provider Lifecycle.
 *
 * Manages the lifecycle of AI provider instances: initialization, caching,
 * disposal, and fallback execution. Ensures providers are initialized once
 * and reused, and disposed cleanly on shutdown.
 */

import type { AIProvider } from "./provider.js";
import type { AIProviderContext } from "./types.js";
import type { AIProviderRegistry } from "./registry.js";
import type { AIFallbackChain } from "./registry.js";

/** Lifecycle state of a provider instance. */
export type AIProviderLifecycleState = "created" | "initializing" | "ready" | "error" | "disposed";

/** A managed provider instance with lifecycle metadata. */
export interface ManagedProvider {
  /** The provider instance. */
  readonly provider: AIProvider;
  /** Current lifecycle state. */
  state: AIProviderLifecycleState;
  /** When the provider was initialized. */
  readonly initializedAt?: string;
  /** Last error, if any. */
  lastError?: Error;
}

/**
 * Manages provider instances and their lifecycle.
 */
export interface AIProviderLifecycleManager {
  /** Get or create a managed provider by ID. Ensures initialization. */
  acquire(id: string, context: AIProviderContext): Promise<ManagedProvider | undefined>;

  /** Release a provider instance (does not dispose — just removes from cache). */
  release(id: string): void;

  /** Dispose all managed provider instances. */
  disposeAll(): Promise<void>;

  /** Get the current state of a provider. */
  getState(id: string): AIProviderLifecycleState;

  /**
   * Execute a function with fallback: try the primary provider, then
   * fall through the fallback chain on failure.
   */
  withFallback<T>(
    fn: (provider: AIProvider) => Promise<T>,
    context: AIProviderContext,
    fallbackChain?: AIFallbackChain,
  ): Promise<T>;
}

class AIProviderLifecycleManagerImpl implements AIProviderLifecycleManager {
  private readonly instances = new Map<string, ManagedProvider>();
  private readonly registry: AIProviderRegistry;

  constructor(registry: AIProviderRegistry) {
    this.registry = registry;
  }

  async acquire(id: string, context: AIProviderContext): Promise<ManagedProvider | undefined> {
    const existing = this.instances.get(id);
    if (existing !== undefined) {
      if (existing.state === "ready") return existing;
      if (existing.state === "error") return undefined;
      // Still initializing — wait? For now, return as-is
      return existing;
    }

    const factory = this.registry.resolve(id);
    if (factory === undefined) return undefined;

    const provider = factory.create();
    const managed: ManagedProvider = {
      provider,
      state: "initializing",
    };
    this.instances.set(id, managed);

    try {
      await provider.initialize(context);
      managed.state = "ready";
      (managed as { initializedAt: string }).initializedAt = new Date().toISOString();
      return managed;
    } catch (error) {
      managed.state = "error";
      managed.lastError = error instanceof Error ? error : new Error(String(error));
      return undefined;
    }
  }

  release(id: string): void {
    this.instances.delete(id);
  }

  async disposeAll(): Promise<void> {
    const disposePromises: Promise<void>[] = [];
    for (const [, managed] of this.instances) {
      if (managed.state === "ready" || managed.state === "error") {
        managed.state = "disposed";
        disposePromises.push(
          managed.provider.dispose().catch(() => {
            // Dispose errors are logged but not fatal
          }),
        );
      }
    }
    this.instances.clear();
    await Promise.all(disposePromises);
  }

  getState(id: string): AIProviderLifecycleState {
    return this.instances.get(id)?.state ?? "created";
  }

  async withFallback<T>(
    fn: (provider: AIProvider) => Promise<T>,
    context: AIProviderContext,
    fallbackChain?: AIFallbackChain,
  ): Promise<T> {
    const chain = fallbackChain ?? this.registry.getFallbackChain();
    const providerIds =
      chain.providers.length > 0
        ? chain.providers
        : [this.registry.getDefault()?.metadata.id].filter((id): id is string => id !== undefined);

    let lastError: Error | undefined;

    for (const id of providerIds) {
      const managed = await this.acquire(id, context);
      if (managed === undefined || managed.state !== "ready") continue;

      try {
        return await fn(managed.provider);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        // Continue to next provider in chain
      }
    }

    if (chain.deterministicFallback) {
      throw new AIProviderExhaustedError(
        `All providers exhausted. Last error: ${lastError?.message ?? "unknown"}`,
        lastError,
      );
    }

    throw lastError ?? new AIProviderExhaustedError("No providers available");
  }
}

/** Error thrown when all providers in the fallback chain have failed. */
export class AIProviderExhaustedError extends Error {
  constructor(
    message: string,
    override readonly cause?: Error,
  ) {
    super(message);
    this.name = "AIProviderExhaustedError";
  }
}

/** Create a new lifecycle manager for the given registry. */
export function createAIProviderLifecycleManager(
  registry: AIProviderRegistry,
): AIProviderLifecycleManager {
  return new AIProviderLifecycleManagerImpl(registry);
}
