/**
 * AI Context Builder.
 *
 * Assembles structured context for AI documentation generation. The builder
 * selects only relevant information from the project intelligence pipeline,
 * respecting a token budget and prioritization rules.
 *
 * The context builder never dumps the entire repository into the model.
 * It uses the existing intelligence layers as the source of truth.
 */

import type {
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
  AIDocumentationIntent,
} from "../types.js";

/** Input data for the context builder. */
export interface AIContextBuilderInput {
  /** Project root directory. */
  readonly rootDir: string;
  /** Project metadata. */
  readonly project?: {
    readonly name?: string;
    readonly description?: string;
    readonly version?: string;
    readonly type?: string;
    readonly language?: string;
    readonly framework?: string;
    readonly packageManager?: string;
    readonly dependencies?: readonly string[];
  };
  /** Knowledge graph nodes and edges. */
  readonly knowledgeGraph?: {
    readonly nodes?: readonly { id: string; kind: string; label: string }[];
    readonly edges?: readonly { from: string; to: string; kind: string }[];
  };
  /** API surface from the symbol extraction engine. */
  readonly api?: {
    readonly exports?: readonly {
      readonly name: string;
      readonly kind: string;
      readonly signature?: string;
      readonly description?: string;
      readonly parameters?: readonly { name: string; type: string; description?: string }[];
      readonly returnType?: string;
      readonly sourceFile?: string;
    }[];
  };
  /** Extracted examples. */
  readonly examples?: readonly {
    readonly title: string;
    readonly code: string;
    readonly language: string;
    readonly source: "project" | "test" | "documentation" | "generated";
    readonly description?: string;
    readonly apis?: readonly string[];
    readonly provenance?: string;
    readonly confidence?: number;
  }[];
  /** Documentation relationships. */
  readonly relationships?: readonly {
    readonly from: string;
    readonly to: string;
    readonly kind: string;
    readonly description?: string;
  }[];
  /** Documentation gaps identified. */
  readonly gaps?: readonly {
    readonly kind: string;
    readonly target: string;
    readonly priority: string;
    readonly description?: string;
  }[];
  /** Learning paths. */
  readonly learningPaths?: readonly {
    readonly name: string;
    readonly steps: readonly string[];
  }[];
  /** Existing documentation. */
  readonly existingDocs?: readonly {
    readonly slug: string;
    readonly title: string;
    readonly content?: string;
  }[];
  /** Framework intelligence. */
  readonly framework?: {
    readonly name?: string;
    readonly conventions?: readonly string[];
    readonly patterns?: readonly string[];
    readonly configKeys?: readonly string[];
  };
}

/** Configuration for context building. */
export interface AIContextBuilderConfig {
  /** Maximum estimated tokens for the context bundle. */
  readonly maxTokens?: number;
  /** Intent of the documentation being generated (drives selection). */
  readonly intent?: AIDocumentationIntent;
  /** Target audience. */
  readonly audience?: string;
  /** Which context packs to include. */
  readonly includePacks?: readonly string[];
  /** Which context packs to exclude. */
  readonly excludePacks?: readonly string[];
}

const DEFAULT_MAX_TOKENS = 8000;

/**
 * Build a context bundle from project intelligence data.
 *
 * Selects and prioritizes information relevant to the requested intent,
 * respecting the token budget.
 */
export function buildAIContext(
  input: AIContextBuilderInput,
  config: AIContextBuilderConfig = {},
): AIContextBundle {
  const maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
  const intent = config.intent;

  const project = buildProjectContext(input);
  const architecture = buildArchitectureContext(input, intent);
  const api = buildAPIContext(input, intent);
  const concepts = buildConceptContexts(input, intent);
  const examples = buildExampleContexts(input, intent);
  const workflows = buildWorkflowContexts(input, intent);
  const configuration = buildConfigurationContext(input, intent);
  const troubleshooting = buildTroubleshootingContext(input);
  const existingDocumentation = buildExistingDocContext(input);

  // Estimate tokens (rough: 1 token ≈ 4 chars)
  const estimatedTokens = estimateTokens({
    project,
    architecture,
    api,
    concepts,
    examples,
    workflows,
    configuration,
    troubleshooting,
    existingDocumentation,
  });

  return {
    project,
    architecture,
    api,
    concepts,
    examples,
    workflows,
    configuration,
    troubleshooting,
    existingDocumentation,
    estimatedTokens: Math.min(estimatedTokens, maxTokens),
  };
}

