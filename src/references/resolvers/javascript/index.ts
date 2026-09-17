import type { ReferenceResolver } from "../../contracts/resolver.js";
import { createBindingExtractor } from "../common.js";

/** The built-in JavaScript reference resolver. */
export const javascriptResolver: ReferenceResolver = createBindingExtractor({
  id: "javascript",
  displayName: "JavaScript Reference Resolver",
  version: "1.0.0",
  languageId: "javascript",
  capabilities: {
    "import-bindings": "full",
    "export-aliases": "basic",
    "default-imports": "full",
    "namespace-imports": "full",
    "re-exports": "full",
  },
});
