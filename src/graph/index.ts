/**
 * The graph layer — the universal knowledge graph.
 *
 * Unifies the structural symbol hierarchy from the symbol layer with the
 * resolved reference network from the reference layer into one serializable,
 * derived graph. Contributors add nodes and edges; the engine merges,
 * deduplicates and freezes them. No semantic analysis, type resolution, AI or
 * doc generation lives here — the graph only records what the layers below
 * already recovered.
 */
export * from "./models/index.js";
export * from "./contracts/index.js";
export * from "./registry/index.js";
export * from "./contributors/index.js";
export * from "./filters/index.js";
export * from "./visitors/index.js";
export * from "./shared/index.js";
export * from "./engine/index.js";
