import type { SymbolExtractor } from "../contracts/extractor.js";
import { javascriptExtractor } from "./javascript/index.js";
import { typescriptExtractor } from "./typescript/index.js";

export { createNodeSymbolExtractor } from "./common.js";
export type { NodeExtractorConfig } from "./common.js";
export { javascriptExtractor } from "./javascript/index.js";
export { typescriptExtractor } from "./typescript/index.js";

/** The built-in symbol extractors. */
export const builtinExtractors: readonly SymbolExtractor[] = Object.freeze([
  typescriptExtractor,
  javascriptExtractor,
]);
