/**
 * The reference layer — the universal Reference Resolution Engine.
 *
 * Transforms the isolated symbols produced by the symbol layer into a
 * connected reference network. Recovers import/export name bindings from the
 * compiler layer's syntax trees, builds per-module scopes, resolves every
 * reference (imports, exports, re-exports, heritage, type aliases) and
 * derives a reference graph. No semantic analysis, type resolution,
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
export * from "./scope/index.js";
export * from "./shared/index.js";
export * from "./resolvers/index.js";
export * from "./resolution/index.js";
export * from "./ownership/index.js";
export * from "./cycles/index.js";
export * from "./engine/index.js";
