/**
 * Documentation Knowledge Compiler.
 *
 * Transforms project intelligence into a complete documentation
 * architecture, an IR, and structured diagnostics. Renderer- and
 * provider-independent.
 */

// ─── Types ───────────────────────────────────────────────────────────────
export type {
  ProjectArchetype,
  DocumentationPersona,
  PageKind,
  SymbolBoundary,
  DocumentationSection,
  PageEvidence,
  DocumentationPageDefinition,
  DocumentationRelationshipKind,
  DocumentationRelationship,
  NavigationNode,
  DocumentationNavigation,
  DocumentationLearningPath,
  CoverageArea,
  AreaCoverage,
  DocumentationCoverage,
  CompilerProjectInput,
  ComposedExample,
  DocumentationArchitecture,
  ArchitectureOverrides,
  DocumentationCompilationResult,
} from "./types.js";

export type {
  DiagnosticSeverity,
  DocumentationDiagnosticCode,
  DocumentationDiagnostic,
} from "./diagnostics.js";
export { diagnostic } from "./diagnostics.js";

export type {
  DocumentationIR,
  IRBlock,
  IRExample,
  IRClaim,
  IRReference,
  IRPage,
  IRSection,
  IRNavigation,
} from "./ir.js";
export { IR_SCHEMA_VERSION } from "./ir.js";

// ─── Classifier ──────────────────────────────────────────────────────────
export type { ClassificationResult } from "./classifier.js";
export { classifyProject } from "./classifier.js";

// ─── Planner ─────────────────────────────────────────────────────────────
export {
  planArchitecture,
  deriveRelationships,
  consolidateConcepts,
  groupApisByModule,
  isDocumentable,
  slugify,
  titleize,
  SPLIT_THRESHOLD,
} from "./planner.js";

// ─── Organizer ───────────────────────────────────────────────────────────
export {
  organizeNavigation,
  wireRelatedContent,
  buildLearningPaths,
  MAX_NAVIGATION_DEPTH,
} from "./organizer.js";

// ─── Dependency Graph ────────────────────────────────────────────────────
export type { DocumentationDependencyGraph } from "./dependency.js";
export { buildDependencyGraph, topoOrderPages } from "./dependency.js";

// ─── Impact ──────────────────────────────────────────────────────────────
export type { SourceChangeKind, SourceChange, DocumentationImpact } from "./impact.js";
export { classifyImpact, detectRenames, extractDeprecation, diffProjectInputs } from "./impact.js";

// ─── Coverage ────────────────────────────────────────────────────────────
export type { DocumentationCoverage as CoverageModel } from "./types.js";
export { classifyBoundary, computeCoverage, TRACKED_AREAS } from "./coverage.js";

// ─── Prioritizer ─────────────────────────────────────────────────────────
export { computeImportance, rankPages, prioritizeGaps, IMPORTANCE_WEIGHTS } from "./prioritizer.js";

// ─── Resolver ────────────────────────────────────────────────────────────
export type { DuplicateFinding, ResolutionResult } from "./resolver.js";
export { resolveCanonicalPages, subjectSimilarity } from "./resolver.js";

// ─── Validator ───────────────────────────────────────────────────────────
export {
  validateArchitecture,
  validateIRPages,
  checkNavigationStability,
  sortDiagnostics,
} from "./validator.js";

// ─── Optimizer ───────────────────────────────────────────────────────────
export type { FingerprintInput } from "./optimizer.js";
export { computeFingerprint, needsRegeneration, selectChangedPages } from "./optimizer.js";

// ─── Framework Adapters ──────────────────────────────────────────────────
export type { FrameworkDocumentationAdapter } from "./framework/adapters.js";
export {
  registerFrameworkAdapter,
  listFrameworkAdapters,
  matchAdapters,
} from "./framework/adapters.js";

// ─── Orchestrator ────────────────────────────────────────────────────────
export type { DocumentationSnapshot, SnapshotStore, DocumentationDiff } from "./orchestrator.js";
export {
  compileArchitecture,
  compileDocumentation,
  buildIR,
  planCompilation,
  diffSnapshots,
  snapshotArchitecture,
  computePageFingerprints,
  createMemorySnapshotStore,
} from "./orchestrator.js";

// ─── CLI ─────────────────────────────────────────────────────────────────
export { registerCompilerCommands, buildCompilerInput } from "./cli.js";
