/**
 * Core facade (backward compatibility).
 *
 * The build orchestration now lives in the engine layer (`src/engine`). This
 * module re-exports the engine surface so existing internal and public
 * importers of `./core/index.js` keep working unchanged.
 */
export { build, createDocsEngine } from "../engine/index.js";
export type { BuildOptions, DocsEngine, EngineOptions, InitializeResult } from "../engine/index.js";
export { createBuildContext } from "../pipeline/context.js";
