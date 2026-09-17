/**
 * AI Provider Core Types.
 *
 * Request and result contracts for the AI Documentation Engine ↔ Provider
 * boundary. These types are provider-agnostic — no vendor-specific concepts
 * leak through.
 */

// ─── Documentation Intent ────────────────────────────────────────────────

/** What kind of documentation is being requested. */
export type AIDocumentationIntent =
  | "overview"
  | "getting-started"
  | "concept"
  | "guide"
  | "tutorial"
  | "api-reference"
  | "configuration"
  | "cli-reference"
  | "architecture"
  | "example"
  | "troubleshooting"
  | "migration"
  | "faq"
  | "changelog"
  | "comparison"
  | "installation"
  | "deployment"
  | "testing"
  | "contributing"
  | "custom";

// ─── Audience ────────────────────────────────────────────────────────────

/** The intended reader of the generated documentation. */
export type AIAudience =
  | "beginner"
  | "developer"
  | "advanced"
  | "maintainer"
  | "integrator"
  | "plugin-author"
  | "api-consumer"
  | "operator"
  | "contributor"
  | "evaluator";

// ─── Voice / Style ───────────────────────────────────────────────────────

/** Writing style preferences for AI-generated documentation. */
export interface AIDocumentationVoice {
  /** Target language (BCP 47 tag, e.g. `"en"`, `"ar"`, `"fr"`). */
  readonly language?: string;
  /** Writing tone: `"formal"`, `"casual"`, `"technical"`, `"friendly"`. */
  readonly tone?: string;
  /** Technical depth: `"shallow"`, `"moderate"`, `"deep"`. */
  readonly depth?: string;
  /** Verbosity: `"concise"`, `"balanced"`, `"detailed"`. */
  readonly verbosity?: string;
  /** Preferred terminology set (project-specific dictionary key). */
  readonly terminology?: string;
  /** Code style preferences (e.g. `"functional"`, `"oop"`). */
  readonly codeStyle?: string;
}

// ─── Terminology ─────────────────────────────────────────────────────────

/** A single terminology entry mapping a concept to its canonical form. */
export interface AITerminologyEntry {
  /** The canonical name the AI should use. */
  readonly canonical: string;
  /** Accepted aliases (deprecated, abbreviated, etc.). */
  readonly aliases?: readonly string[];
  /** Category: `"api"`, `"product"`, `"framework"`, `"config"`, `"concept"`. */
  readonly category?: string;
  /** Do not translate this term in localized docs. */
  readonly preserveInTranslation?: boolean;
}

// ─── Analysis ────────────────────────────────────────────────────────────

/** Request to analyze project intelligence and produce a summary. */
export interface AIAnalysisRequest {
  /** Project root directory. */
  readonly rootDir: string;
  /** Structured project intelligence (scanner → compiler → symbols → references → knowledge graph). */
  readonly projectIntelligence: Record<string, unknown>;
  /** What the analysis should focus on. */
  readonly focus?: readonly string[];
  /** Voice / style preferences. */
  readonly voice?: AIDocumentationVoice;
}

/** Result of a project analysis. */
export interface AIAnalysisResult {
  /** Human-readable summary of the project. */
  readonly summary: string;
  /** Identified project type. */
  readonly projectType?: string;
  /** Key subsystems identified. */
  readonly subsystems?: readonly string[];
  /** Recommended documentation structure. */
  readonly recommendedStructure?: readonly string[];
  /** Key terminology detected. */
  readonly terminology?: readonly AITerminologyEntry[];
  /** Raw provider response (provider-specific). */
  readonly raw?: unknown;
}

// ─── Documentation Generation ────────────────────────────────────────────

