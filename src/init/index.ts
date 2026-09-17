/**
 * Documentation Workspace Bootstrap & Safe Init System.
 *
 * `docs init` / `vetwo-docs init` is a safe, idempotent, configuration-aware
 * project bootstrapper. It prepares the AI agent workspace (`agent/`), the
 * documentation output workspace (`next/`, `md/`, `static/`), and the
 * configuration file — preserving every existing user file and never
 * overwriting user-owned content.
 */

export { initializeDocumentationWorkspace } from "./engine/index.js";

export {
  buildInitPlan,
  applicableActions,
  hasConflicts,
  requiresConfirmation,
} from "./planner/index.js";

export {
  NodeSafeFileSystem,
  MemorySafeFileSystem,
  normalizePath,
  safeCreate,
  safeCreateFile,
  safeWrite,
  safeCopy,
  safeMkdir,
  safeRemove,
} from "./filesystem/index.js";

export {
  buildSkillContent,
  buildConfigContent,
  buildAgentReadme,
  buildPlansReadme,
  buildNextScaffold,
  buildMarkdownReadme,
  buildStaticReadme,
  MANAGED_SECTIONS,
  SKILL_ID,
} from "./templates/index.js";

export { mergeSkillContent, mergeConfigContent, detectConfigSections } from "./merge/index.js";

export {
  readManifest,
  writeManifest,
  manifestPathFor,
  createManifest,
  mergeManifest,
  MANIFEST_SCHEMA_VERSION,
  SKILL_SCHEMA_VERSION,
  MANIFEST_DIR,
  MANIFEST_FILE,
} from "./manifests/index.js";

export { validateWorkspace } from "./diagnostics/index.js";
export { buildInitResult, printInitReport } from "./diagnostics/index.js";

export { classifyPath, isSystemOwned, resolveConflict, OWNERSHIP_LABELS } from "./safety/index.js";

export {
  extractWorkspaceConfig,
  resolveProjectRoot,
  detectProjectInfo,
  findConfigFile,
} from "./engine/index.js";

export type { InitOptions, InitMode, InitLayout } from "./types/options.js";
export type { InitResult } from "./types/result.js";
export type { PlanAction, InitAction, Ownership, RiskLevel, PathKind } from "./types/plan.js";
export type {
  WorkspaceConfig,
  ExistingState,
  DetectedProject,
  DetectedPackage,
} from "./types/workspace.js";
export type { WorkspaceManifest, ManifestFileEntry } from "./types/manifest.js";
export type {
  SafeFileSystem,
  SafeOpResult,
  SafeOpOptions,
  SafeWriteOptions,
} from "./filesystem/index.js";
export type { ValidationCheck, ValidationReport, ValidateInput } from "./diagnostics/index.js";
export type { ScaffoldFile, SkillContext, ConfigTemplateContext } from "./templates/index.js";
