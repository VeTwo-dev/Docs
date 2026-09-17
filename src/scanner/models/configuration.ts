import type { ConfigFormat } from "../types/categories.js";
import type { FileModel } from "./file.js";

/** An immutable model of a detected configuration file. */
export interface ConfigurationModel {
  /** The underlying file model. */
  readonly file: FileModel;
  /** The tool or system the configuration targets (e.g. `typescript`). */
  readonly tool: string;
  /** The serialisation format of the configuration. */
  readonly format: ConfigFormat;
  /** A known schema/JSON-schema reference for the tool, when available. */
  readonly schemaPath?: string;
}

/** Input required to build a {@link ConfigurationModel}. */
export interface ConfigurationModelInput {
  readonly file: FileModel;
  readonly tool: string;
  readonly format: ConfigFormat;
  readonly schemaPath?: string;
}

/** Builds an immutable, frozen {@link ConfigurationModel}. */
export function createConfigurationModel(input: ConfigurationModelInput): ConfigurationModel {
  return Object.freeze({
    file: input.file,
    tool: input.tool,
    format: input.format,
    ...(input.schemaPath !== undefined ? { schemaPath: input.schemaPath } : {}),
  });
}
