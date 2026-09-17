/**
 * Central Docs State Management.
 *
 * `@vetwo/docs` keeps every byte of project-local state it writes under the
 * canonical `<project>/.vetwo/docs/` root. This module provides the dynamic
 * namespace registry, the {@link DocsStateManager}, the legacy-state
 * migration system, `.gitignore` integration, namespace-based cleaning, a
 * state doctor and dry-run state planning.
 *
 * Namespaces are provisioned lazily and dynamically: only the namespaces the
 * currently-executed features require are ever created. Unknown or user-owned
 * state is preserved, merged — never blindly overwritten or deleted.
 */

export {
  VETWO_DIR,
  DOCS_STATE_DIR,
  STATE_MANIFEST_FILE,
  MIGRATION_MARKER,
  LEGACY_OWNED_CACHE_DIRS,
  LEGACY_UNOWNED_CACHE_DIRS,
  getVetwoRoot,
  getDocsStateRoot,
  resolveDocsStatePath,
  resolveDocsNamespacePath,
} from "./paths.js";

export {
  DEFAULT_STATE_NAMESPACES,
  DEFAULT_REGISTRY,
  createStateNamespaceRegistry,
  registerStateNamespace,
  namespaceSegments,
} from "./registry.js";
export type {
  NamespaceDefinition,
  NamespaceRetention,
  NamespaceStatus,
  StateNamespaceRegistry,
} from "./registry.js";

export { OWNERSHIP_CATEGORY_LABELS } from "./namespaces.js";
export type { StateOwnershipCategory } from "./namespaces.js";

export {
  STATE_SCHEMA_VERSION,
  createStateManifest,
  readStateManifest,
  readStateManifestRaw,
  writeStateManifest,
  writeStateManifestMerged,
  resolveStateManifestPath,
  isValidStateManifest,
  toNamespaceMeta,
} from "./manifest.js";
export type { StateManifest, NamespaceMeta, RawStateManifest } from "./manifest.js";

export { atomicWriteFile, atomicWriteJson } from "./atomic.js";

export { createDocsStateManager, ensureStateNamespace } from "./manager.js";
export type { DocsStateManager, DocsStateManagerOptions } from "./manager.js";

export {
  MIGRATION_VERSION,
  detectLegacyState,
  detectV1Layout,
  planMigration,
  needsMigration,
  applyMigration,
  MigrationError,
} from "./migrate.js";
export type {
  LegacyStateLocation,
  MigrationStep,
  MigrationPlan,
  MigrationResult,
} from "./migrate.js";

export {
  DEFAULT_STATE_IGNORE_RULE,
  getGitignorePath,
  readGitignore,
  isStateIgnored,
  ensureStateIgnored,
} from "./gitignore.js";
export type { GitignoreResult } from "./gitignore.js";

export { cleanState, cleanTargets, isRegenerableNamespace } from "./clean.js";
export type { CleanOptions, CleanResult } from "./clean.js";

export { runStateDoctor, stateSize, listStateNamespaceIds } from "./doctor.js";
export type { StateCheck, StateDoctorReport } from "./doctor.js";

export { planStateChanges } from "./plan.js";
export type { StatePlanAction } from "./plan.js";