// ─── Context Pack Builders ───────────────────────────────────────────────

function buildProjectContext(input: AIContextBuilderInput): AIProjectContext | undefined {
  if (input.project === undefined) return undefined;
  return {
    name: input.project.name ?? "unknown",
    description: input.project.description,
    version: input.project.version,
    type: input.project.type,
    language: input.project.language,
    framework: input.project.framework,
    packageManager: input.project.packageManager,
    dependencies: input.project.dependencies,
  };
}

function buildArchitectureContext(
  input: AIContextBuilderInput,
  intent?: AIDocumentationIntent,
): AIArchitectureContext | undefined {
  const graph = input.knowledgeGraph;
  if (graph === undefined) return undefined;

  const includeArchitecture =
    intent === "architecture" || intent === "overview" || intent === undefined;

  return {
    subsystems: includeArchitecture ? extractSubsystems(graph) : undefined,
    entryPoints: extractEntryPoints(graph),
    moduleGraph: graph.edges?.slice(0, 50).map((e) => ({
      from: e.from,
      to: e.to,
      kind: e.kind,
    })),
    extensionPoints: extractExtensionPoints(graph),
    keyPatterns: input.framework?.patterns,
  };
}

function buildAPIContext(
  input: AIContextBuilderInput,
  intent?: AIDocumentationIntent,
): AIAPIContext | undefined {
  if (input.api?.exports === undefined) return undefined;

  const includeFullApi = intent === "api-reference" || intent === "overview";
  const exports = includeFullApi ? input.api.exports : input.api.exports.slice(0, 20); // Limit for non-API intents

  return {
    publicSymbols: exports.map((e) => ({
      name: e.name,
      kind: e.kind,
      signature: e.signature,
      description: e.description,
      parameters: e.parameters,
      returnType: e.returnType,
      sourceFile: e.sourceFile,
    })),
    exports: exports.map((e) => e.name),
  };
}

function buildConceptContexts(
  input: AIContextBuilderInput,
  intent?: AIDocumentationIntent,
): AIConceptContext[] {
  if (input.knowledgeGraph === undefined) return [];
  const graph = input.knowledgeGraph;
  const allNodes = graph.nodes;
  if (allNodes === undefined) return [];

  const includeConcepts =
    intent === "concept" || intent === "overview" || intent === "getting-started";

  // Extract concept-like nodes from the knowledge graph
  const conceptKinds = new Set(["module", "class", "interface", "type", "namespace"]);
  const nodes = allNodes.filter((n) => conceptKinds.has(n.kind) || includeConcepts);

  return nodes.slice(0, 30).map((n) => ({
    name: n.label,
    description: `The ${n.label} ${n.kind}.`,
    relatedApis: findRelatedNodes(graph, n.id).map((r) => r.label),
    evidence: [{ kind: "graph", value: n.id, confidence: "verified" as const }],
  }));
}

function buildExampleContexts(
  input: AIContextBuilderInput,
  intent?: AIDocumentationIntent,
): AIExampleContext[] {
  if (input.examples === undefined) return [];

  const includeExamples =
    intent === "example" ||
    intent === "guide" ||
    intent === "tutorial" ||
    intent === "getting-started";

  const sorted = [...input.examples].sort((a, b) => {
    // Priority: project > test > documentation > generated
    const priority: Record<string, number> = {
      project: 0,
      test: 1,
      documentation: 2,
      generated: 3,
    };
    return (priority[a.source] ?? 4) - (priority[b.source] ?? 4);
  });

  return sorted.slice(0, includeExamples ? 20 : 5).map((e) => ({
    title: e.title,
    code: e.code,
    language: e.language,
    source: e.source,
    description: e.description,
    apis: e.apis,
    provenance: e.provenance,
    confidence: e.confidence ?? (e.source === "project" ? 0.9 : e.source === "test" ? 0.7 : 0.5),
  }));
}

function buildWorkflowContexts(
  input: AIContextBuilderInput,
  intent?: AIDocumentationIntent,
): AIWorkflowContext[] {
  if (input.learningPaths === undefined) return [];

  const includeWorkflows =
    intent === "guide" || intent === "tutorial" || intent === "getting-started";

  return input.learningPaths.slice(0, includeWorkflows ? 10 : 3).map((lp) => ({
    name: lp.name,
    description: `Steps for ${lp.name}.`,
    steps: lp.steps,
  }));
}