/** A structured request to generate a documentation page. */
export interface AIDocumentationRequest {
  /** The documentation intent (overview, guide, api-reference, etc.). */
  readonly intent: AIDocumentationIntent;
  /** The target audience. */
  readonly audience: AIAudience;
  /** Title or topic of the page. */
  readonly topic: string;
  /** Structured context assembled by the AI Context Builder. */
  readonly context: AIContextBundle;
  /** Writing style preferences. */
  readonly voice?: AIDocumentationVoice;
  /** Terminology dictionary to enforce. */
  readonly terminology?: readonly AITerminologyEntry[];
  /** Related page slugs (for link generation). */
  readonly relatedPages?: readonly string[];
  /** Target language for output. */
  readonly language?: string;
  /** Output format: `"markdown"` (default) or `"mdx"`. */
  readonly format?: "markdown" | "mdx";
}

/** A generated documentation page. */
export interface AIGeneratedPage {
  /** Page slug (e.g. `"getting-started"`, `"api/create-user"`). */
  readonly slug: string;
  /** Page title. */
  readonly title: string;
  /** The generated content body. */
  readonly content: string;
  /** Documentation intent this page serves. */
  readonly intent: AIDocumentationIntent;
  /** Target audience. */
  readonly audience: AIAudience;
  /** Language of the generated content. */
  readonly language: string;
  /** Output format. */
  readonly format: "markdown" | "mdx";
  /** Claims made in this page (for validation). */
  readonly claims?: readonly AIDocumentationClaim[];
  /** Related page slugs. */
  readonly relatedPages?: readonly string[];
  /** Evidence references backing the generated content. */
  readonly evidence?: readonly AIEvidenceReference[];
}

/** Result of a documentation generation request. */
export interface AIDocumentationResult {
  /** Generated pages. */
  readonly pages: readonly AIGeneratedPage[];
  /** Diagrams recommended or generated. */
  readonly diagrams?: readonly AIDiagramDefinition[];
  /** Example proposals (missing examples the AI recommends creating). */
  readonly exampleProposals?: readonly AIExampleProposal[];
  /** Recommendations for follow-up work. */
  readonly recommendations?: readonly AIRecommendation[];
  /** All claims made across all pages (for validation). */
  readonly claims?: readonly AIDocumentationClaim[];
  /** Raw provider response. */
  readonly raw?: unknown;
}

// ─── Update Request ──────────────────────────────────────────────────────

/** Request to update existing documentation based on changes. */
export interface AIUpdateRequest {
  /** Paths of files that changed. */
  readonly changedFiles: readonly string[];
  /** Existing documentation pages that may need updating. */
  readonly existingPages: readonly AIGeneratedPage[];
  /** Structured context for the changed area. */
  readonly context: AIContextBundle;
  /** Voice / style preferences. */
  readonly voice?: AIDocumentationVoice;
  /** Terminology dictionary. */
  readonly terminology?: readonly AITerminologyEntry[];
}

/** Result of an update request. */
export interface AIUpdateResult {
  /** Pages that were updated. */
  readonly updated: readonly AIGeneratedPage[];
  /** Pages that were left unchanged. */
  readonly unchanged: readonly string[];
  /** Pages that should be removed (orphaned by changes). */
  readonly removed?: readonly string[];
  /** Raw provider response. */
  readonly raw?: unknown;
}

// ─── Context Bundle ──────────────────────────────────────────────────────

/**
 * A bundle of structured context assembled by the AI Context Builder.
 * This is what gets sent to the provider — never raw source code.
 */
export interface AIContextBundle {
  /** Project-level metadata. */
  readonly project?: AIProjectContext;
  /** Architecture summary from the knowledge graph. */
  readonly architecture?: AIArchitectureContext;
  /** API surface information. */
  readonly api?: AIAPIContext;
  /** Concept explanations. */
  readonly concepts?: AIConceptContext[];
  /** Relevant examples. */
  readonly examples?: AIExampleContext[];
  /** Relevant workflows. */
  readonly workflows?: AIWorkflowContext[];
  /** Configuration reference. */
  readonly configuration?: AIConfigurationContext;
  /** Troubleshooting information. */
  readonly troubleshooting?: AITroubleshootingContext;
  /** Migration context (if generating migration docs). */
  readonly migration?: AIMigrationContext;
  /** Existing documentation to preserve or reference. */
  readonly existingDocumentation?: readonly AIExistingDoc[];
  /** Total estimated token count of this bundle (for budgeting). */
  readonly estimatedTokens?: number;
}

