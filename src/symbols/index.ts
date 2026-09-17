/**
 * The symbol layer — the universal symbol extraction engine.
 *
 * Builds a normalized, language-independent symbol model on top of the
 * compiler layer. Consumes {@link CompilationUnit}s and produces typed
 * {@link Symbol}s, structural relationships, diagnostics, incremental
 * extraction and a derived graph. No semantic analysis, type resolution,
 * knowledge graph, AI or doc generation lives here.
 */
export * from "./models/index.js";
export * from "./contracts/index.js";
export * from "./registry/index.js";
export * from "./filters/index.js";
export * from "./visitors/index.js";
export * from "./diagnostics/index.js";
export * from "./cache/index.js";
export * from "./graph/index.js";
export * from "./shared/index.js";
export * from "./extractors/index.js";
export * from "./engine/index.js";
