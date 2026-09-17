import type { SymbolExtractor } from "../../contracts/extractor.js";
import { createNodeSymbolExtractor } from "../common.js";
import { typeScriptKindFor } from "../../shared/index.js";

/** The built-in TypeScript symbol extractor. */
export const typescriptExtractor: SymbolExtractor = createNodeSymbolExtractor({
  id: "typescript",
  displayName: "TypeScript Symbol Extractor",
  version: "1.0.0",
  languageId: "typescript",
  kindFor: typeScriptKindFor,
  docFormat: "tsdoc",
  capabilities: {
    documents: "tsdoc",
    generics: "full",
    overloads: "full",
    namespaces: "full",
    decorators: "full",
    "re-exports": "full",
    barrels: "full",
    anonymous: "full",
    incremental: true,
    parallel: false,
  },
});
