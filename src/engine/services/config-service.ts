import { loadConfig } from "../../config/loader.js";
import type { DocsConfig } from "../../config/types.js";
import type { ServiceFactory } from "../container.js";

/** Result of loading a documentation configuration. */
export interface ConfigLoadResult {
  readonly config: DocsConfig;
  readonly filePath: string;
}

/**
 * Config service — loads and resolves the documentation configuration.
 *
 * Wraps the existing `loadConfig` implementation. The fully resolved config
 * is immutable and shared across the engine build.
 */
export interface ConfigService {
  readonly load: (rootDir: string, configPath?: string) => Promise<ConfigLoadResult>;
}

export const CONFIG_SERVICE = "config";

export const configServiceFactory: ServiceFactory<ConfigService> = () => ({
  load: (rootDir) => loadConfig(rootDir),
});
