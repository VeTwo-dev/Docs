import type { SymbolExtractor } from "../../contracts/extractor.js";
import { createNodeSymbolExtractor } from "../common.js";
import { babelKindFor } from "../../shared/index.js";

/** The built-in JavaScript symbol extractor. */
export const javascriptExtractor: SymbolExtractor = createNodeSymbolExtractor({
  id: "javascript",
  displayName: "JavaScript Symbol Extractor",
  version: "1.0.0",
  languageId: "javascript",
  kindFor: babelKindFor,
  docFormat: "jsdoc",
  capabilities: {
    documents: "jsdoc",
    generics: "none",
    overloads: "none",
    namespaces: "none",
    decorators: "full",
    "re-exports": "full",
    barrels: "full",
    anonymous: "full",
    incremental: true,
    parallel: false,
  },
});
