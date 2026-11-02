export { hashContent } from "../compiler/shared/hash.js";
export type { DocumentationImpact } from "../documentation/compiler/impact.js";
export {
  classifyFileKind,
  detectChanges,
  extractExportNames,
  filterByGitPaths,
  gitBranch,
  gitChangedFiles,
  scanProjectFiles,
  snapshotFileEntry,
} from "./change-detection.js";
export type {
  ChangeKind,
  ChangeSet,
  ProjectChange,
  ScanEntry,
  SemanticCategory,
} from "./change-detection.js";
export { registerIncrementalCommands } from "./cli.js";
export {
  acquireLock,
  artifactsFromArchitecture,
  computeHealth,
  releaseLock,
  runIncrementalUpdate,
} from "./engine.js";
export type {
  DocumentationHealth,
  IncrementalUpdateOptions,
  IncrementalUpdateResult,
} from "./engine.js";
export {
  classifyModification,
  hashFile,
  semanticHash,
  stripSemanticsPreserving,
} from "./fingerprints.js";
export type { ModificationKind } from "./fingerprints.js";
export {
  buildChangeGraph,
  graphPath,
  loadChangeGraph,
  propagateImpact,
  saveChangeGraph,
} from "./graph.js";
export type { ChangeGraph } from "./graph.js";
export { computeDocumentationImpact, maxLevel } from "./impact.js";
export type { AffectedArtifact, ImpactLevel } from "./impact.js";
export {
  SNAPSHOT_SCHEMA_VERSION,
  createSnapshot,
  loadSnapshot,
  saveSnapshot,
  snapshotPath,
} from "./snapshot.js";
export type {
  ArtifactEntry,
  ProjectSnapshot,
  SnapshotFileEntry,
  TrackedFileKind,
} from "./snapshot.js";
