import type { LanguageConfiguration } from "../contracts/configuration.js";
import { deepFreeze } from "./freeze.js";

/** An immutable language configuration model. */
export interface ConfigurationModel {
  /** Configuration file basenames. */
  readonly files: readonly string[];
  /** Glob patterns covering additional configuration locations. */
  readonly patterns: readonly string[];
  /** Optional JSON schema path. */
  readonly schemaPath?: string;
  /** Optional human-readable description. */
  readonly description?: string;
}

/** Builds an immutable configuration model, normalising optional fields. */
export function createConfigurationModel(config: LanguageConfiguration): ConfigurationModel {
  return deepFreeze({
    files: [...config.files],
    patterns: config.patterns !== undefined ? [...config.patterns] : [],
    ...(config.schemaPath !== undefined ? { schemaPath: config.schemaPath } : {}),
    ...(config.description !== undefined ? { description: config.description } : {}),
  });
}
