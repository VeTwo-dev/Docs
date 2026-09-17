import type { LanguageAdapter } from "../../contracts/adapter.js";
import { createLanguageAdapter } from "../../contracts/adapter.js";
import {
  JAVASCRIPT_CONFIG_FILES,
  JAVASCRIPT_ENTRY_FILES,
  JAVASCRIPT_FRAMEWORKS,
  JSDOC_COMMENT_STANDARD,
  NODE_ECOSYSTEM_LOCKFILES,
} from "../shared/index.js";

/**
 * The built-in JavaScript adapter.
 *
 * Minimal metadata + capability declarations only — no compiler, parser or
 * symbol analysis. Deep analysis arrives in future phases.
 */
export const javascriptAdapter: LanguageAdapter = createLanguageAdapter({
  metadata: {
    id: "javascript",
    displayName: "JavaScript",
    aliases: ["js", "node"],
    version: "1.0.0",
    priority: 5,
    extensions: [".js", ".jsx", ".mjs", ".cjs"],
    fileNames: ["jsconfig.json", "babel.config.js", "babel.config.json"],
    mimeTypes: ["application/javascript", "text/javascript"],
    lockfiles: NODE_ECOSYSTEM_LOCKFILES,
    configFiles: JAVASCRIPT_CONFIG_FILES,
    defaultEntryFiles: JAVASCRIPT_ENTRY_FILES,
    color: "#f1e05a",
    icon: "javascript",
  },
  capabilities: {
    scanning: true,
    compilation: false,
    parsing: "basic",
    ast: false,
    typeSystem: false,
    comments: "full",
    imports: true,
    exports: true,
    modules: "full",
    packages: "full",
    generics: false,
    decorators: false,
    macros: false,
    reflection: false,
    incrementalCompilation: false,
    sourceMaps: "basic",
    diagnostics: "basic",
    documentationComments: ["jsdoc"],
    examples: true,
    languageServer: "basic",
    semanticTokens: "basic",
  },
  configuration: {
    files: JAVASCRIPT_CONFIG_FILES,
    description: "JavaScript configuration",
  },
  commentStandards: [JSDOC_COMMENT_STANDARD],
  frameworkSupport: JAVASCRIPT_FRAMEWORKS,
});
