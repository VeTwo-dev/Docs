/**
 * The scanner subsystem — the universal project scanner engine.
 *
 * This is the single source of truth for discovering, classifying and
 * indexing project structure. The legacy discovery helpers (`detectProject`,
 * `discoverDocFiles`, `discoverSourceFiles`, ...) are preserved for backward
 * compatibility and continue to feed the docs pipeline.
 */
export * from "./engine/index.js";
export * from "./providers/index.js";
export * from "./models/index.js";
export * from "./classifiers/index.js";
export * from "./discovery/index.js";
export * from "./filters/index.js";
export * from "./cache/index.js";
export * from "./watch/index.js";
export * from "./types/index.js";
export * from "./utils/index.js";

// Legacy discovery API (backward compatibility)
export {
  detectProject,
  detectPackageManager,
  detectPM,
  detectProjectType,
  detectWorkspaces,
  getWorkspaceInfo,
  discoverPackages,
  detectTypeScript,
  detectGit,
  detectReadme,
  detectChangelog,
} from "./project.js";
export type { ProjectDetection } from "./project.js";
export { discoverDocFiles, discoverSourceFiles } from "./files.js";
