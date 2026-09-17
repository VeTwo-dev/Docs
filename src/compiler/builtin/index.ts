import type { CompilerAdapter } from "../contracts/adapter.js";
import { javascriptCompiler } from "./javascript/index.js";
import { typescriptCompiler } from "./typescript/index.js";

export { javascriptCompiler, typescriptCompiler };

/** The bundled compiler adapters, registered by default. */
export const builtinCompilers: readonly CompilerAdapter[] = Object.freeze([
  typescriptCompiler,
  javascriptCompiler,
]);
