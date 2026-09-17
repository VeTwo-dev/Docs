import type { CompilerAdapter } from "../../contracts/adapter.js";
import { createCompilerAdapter } from "../../contracts/adapter.js";
import { compileTypeScript } from "./compile.js";
import { TYPESCRIPT_EXTENSIONS } from "./native.js";
import { createTypeScriptSession } from "./session.js";

/**
 * The built-in TypeScript compiler adapter.
 *
 * Wraps the official TypeScript compiler API (`createSourceFile` for parsing
 * and syntactic diagnostics, `transpileModule` for optional source maps). No
 * semantic analysis — only parse/syntax level.
 */
export const typescriptCompiler: CompilerAdapter = createCompilerAdapter({
  metadata: {
    id: "typescript",
    displayName: "TypeScript Compiler",
    languageId: "typescript",
    version: "1.0.0",
    priority: 10,
    extensions: TYPESCRIPT_EXTENSIONS,
    syntax: ["typescript", "tsx", "decorators"],
    description: "Official TypeScript compiler API adapter.",
    builtin: true,
  },
  capabilities: {
    parsing: "full",
    incremental: "full",
    watch: "full",
    sourceMaps: "full",
    comments: "full",
    modules: "full",
    decorators: "full",
    jsx: "full",
    generics: "full",
    diagnostics: "full",
    projectReferences: "full",
    cache: "full",
    parallel: "basic",
  },
  configuration: {
    configPath: "tsconfig.json",
    description: "TypeScript compiler configuration",
  },
  compile: compileTypeScript,
  createIncrementalSession: createTypeScriptSession,
});
