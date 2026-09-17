import type { DocsConfig } from "../../config/types.js";
import { createPluginRegistry, createBuiltinPlugins } from "../../plugins/index.js";
import type { PluginRegistryContract } from "../contracts/plugins.js";
import type { ServiceFactory } from "../container.js";

/**
 * Plugin service — owns plugin registration for a build.
 *
 * Creates the plugin registry and registers built-in plugins plus any
 * user-provided plugins from the configuration.
 */
export interface PluginService {
  readonly registry: PluginRegistryContract;
  readonly setup: (config: DocsConfig) => void;
}

export const PLUGIN_SERVICE = "plugin";

export const pluginServiceFactory: ServiceFactory<PluginService> = () => {
  const registry = createPluginRegistry();

  return {
    registry,
    setup(config: DocsConfig): void {
      const builtin = createBuiltinPlugins(config);
      registry.registerAll([...builtin, ...config.plugins]);
    },
  };
};
