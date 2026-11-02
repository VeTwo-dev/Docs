export { buildCacheKey, createAICache } from "./cache/cache.js";
export type { AICache, AICacheEntry } from "./cache/cache.js";
export { hasCapability, intersectCapabilities, supportedCapabilities } from "./capabilities.js";
export type { AICapability, AIProviderCapabilities } from "./capabilities.js";
export { registerAICommands } from "./cli/commands.js";
export { DEFAULT_AI_CONFIG, resolveAIConfig } from "./config.js";
export type { AIConfig, AIProviderConfig, AIProviderProfile } from "./config.js";
export { buildAIContext, selectContextPacksForIntent } from "./context/context-builder.js";
export type { AIContextBuilderConfig, AIContextBuilderInput } from "./context/context-builder.js";
export {
  prioritizeAPIs,
  prioritizeConcepts,
  prioritizeExamples,
  trimToBudget,
} from "./context/prioritizer.js";
export {
  discoverAndRegisterProviders,
  discoverBuiltinProviders,
  discoverNpmProviders,
  registerDiscoveredProviders,
} from "./discovery.js";
export type { DiscoveredProvider } from "./discovery.js";
export { evaluatePage, evaluatePages, summarizeEvaluation } from "./evaluation/evaluator.js";
export type {
  QualityDimension,
  QualityEvaluation,
  QualityEvaluationConfig,
  QualityIssue,
} from "./evaluation/evaluator.js";
export {
  buildPageContext,
  generateBatch,
  generateDirect,
  generatePage,
  updateDocumentation,
} from "./generation/engine.js";
export type { AIGenerationConfig } from "./generation/engine.js";
export { analyzeImpact } from "./incremental/impact.js";
export type { CodeChange, ImpactAnalysis } from "./incremental/impact.js";
export { AIProviderExhaustedError, createAIProviderLifecycleManager } from "./lifecycle.js";
export type {
  AIProviderLifecycleManager,
  AIProviderLifecycleState,
  ManagedProvider,
} from "./lifecycle.js";
export { generateDocumentationPlan, inferProjectType } from "./planning/plan.js";
export type { DocPlanPage, DocumentationPlan } from "./planning/plan.js";
export { createOpenWikiProviderFactory } from "./providers/openwiki.js";
export { createAIProviderRegistry, createAIProviderRegistryWith } from "./registry.js";
export type { AIFallbackChain, AIProviderEntry, AIProviderRegistry } from "./registry.js";
export { reviewBatch, reviewPage, summarizeReview } from "./review/loop.js";
export type { AIReviewLoopConfig, AIReviewResult } from "./review/loop.js";
export { createAIRunTracker } from "./runs/tracker.js";
export type { AIRunTracker } from "./runs/tracker.js";
export {
  AI_MANAGED_SECTIONS,
  buildAIIntelligenceSection,
  buildAISkillContent,
  buildAITerminologySection,
  buildAIValidationSection,
  buildAIWorkflowSection,
  extractAIManagedSections,
  mergeAISkillContent,
} from "./skill/ai-skill.js";
export {
  buildTerminologyDictionary,
  detectTerminology,
  validateTerminology,
} from "./terminology/dictionary.js";
export { summarizeClaimValidation, validateClaim, validateClaims } from "./validation/claims.js";
export type { ClaimValidationResult, ValidationEvidence } from "./validation/claims.js";
export {
  extractLinksFromContent,
  summarizeLinkValidation,
  validateLink,
  validateLinks,
} from "./validation/links.js";
export type {
  DocumentationModel,
  GeneratedLink,
  LinkValidationResult,
} from "./validation/links.js";
export type {
  AIAPIContext,
  AIAnalysisRequest,
  AIAnalysisResult,
  AIArchitectureContext,
  AIAudience,
  AIConceptContext,
  AIConfigurationContext,
  AIContextBundle,
  AIDiagramDefinition,
  AIDocumentationClaim,
  AIDocumentationIntent,
  AIDocumentationRequest,
  AIDocumentationResult,
  AIDocumentationVoice,
  AIEvidenceReference,
  AIExampleContext,
  AIExampleProposal,
  AIExistingDoc,
  AIGeneratedPage,
  AIProjectContext,
  AIProviderContext,
  AIRecommendation,
  AIRunMetadata,
  AITerminologyEntry,
  AITroubleshootingContext,
  AIUpdateRequest,
  AIUpdateResult,
  AIWorkflowContext,
} from "./types.js";
export type { AIProvider, AIProviderFactory } from "./provider.js";
export type { AIProviderHealth, AIProviderHealthStatus } from "./health.js";
export type {
  AIAuthKind,
  AIProviderAuthRequirement,
  AIProviderMetadata,
  AIProviderModel,
} from "./metadata.js";
