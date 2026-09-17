import { deepFreeze } from "../../languages/models/freeze.js";
import type { SourceMap } from "../results/index.js";

/** Input required to build a {@link SourceMap}. */
export interface SourceMapInput {
  readonly version?: number;
  readonly file?: string;
  readonly sourceRoot?: string;
  readonly sources: readonly string[];
  readonly sourcesContent?: readonly (string | null)[];
  readonly names: readonly string[];
  readonly mappings: string;
}

/** Builds an immutable normalized {@link SourceMap}. */
export function createSourceMap(input: SourceMapInput): SourceMap {
  return deepFreeze({
    version: 3,
    ...(input.file !== undefined ? { file: input.file } : {}),
    ...(input.sourceRoot !== undefined ? { sourceRoot: input.sourceRoot } : {}),
    sources: [...input.sources],
    ...(input.sourcesContent !== undefined ? { sourcesContent: [...input.sourcesContent] } : {}),
    names: [...input.names],
    mappings: input.mappings,
  });
}
