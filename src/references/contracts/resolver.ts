import type { ReferenceBindingInput } from "./input.js";
import type { ReferenceBindingOutput } from "./output.js";
import type { ReferenceResolverCapabilities } from "./capabilities.js";
import type { ReferenceKind } from "../models/index.js";

/** Metadata describing a {@link ReferenceResolver}. */
export interface ReferenceResolverMetadata {
  /** The unique resolver id (e.g. `typescript`). */
  readonly id: string;
  /** The language adapter id the resolver serves. */
  readonly languageId: string;
  readonly displayName: string;
  readonly version: string;
  /** Higher priorities win when resolving multiple resolvers for a language. */
  readonly priority: number;
  readonly source: "builtin" | "external";
  /** The framework the resolver understands (e.g. `react`, `next`). */
  readonly framework?: string;
  /** The reference kinds this resolver can produce. */
  readonly supportedKinds?: readonly ReferenceKind[];
  /** Required capability names for this resolver to function. */
  readonly requiredCapabilities?: readonly string[];
}

/** The restricted registry view handed to resolver hooks. */
export interface ReferenceResolverRegistryHandle {
  register(resolver: ReferenceResolver): { readonly resolverId: string };
  unregister(id: string): boolean;
  get(id: string): { readonly id: string; readonly displayName: string } | undefined;
}

/** Lifecycle hooks a resolver may declare. */
export interface ReferenceResolverHooks {
  readonly onRegister?: (registry: ReferenceResolverRegistryHandle) => void | Promise<void>;
  readonly onUnregister?: (registry: ReferenceResolverRegistryHandle) => void;
  readonly onDispose?: () => void;
}

/**
 * The universal reference resolver contract.
 *
 * A resolver recovers the import/export *name bindings* that the symbol model
 * intentionally drops, walking only the normalized syntax trees. Everything
 * else in reference resolution (specifier → module, name → symbol, re-export
 * chains) is language-independent and lives in the shared engine.
 */
export interface ReferenceResolver {
  readonly metadata: ReferenceResolverMetadata;
  readonly capabilities: ReferenceResolverCapabilities;
  readonly extractBindings: (input: ReferenceBindingInput) => ReferenceBindingOutput;
  readonly hooks?: ReferenceResolverHooks;
  readonly minimumApiVersion?: string;
}

/** Builds a frozen {@link ReferenceResolver}. */
export function createReferenceResolver(config: ReferenceResolver): ReferenceResolver {
  return Object.freeze({
    metadata: Object.freeze({ ...config.metadata }),
    capabilities: Object.freeze({ ...config.capabilities }),
    extractBindings: config.extractBindings,
    ...(config.hooks !== undefined ? { hooks: Object.freeze({ ...config.hooks }) } : {}),
    ...(config.minimumApiVersion !== undefined
      ? { minimumApiVersion: config.minimumApiVersion }
      : {}),
  });
}