// ─── Context Pack Types ──────────────────────────────────────────────────

export interface AIProjectContext {
  readonly name: string;
  readonly description?: string;
  readonly version?: string;
  readonly type?: string;
  readonly language?: string;
  readonly framework?: string;
  readonly packageManager?: string;
  readonly rootFiles?: readonly string[];
  readonly dependencies?: readonly string[];
}

export interface AIArchitectureContext {
  readonly subsystems?: readonly string[];
  readonly entryPoints?: readonly string[];
  readonly moduleGraph?: readonly { from: string; to: string; kind: string }[];
  readonly dataFlow?: readonly string[];
  readonly extensionPoints?: readonly string[];
  readonly keyPatterns?: readonly string[];
}

export interface AIAPIContext {
  readonly publicSymbols?: readonly {
    readonly name: string;
    readonly kind: string;
    readonly signature?: string;
    readonly description?: string;
    readonly parameters?: readonly { name: string; type: string; description?: string }[];
    readonly returnType?: string;
    readonly examples?: readonly string[];
    readonly sourceFile?: string;
  }[];
  readonly exports?: readonly string[];
}

export interface AIConceptContext {
  readonly name: string;
  readonly description: string;
  readonly relatedApis?: readonly string[];
  readonly relatedConcepts?: readonly string[];
  readonly evidence?: readonly AIEvidenceReference[];
}

export interface AIExampleContext {
  readonly title: string;
  readonly code: string;
  readonly language: string;
  readonly source: "project" | "test" | "documentation" | "generated";
  readonly description?: string;
  readonly apis?: readonly string[];
  readonly provenance?: string;
  readonly confidence: number;
}

export interface AIWorkflowContext {
  readonly name: string;
  readonly description: string;
  readonly steps: readonly string[];
  readonly apis?: readonly string[];
  readonly prerequisites?: readonly string[];
}

export interface AIConfigurationContext {
  readonly keys?: readonly {
    readonly name: string;
    readonly type: string;
    readonly description?: string;
    readonly default?: string;
    readonly required?: boolean;
  }[];
  readonly examples?: readonly string[];
}

export interface AITroubleshootingContext {
  readonly commonErrors?: readonly {
    readonly error: string;
    readonly cause?: string;
    readonly solution?: string;
  }[];
  readonly faqs?: readonly { question: string; answer: string }[];
}

export interface AIMigrationContext {
  readonly fromVersion?: string;
  readonly toVersion?: string;
  readonly breakingChanges?: readonly string[];
  readonly migrationSteps?: readonly string[];
}

export interface AIExistingDoc {
  readonly slug: string;
  readonly title: string;
  readonly content?: string;
  readonly language: string;
}

// ─── Evidence & Claims ───────────────────────────────────────────────────

/** A reference to project evidence backing a generated claim. */
export interface AIEvidenceReference {
  /** Kind of evidence: `"symbol"`, `"file"`, `"config"`, `"test"`, `"dependency"`, `"graph"`. */
  readonly kind: string;
  /** The evidence value (symbol name, file path, config key, etc.). */
  readonly value: string;
  /** Confidence in this evidence: `"verified"`, `"inferred"`, `"recommended"`, `"unknown"`. */
  readonly confidence: "verified" | "inferred" | "recommended" | "unknown";
  /** Optional location. */
  readonly location?: string;
}

/**
 * A claim made by the AI during documentation generation.
 * Claims are validated against project evidence before acceptance.
 */
export interface AIDocumentationClaim {
  /** The claim text (e.g. "createUser creates a new user account"). */
  readonly text: string;
  /** Evidence backing this claim. */
  readonly evidence: readonly AIEvidenceReference[];
  /** Confidence level: 0.0 (speculative) to 1.0 (certain). */
  readonly confidence: number;
  /** Whether this claim has been validated. */
  readonly validated?: boolean;
  /** Validation failure reason, if any. */
  readonly validationError?: string;
}

