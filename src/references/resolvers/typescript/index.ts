import type { ReferenceResolver } from "../../contracts/resolver.js";
import { createBindingExtractor } from "../common.js";

/** The built-in TypeScript reference resolver. */
export const typescriptResolver: ReferenceResolver = createBindingExtractor({
  id: "typescript",
  displayName: "TypeScript Reference Resolver",
  version: "1.0.0",
  languageId: "typescript",
  capabilities: {
    "import-bindings": "full",
    "export-aliases": "full",
    "default-imports": "full",
    "namespace-imports": "full",
    "re-exports": "full",
  },
});