function buildConfigurationContext(
  input: AIContextBuilderInput,
  intent?: AIDocumentationIntent,
): AIConfigurationContext | undefined {
  if (input.framework?.configKeys === undefined && input.gaps === undefined) return undefined;

  const includeConfig = intent === "configuration" || intent === "getting-started";

  return {
    keys: input.framework?.configKeys?.slice(0, includeConfig ? 50 : 10).map((k) => ({
      name: k,
      type: "unknown",
    })),
  };
}

function buildTroubleshootingContext(
  input: AIContextBuilderInput,
): AITroubleshootingContext | undefined {
  if (input.gaps === undefined || input.gaps.length === 0) return undefined;
  return {
    commonErrors: input.gaps
      .filter((g) => g.kind === "troubleshooting")
      .slice(0, 10)
      .map((g) => ({
        error: g.target,
        cause: g.description,
      })),
  };
}

function buildExistingDocContext(input: AIContextBuilderInput): AIExistingDoc[] | undefined {
  if (input.existingDocs === undefined || input.existingDocs.length === 0) return undefined;
  return input.existingDocs.map((d) => ({
    slug: d.slug,
    title: d.title,
    content: d.content,
    language: "en",
  }));
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function extractSubsystems(graph: {
  nodes?: readonly { id: string; kind: string; label: string }[];
}): string[] {
  if (graph.nodes === undefined) return [];
  const moduleKinds = new Set(["module", "namespace", "package"]);
  return graph.nodes
    .filter((n) => moduleKinds.has(n.kind))
    .map((n) => n.label)
    .slice(0, 20);
}

function extractEntryPoints(graph: {
  nodes?: readonly { id: string; kind: string; label: string }[];
}): string[] {
  if (graph.nodes === undefined) return [];
  return graph.nodes
    .filter((n) => n.kind === "entry" || n.kind === "main" || n.label === "index")
    .map((n) => n.label);
}

function extractExtensionPoints(graph: {
  edges?: readonly { from: string; to: string; kind: string }[];
}): string[] {
  if (graph.edges === undefined) return [];
  const pluginKinds = new Set(["plugin", "extension", "hook", "middleware"]);
  return graph.edges
    .filter((e) => pluginKinds.has(e.kind))
    .map((e) => e.to)
    .slice(0, 10);
}

function findRelatedNodes(
  graph: {
    edges?: readonly { from: string; to: string; kind: string }[];
    nodes?: readonly { id: string; label: string }[];
  },
  nodeId: string,
): readonly { id: string; label: string }[] {
  if (graph.nodes === undefined || graph.edges === undefined) return [];
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const related = new Set<string>();
  for (const e of graph.edges) {
    if (e.from === nodeId) related.add(e.to);
    if (e.to === nodeId) related.add(e.from);
  }
  return [...related]
    .map((id) => nodeMap.get(id))
    .filter((n): n is { id: string; label: string } => n !== undefined)
    .slice(0, 10);
}

function estimateTokens(bundle: AIContextBundle): number {
  const serialize = JSON.stringify(bundle);
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(serialize.length / 4);
}

/**
 * Select only the context packs relevant to the given intent.
 */
export function selectContextPacksForIntent(intent: AIDocumentationIntent): string[] {
  const common = ["project"];
  switch (intent) {
    case "overview":
      return [...common, "architecture", "api", "concepts"];
    case "getting-started":
      return [...common, "api", "examples", "workflows", "configuration"];
    case "concept":
      return [...common, "concepts", "api", "examples"];
    case "guide":
      return [...common, "workflows", "api", "examples"];
    case "tutorial":
      return [...common, "workflows", "examples", "api"];
    case "api-reference":
      return [...common, "api", "concepts"];
    case "configuration":
      return [...common, "configuration"];
    case "architecture":
      return [...common, "architecture", "concepts"];
    case "example":
      return [...common, "examples", "api"];
    case "troubleshooting":
      return [...common, "troubleshooting", "configuration"];
    case "migration":
      return [...common, "api", "configuration"];
    case "faq":
      return [...common, "concepts", "configuration", "troubleshooting"];
    default:
      return common;
  }
}
