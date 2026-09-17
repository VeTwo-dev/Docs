import type { ReferenceResolver } from "../contracts/resolver.js";
import { javascriptResolver } from "./javascript/index.js";
import { typescriptResolver } from "./typescript/index.js";

export { createBindingExtractor, extractFileBindings } from "./common.js";
export type { BindingExtractorConfig } from "./common.js";
export { javascriptResolver } from "./javascript/index.js";
export { typescriptResolver } from "./typescript/index.js";

/** The built-in reference resolvers. */
export const builtinResolvers: readonly ReferenceResolver[] = Object.freeze([
  typescriptResolver,
  javascriptResolver,
]);
