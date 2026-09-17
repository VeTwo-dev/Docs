import { javascriptAdapter } from "./javascript/index.js";
import { typescriptAdapter } from "./typescript/index.js";
import type { LanguageAdapter } from "../contracts/adapter.js";

/** The built-in language adapters shipped with the package. */
export const builtinAdapters: readonly LanguageAdapter[] = [typescriptAdapter, javascriptAdapter];
