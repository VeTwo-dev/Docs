/**
 * @module AI
 *
 * Pluggable AI Documentation Provider System and AI Documentation Intelligence Engine.
 *
 * This module provides:
 * - Provider interface and registry for pluggable AI backends
 * - Capability negotiation and health checks
 * - Context assembly from project intelligence
 * - Documentation planning with project-type awareness
 * - Terminology detection and validation
 * - Anti-hallucination claim validation
 * - Quality evaluation and review loops
 * - Incremental regeneration
 * - Run tracking and caching
 * - Skill file generation
 */

// ─── Core Types ──────────────────────────────────────────────────────────
export type { AIProviderCapabilities, AICapability } from "./capabilities.js";
export { hasCapability, supportedCapabilities, intersectCapabilities } from "./capabilities.js";

export type {
  AIProviderMetadata,
  AIProviderModel,
  AIAuthKind,
  AIProviderAuthRequirement,
} from "./metadata.js";

export type {
  AIDocumentationIntent,
  AIAudience,
  AIDocumentationVoice,
  AITerminologyEntry,
  AIAnalysisRequest,
  AIAnalysisResult,
  AIDocumentationRequest,
  AIDocumentationResult,
  AIUpdateRequest,
  AIUpdateResult,
  AIContextBundle,
  AIProjectContext,
  AIArchitectureContext,
  AIAPIContext,
  AIConceptContext,
  AIExampleContext,
  AIWorkflowContext,
  AIConfigurationContext,
  AITroubleshootingContext,
  AIExistingDoc,
  AIEvidenceReference,
  AIDocumentationClaim,
  AIDiagramDefinition,
  AIExampleProposal,
  AIRecommendation,
  AIProviderContext,
  AIRunMetadata,
  AIGeneratedPage,
} from "./types.js";

// ─── Provider Interface ──────────────────────────────────────────────────
export type { AIProvider, AIProviderFactory } from "./provider.js";

// ─── Health ──────────────────────────────────────────────────────────────
export type { AIProviderHealthStatus, AIProviderHealth } from "./health.js";

// ─── Registry ────────────────────────────────────────────────────────────
export type { AIProviderRegistry, AIProviderEntry, AIFallbackChain } from "./registry.js";
export { createAIProviderRegistry, createAIProviderRegistryWith } from "./registry.js";

// ─── Discovery ───────────────────────────────────────────────────────────
export type { DiscoveredProvider } from "./discovery.js";
export {
  discoverBuiltinProviders,
  discoverNpmProviders,
  registerDiscoveredProviders,
  discoverAndRegisterProviders,
} from "./discovery.js";

// ─── Config ──────────────────────────────────────────────────────────────
export type { AIProviderConfig, AIConfig, AIProviderProfile } from "./config.js";
export { DEFAULT_AI_CONFIG, resolveAIConfig } from "./config.js";

// ─── Lifecycle ───────────────────────────────────────────────────────────
export type {
  AIProviderLifecycleManager,
  ManagedProvider,
  AIProviderLifecycleState,
} from "./lifecycle.js";
export { AIProviderExhaustedError, createAIProviderLifecycleManager } from "./lifecycle.js";

// ─── Context Builder ─────────────────────────────────────────────────────
export type { AIContextBuilderInput, AIContextBuilderConfig } from "./context/context-builder.js";
export { buildAIContext, selectContextPacksForIntent } from "./context/context-builder.js";

// ─── Context Prioritizer ─────────────────────────────────────────────────
export {
  prioritizeAPIs,
  prioritizeExamples,
  prioritizeConcepts,
  trimToBudget,
} from "./context/prioritizer.js";

// ─── Planning ────────────────────────────────────────────────────────────
export type { DocPlanPage, DocumentationPlan } from "./planning/plan.js";
export { generateDocumentationPlan, inferProjectType } from "./planning/plan.js";

// ─── Terminology ─────────────────────────────────────────────────────────
export {
  detectTerminology,
  buildTerminologyDictionary,
  validateTerminology,
} from "./terminology/dictionary.js";

// ─── Validation ──────────────────────────────────────────────────────────
export type { ClaimValidationResult, ValidationEvidence } from "./validation/claims.js";
export { validateClaim, validateClaims, summarizeClaimValidation } from "./validation/claims.js";

export type {
  GeneratedLink,
  LinkValidationResult,
  DocumentationModel,
} from "./validation/links.js";
export {
  validateLink,
  validateLinks,
  extractLinksFromContent,
  summarizeLinkValidation,
} from "./validation/links.js";

// ─── Generation ──────────────────────────────────────────────────────────
export type { AIGenerationConfig } from "./generation/engine.js";
export {
  generatePage,
  generateBatch,
  generateDirect,
  updateDocumentation,
  buildPageContext,
} from "./generation/engine.js";

// ─── Evaluation ──────────────────────────────────────────────────────────
export type {
  QualityDimension,
  QualityEvaluation,
  QualityIssue,
  QualityEvaluationConfig,
} from "./evaluation/evaluator.js";
export { evaluatePage, evaluatePages, summarizeEvaluation } from "./evaluation/evaluator.js";

// ─── Review Loop ─────────────────────────────────────────────────────────
export type { AIReviewLoopConfig, AIReviewResult } from "./review/loop.js";
export { reviewPage, reviewBatch, summarizeReview } from "./review/loop.js";

// ─── Run Tracking ────────────────────────────────────────────────────────
export type { AIRunTracker } from "./runs/tracker.js";
export { createAIRunTracker } from "./runs/tracker.js";

// ─── Cache ───────────────────────────────────────────────────────────────
export type { AICache, AICacheEntry } from "./cache/cache.js";
export { createAICache, buildCacheKey } from "./cache/cache.js";

// ─── Incremental ─────────────────────────────────────────────────────────
export type { CodeChange, ImpactAnalysis } from "./incremental/impact.js";
export { analyzeImpact } from "./incremental/impact.js";

// ─── Skill ───────────────────────────────────────────────────────────────
export {
  buildAIIntelligenceSection,
  buildAIWorkflowSection,
  buildAIValidationSection,
  buildAITerminologySection,
  buildAISkillContent,
  extractAIManagedSections,
  mergeAISkillContent,
  AI_MANAGED_SECTIONS,
} from "./skill/ai-skill.js";

// ─── Provider Adapters ───────────────────────────────────────────────────
export { createOpenWikiProviderFactory } from "./providers/openwiki.js";

// ─── CLI ─────────────────────────────────────────────────────────────────
export { registerAICommands } from "./cli/commands.js";
