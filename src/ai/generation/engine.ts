/**
 * AI Documentation Generation.
 *
 * Orchestrates the generation of documentation content through the AI
 * provider layer. Converts structured plans and context into generated
 * pages, diagrams, and recommendations.
 */

import type { AIProvider } from "../provider.js";
import type {
  AIDocumentationRequest,
  AIDocumentationResult,
  AIContextBundle,
  AIGeneratedPage,
  AIDocumentationVoice,
  AITerminologyEntry,
} from "../types.js";
import type { DocPlanPage } from "../planning/plan.js";

/** Configuration for the generation engine. */
export interface AIGenerationConfig {
  /** Default voice for generated content. */
  readonly voice?: AIDocumentationVoice;
  /** Default terminology dictionary. */
  readonly terminology?: readonly AITerminologyEntry[];
  /** Default output format. */
  readonly format?: "markdown" | "mdx";
  /** Maximum pages to generate in a single batch. */
  readonly batchSize?: number;
  /** Whether to include claims in the output. */
  readonly includeClaims?: boolean;
}

/**
 * Generate documentation for a single planned page.
 */
export async function generatePage(
  provider: AIProvider,
  page: DocPlanPage,
  context: AIContextBundle,
  config: AIGenerationConfig = {},
): Promise<AIGeneratedPage> {
  const request: AIDocumentationRequest = {
    intent: page.intent,
    audience: page.audience,
    topic: page.title,
    context,
    voice: config.voice,
    terminology: config.terminology,
    relatedPages: page.relatedPages,
    format: config.format ?? "markdown",
  };

  const result = await provider.generate(request);
  const generatedPage = result.pages[0];

  if (generatedPage === undefined) {
    // Fallback: generate a minimal placeholder
    return {
      slug: page.slug,
      title: page.title,
      content: `# ${page.title}\n\nDocumentation for ${page.title} is pending.`,
      intent: page.intent,
      audience: page.audience,
      language: "en",
      format: config.format ?? "markdown",
      claims: [],
      evidence: [],
    };
  }

  return generatedPage;
}

/**
 * Generate documentation for a batch of planned pages.
 */
export async function generateBatch(
  provider: AIProvider,
  pages: readonly DocPlanPage[],
  context: AIContextBundle,
  config: AIGenerationConfig = {},
): Promise<readonly AIGeneratedPage[]> {
  const batchSize = config.batchSize ?? 5;
  const results: AIGeneratedPage[] = [];

  for (let i = 0; i < pages.length; i += batchSize) {
    const batch = pages.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((page) => generatePage(provider, page, context, config)),
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Generate a single documentation page from a direct request.
 */
export async function generateDirect(
  provider: AIProvider,
  request: AIDocumentationRequest,
): Promise<AIDocumentationResult> {
  return provider.generate(request);
}

/**
 * Update existing documentation based on changes.
 */
export async function updateDocumentation(
  provider: AIProvider,
  changedFiles: readonly string[],
  existingPages: readonly AIGeneratedPage[],
  context: AIContextBundle,
  config: AIGenerationConfig = {},
): Promise<{
  updated: readonly AIGeneratedPage[];
  unchanged: readonly string[];
  removed: readonly string[];
}> {
  const result = await provider.update({
    changedFiles,
    existingPages,
    context,
    voice: config.voice,
    terminology: config.terminology,
  });

  return {
    updated: result.updated,
    unchanged: result.unchanged,
    removed: result.removed ?? [],
  };
}

/**
 * Build a context bundle for a specific page from the full context.
 * Selects only the relevant portion of the context for the given intent.
 */
export function buildPageContext(fullContext: AIContextBundle, page: DocPlanPage): AIContextBundle {
  // For API reference pages, include full API context
  if (page.intent === "api-reference") {
    return {
      ...fullContext,
      api: fullContext.api,
      examples: fullContext.examples?.filter(
        (e) => page.apis === undefined || page.apis.some((api) => e.apis?.includes(api)),
      ),
    };
  }

  // For concept pages, include relevant concepts
  if (page.intent === "concept") {
    return {
      ...fullContext,
      concepts: fullContext.concepts?.filter(
        (c) => page.concepts === undefined || page.concepts.includes(c.name),
      ),
    };
  }

  // For guide/tutorial pages, include workflows
  if (page.intent === "guide" || page.intent === "tutorial") {
    return {
      ...fullContext,
      workflows: fullContext.workflows,
      examples: fullContext.examples?.slice(0, 10),
    };
  }

  // Default: include everything (trimmed by token budget)
  return fullContext;
}
