import type { DocsConfig } from "../../config/types.js";

/** Result of loading a documentation configuration from disk. */
export interface ConfigLoadResultContract {
  readonly config: DocsConfig;
  readonly filePath: string;
}

/**
 * Internal engine contract for configuration loading.
 */
export interface ConfigLoaderContract {
  readonly load: (rootDir: string, configPath?: string) => Promise<ConfigLoadResultContract>;
}
