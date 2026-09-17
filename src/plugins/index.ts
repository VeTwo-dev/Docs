import type { Plugin, HookContext } from "../types/internal.js";
import type { DocsConfig } from "../config/types.js";
import type { LifecycleHookName } from "../types/public.js";
import { mergePlugins } from "../config/loader.js";

/** Registry that manages plugin registration and hook lookup. */
export interface PluginRegistry {
  /** Registers a single plugin (skips if a plugin with the same name already exists). */
  register(plugin: Plugin): void;
  /** Registers multiple plugins at once. */
  registerAll(plugins: readonly Plugin[]): void;
  /** Returns a copy of all registered plugins. */
  getPlugins(): readonly Plugin[];
  /** Returns all handlers registered for a specific lifecycle hook, along with their originating plugin name. */
  getHooksFor(
    hook: LifecycleHookName,
  ): ReadonlyArray<{ plugin: string; handler: (ctx: HookContext) => void | Promise<void> }>;
}

/**
 * Creates a new {@link PluginRegistry} for managing documentation plugins.
 *
 * @returns A new PluginRegistry instance.
 *
 * @example
 * ```ts
 * const registry = createPluginRegistry();
 * registry.register(myPlugin);
 * ```
 */
export function createPluginRegistry(): PluginRegistry {
  const plugins: Plugin[] = [];

  return {
    register(plugin: Plugin): void {
      if (plugins.some((p) => p.name === plugin.name)) {
        return;
      }
      plugins.push(plugin);
    },

    registerAll(newPlugins: readonly Plugin[]): void {
      for (const plugin of newPlugins) {
        this.register(plugin);
      }
    },

    getPlugins(): readonly Plugin[] {
      return [...plugins];
    },

    getHooksFor(
      hook: LifecycleHookName,
    ): ReadonlyArray<{ plugin: string; handler: (ctx: HookContext) => void | Promise<void> }> {
      const result: { plugin: string; handler: (ctx: HookContext) => void | Promise<void> }[] = [];
      for (const plugin of plugins) {
        const handler = plugin.hooks[hook];
        if (handler) {
          result.push({ plugin: plugin.name, handler });
        }
      }
      return result;
    },
  };
}

export { mergePlugins };

/**
 * Creates built-in plugins based on the given configuration. Currently supports
 * search indexing and API documentation plugins.
 *
 * @param config - The resolved documentation configuration.
 * @returns An array of built-in plugins.
 *
 * @example
 * ```ts
 * const plugins = createBuiltinPlugins(config);
 * ```
 */
export function createBuiltinPlugins(config: DocsConfig): readonly Plugin[] {
  const plugins: Plugin[] = [];

  if (config.search.enabled) {
    plugins.push(createSearchPlugin());
  }

  if (config.api.enabled) {
    plugins.push(createApiDocsPlugin());
  }

  return plugins;
}

function createSearchPlugin(): Plugin {
  return {
    name: "@vetwo/docs/search",
    version: "0.1.0",
    hooks: {
      generate: async (ctx) => {
        const { generateSearchIndex } = await import("../features/search.js");
        await generateSearchIndex(ctx.ctx);
      },
    },
  };
}

function createApiDocsPlugin(): Plugin {
  return {
    name: "@vetwo/docs/api-docs",
    version: "0.1.0",
    hooks: {
      generate: async (ctx) => {
        const { generateApiDocs } = await import("../features/api-docs.js");
        await generateApiDocs(ctx.ctx);
      },
    },
  };
}
