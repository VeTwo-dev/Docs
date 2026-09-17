import type { CompilerAdapter } from "../../contracts/adapter.js";
import { createCompilerAdapter } from "../../contracts/adapter.js";
import { compileJavaScript } from "./compile.js";
import { JAVASCRIPT_EXTENSIONS } from "./native.js";

/**
 * The built-in JavaScript compiler adapter.
 *
 * Wraps the official Babel parser. Only parsing and normalized syntax trees —
 * no transforms, no emit, no semantic analysis.
 */
export const javascriptCompiler: CompilerAdapter = createCompilerAdapter({
  metadata: {
    id: "javascript",
    displayName: "JavaScript Compiler",
    languageId: "javascript",
    version: "1.0.0",
    priority: 5,
    extensions: JAVASCRIPT_EXTENSIONS,
    syntax: ["ecmascript", "jsx"],
    description: "Babel parser adapter for JavaScript.",
    builtin: true,
  },
  capabilities: {
    parsing: "full",
    incremental: "basic",
    watch: "full",
    sourceMaps: "none",
    comments: "full",
    modules: "full",
    decorators: "basic",
    jsx: "full",
    generics: "none",
    diagnostics: "basic",
    projectReferences: "none",
    cache: "full",
    parallel: "basic",
  },
  configuration: {
    configPath: "jsconfig.json",
    description: "Babel parser configuration",
  },
  compile: compileJavaScript,
});