// ─── Diagrams ────────────────────────────────────────────────────────────

/** Type of diagram. */
export type AIDiagramType =
  | "architecture"
  | "sequence"
  | "flow"
  | "dependency"
  | "data-flow"
  | "state"
  | "workflow"
  | "class"
  | "component";

/** A diagram definition produced by the AI. */
export interface AIDiagramDefinition {
  /** Diagram type. */
  readonly type: AIDiagramType;
  /** Human-readable title. */
  readonly title: string;
  /** Diagram content (Mermaid syntax). */
  readonly content: string;
  /** Evidence backing the diagram. */
  readonly evidence?: readonly AIEvidenceReference[];
  /** Whether this diagram was validated against the knowledge graph. */
  readonly validated?: boolean;
}

// ─── Examples ────────────────────────────────────────────────────────────

/** A proposal for an example that should be created. */
export interface AIExampleProposal {
  /** Target API or concept. */
  readonly target: string;
  /** Desired behavior to demonstrate. */
  readonly description: string;
  /** Required imports. */
  readonly imports?: readonly string[];
  /** Relevant configuration. */
  readonly configuration?: string;
  /** Complexity level: `"simple"`, `"moderate"`, `"advanced"`. */
  readonly complexity: "simple" | "moderate" | "advanced";
  /** Evidence supporting the need for this example. */
  readonly evidence?: readonly AIEvidenceReference[];
}

// ─── Recommendations ─────────────────────────────────────────────────────

/** A recommendation for follow-up documentation work. */
export interface AIRecommendation {
  /** Recommendation kind: `"gap"`, `"improvement"`, `"missing-example"`, `"missing-diagram"`, `"update"`. */
  readonly kind: string;
  /** Human-readable description. */
  readonly description: string;
  /** Priority: `"low"`, `"medium"`, `"high"`. */
  readonly priority: "low" | "medium" | "high";
  /** Related page slug, if any. */
  readonly relatedSlug?: string;
}

// ─── Provider Context ────────────────────────────────────────────────────

/** Context passed to a provider during initialization. */
export interface AIProviderContext {
  /** Project root directory. */
  readonly rootDir: string;
  /** The docs state root (`.vetwo/docs`). */
  readonly stateRoot: string;
  /** Provider-specific options from config. */
  readonly options?: Record<string, unknown>;
  /** Logger instance. */
  readonly log?: {
    readonly info: (msg: string) => void;
    readonly warn: (msg: string) => void;
    readonly error: (msg: string) => void;
    readonly debug: (msg: string) => void;
  };
}

// ─── Run Metadata ────────────────────────────────────────────────────────

/** Metadata for a single AI generation run. */
export interface AIRunMetadata {
  /** Unique run identifier. */
  readonly runId: string;
  /** Provider used. */
  readonly provider: string;
  /** Model used. */
  readonly model: string;
  /** When the run started. */
  readonly startedAt: string;
  /** When the run completed. */
  readonly completedAt?: string;
  /** Fingerprint of the input context. */
  readonly inputFingerprint?: string;
  /** Fingerprint of the output. */
  readonly outputFingerprint?: string;
  /** Number of pages generated. */
  readonly pagesGenerated?: number;
  /** Number of pages updated. */
  readonly pagesUpdated?: number;
  /** Validation status: `"passed"`, `"partial"`, `"failed"`. */
  readonly validationStatus?: "passed" | "partial" | "failed";
  /** Number of claims validated. */
  readonly claimsValidated?: number;
  /** Number of claims rejected. */
  readonly claimsRejected?: number;
  /** Number of examples reused. */
  readonly examplesReused?: number;
  /** Number of examples proposed. */
  readonly examplesProposed?: number;
  /** Documentation gaps resolved. */
  readonly gapsResolved?: number;
  /** Remaining documentation gaps. */
  readonly gapsRemaining?: number;
}
