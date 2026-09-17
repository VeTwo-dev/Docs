import type { PluginRegistry } from "../../plugins/index.js";

/**
 * Internal engine contract for plugin management.
 *
 * The existing {@link PluginRegistry} from `src/plugins` already provides the
 * required surface, so the contract aliases it directly.
 */
export type PluginRegistryContract = PluginRegistry;
