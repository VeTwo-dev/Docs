/**
 * Continuous Project Intelligence & Incremental Documentation.
 *
 * Understands project changes semantically, computes documentation
 * impact through a persisted dependency graph, and regenerates only
 * what is necessary — preserving user-owned content and keeping all
 * internal state transactional under `.vetwo/docs`.
 */

// ─── Fingerprints ────────────────────────────────────────────────────────
export {
  hashContent,
  hashFile,
  semanticHash,
  stripSemanticsPreserving,
  classifyModification,
} from "./fingerprints.js";
export type { ModificationKind } from "./fingerprints.js";

// ─── Snapshot ────────────────────────────────────────────────────────────
export type {
  ProjectSnapshot,
  SnapshotFileEntry,
  ArtifactEntry,
  TrackedFileKind,
} from "./snapshot.js";
export {
  SNAPSHOT_SCHEMA_VERSION,
  createSnapshot,
  loadSnapshot,
  saveSnapshot,
  snapshotPath,
} from "./snapshot.js";

// ─── Change detection ────────────────────────────────────────────────────
export type {
  ChangeKind,
  SemanticCategory,
  ProjectChange,
  ChangeSet,
  ScanEntry,
} from "./change-detection.js";
export {
  classifyFileKind,
  scanProjectFiles,
  snapshotFileEntry,
  extractExportNames,
  detectChanges,
  gitChangedFiles,
  gitBranch,
  filterByGitPaths,
} from "./change-detection.js";

// ─── Change graph ────────────────────────────────────────────────────────
export type { ChangeGraph } from "./graph.js";
export {
  buildChangeGraph,
  propagateImpact,
  saveChangeGraph,
  loadChangeGraph,
  graphPath,
} from "./graph.js";

// ─── Impact ──────────────────────────────────────────────────────────────
export type { ImpactLevel, DocumentationImpact, AffectedArtifact } from "./impact.js";
export { computeDocumentationImpact, maxLevel } from "./impact.js";

// ─── Engine ──────────────────────────────────────────────────────────────
export type {
  IncrementalUpdateOptions,
  IncrementalUpdateResult,
  DocumentationHealth,
} from "./engine.js";
export {
  runIncrementalUpdate,
  artifactsFromArchitecture,
  acquireLock,
  releaseLock,
  computeHealth,
} from "./engine.js";

// ─── CLI ─────────────────────────────────────────────────────────────────
export { registerIncrementalCommands } from "./cli.js";
