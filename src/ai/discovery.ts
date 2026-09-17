/**
 * AI Provider Discovery.
 *
 * Discovers AI providers from multiple sources:
 * - Built-in providers (compiled into @vetwo/docs)
 * - NPM packages matching `@vetwo/docs-provider-*`
 * - Local project providers
 * - Plugin-provided providers
 *
 * Providers are lazily loaded — importing the discovery module does not
 * load any provider code.
 */

import type { AIProviderFactory } from "./provider.js";
import type { AIProviderMetadata } from "./metadata.js";
import type { AIProviderRegistry } from "./registry.js";
import { createOpenWikiProviderFactory } from "./providers/openwiki.js";

/** A discovered provider reference (before instantiation). */
export interface DiscoveredProvider {
  /** Provider metadata. */
  readonly metadata: AIProviderMetadata;
  /** Source of discovery. */
  readonly source: "builtin" | "npm" | "local" | "plugin" | "project";
  /** The factory to create the provider. */
  readonly factory: AIProviderFactory;
  /** Package name, if discovered from npm. */
  readonly packageName?: string;
}

/** Configuration for provider discovery. */
export interface AIProviderDiscoveryOptions {
  /** Project root directory. */
  readonly rootDir: string;
  /** Whether to scan for npm providers (can be slow). */
  readonly scanNpm?: boolean;
  /** Whether to load project-local providers. */
  readonly loadProjectProviders?: boolean;
  /** Additional provider package prefixes to search. */
  readonly packagePrefixes?: readonly string[];
}

/**
 * The known built-in provider package prefix.
 * Future built-in providers follow this convention.
 */
const PROVIDER_PACKAGE_PREFIX = "@vetwo/docs-provider-";

/**
 * Discover providers bundled with @vetwo/docs.
 *
 * Built-in provider modules are side-effect-free, so importing them here
 * is safe. External providers (@vetwo/docs-provider-*) are still loaded
 * lazily via {@link loadProviderFromPackage}.
 */
export function discoverBuiltinProviders(): readonly DiscoveredProvider[] {
  const discovered: DiscoveredProvider[] = [];
  try {
    const factory = createOpenWikiProviderFactory();
    discovered.push({ metadata: factory.metadata, source: "builtin", factory });
  } catch {
    // Provider unavailable in this environment — skip.
  }
  return discovered;
}

/**
 * Scan for npm packages matching the provider naming convention.
 * This is a best-effort discovery — packages that fail to import are skipped.
 *
 * Note: this performs synchronous dynamic imports and should only be called
 * when explicitly scanning for providers (e.g. `docs ai list`).
 */
export async function discoverNpmProviders(
  packagePrefixes?: readonly string[],
): Promise<readonly DiscoveredProvider[]> {
  const prefixes = packagePrefixes ?? [PROVIDER_PACKAGE_PREFIX];
  const discovered: DiscoveredProvider[] = [];

  for (const prefix of prefixes) {
    // npm scan would use a package index or glob in node_modules
    // For now, this is a placeholder for the discovery mechanism
    // Real implementation would scan node_modules/@vetwo/docs-provider-*
    void prefix;
  }

  return discovered;
}

/**
 * Load a provider from a specific package name.
 * Returns undefined if the package cannot be loaded or doesn't export
 * a valid provider factory.
 */
export async function loadProviderFromPackage(
  packageName: string,
): Promise<DiscoveredProvider | undefined> {
  try {
    // Dynamic import — the package must export a `createAIProviderFactory` or similar
    const mod = await import(packageName);
    const factory: AIProviderFactory | undefined =
      mod.createAIProviderFactory ?? mod.default?.createAIProviderFactory;
    if (factory === undefined) return undefined;
    return {
      metadata: factory.metadata,
      source: "npm",
      factory,
      packageName,
    };
  } catch {
    return undefined;
  }
}

/**
 * Register discovered providers into an existing registry.
 */
export function registerDiscoveredProviders(
  registry: AIProviderRegistry,
  discovered: readonly DiscoveredProvider[],
): void {
  for (const provider of discovered) {
    if (!registry.has(provider.metadata.id)) {
      registry.register(provider.factory, { enabled: true });
    }
  }
}

/**
 * Full discovery pipeline: builtin → npm → project → register.
 */
export async function discoverAndRegisterProviders(
  registry: AIProviderRegistry,
  options: AIProviderDiscoveryOptions,
): Promise<void> {
  // 1. Built-in (empty in core)
  const builtins = discoverBuiltinProviders();
  registerDiscoveredProviders(registry, builtins);

  // 2. NPM packages
  if (options.scanNpm) {
    const npmProviders = await discoverNpmProviders(options.packagePrefixes);
    registerDiscoveredProviders(registry, npmProviders);
  }

  // 3. Project-local providers (from a configured path)
  if (options.loadProjectProviders) {
    const projectDir = `${options.rootDir}/.vetwo/docs/ai/providers`;
    // Scan for provider directories and attempt to load index.ts from each
    // This is a placeholder for the real implementation
    void projectDir;
  }
}
