import type { LanguageAdapter } from "../../contracts/adapter.js";
import { createLanguageAdapter } from "../../contracts/adapter.js";
import {
  JSDOC_COMMENT_STANDARD,
  NODE_ECOSYSTEM_LOCKFILES,
  TSDOC_COMMENT_STANDARD,
  TYPESCRIPT_CONFIG_FILES,
  TYPESCRIPT_ENTRY_FILES,
  TYPESCRIPT_FRAMEWORKS,
} from "../shared/index.js";

/**
 * The built-in TypeScript adapter.
 *
 * Minimal metadata + capability declarations only — no compiler, parser or
 * symbol analysis. Deep analysis arrives in future phases.
 */
export const typescriptAdapter: LanguageAdapter = createLanguageAdapter({
  metadata: {
    id: "typescript",
    displayName: "TypeScript",
    aliases: ["ts"],
    version: "1.0.0",
    priority: 10,
    extensions: [".ts", ".tsx", ".mts", ".cts"],
    fileNames: ["tsconfig.json", "tsconfig.build.json", "tsconfig.eslint.json"],
    mimeTypes: ["application/typescript", "text/typescript"],
    lockfiles: NODE_ECOSYSTEM_LOCKFILES,
    configFiles: TYPESCRIPT_CONFIG_FILES,
    defaultEntryFiles: TYPESCRIPT_ENTRY_FILES,
    color: "#3178c6",
    icon: "typescript",
  },
  capabilities: {
    scanning: true,
    compilation: "full",
    parsing: "basic",
    ast: false,
    typeSystem: "full",
    comments: "full",
    imports: true,
    exports: true,
    modules: "full",
    packages: "basic",
    generics: "full",
    decorators: "full",
    macros: false,
    reflection: "basic",
    incrementalCompilation: "full",
    sourceMaps: "full",
    diagnostics: "full",
    documentationComments: ["jsdoc", "tsdoc"],
    examples: true,
    languageServer: "full",
    semanticTokens: "full",
  },
  configuration: {
    files: TYPESCRIPT_CONFIG_FILES,
    description: "TypeScript compiler configuration",
  },
  commentStandards: [JSDOC_COMMENT_STANDARD, TSDOC_COMMENT_STANDARD],
  frameworkSupport: TYPESCRIPT_FRAMEWORKS,
});
