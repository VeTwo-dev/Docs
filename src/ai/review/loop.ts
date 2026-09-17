/**
 * AI Review Loop.
 *
 * Orchestrates the generate → validate → evaluate → revise cycle.
 * Limits revision loops to prevent infinite AI regeneration.
 */

import type { AIProvider } from "../provider.js";
import type { AIGeneratedPage, AIContextBundle } from "../types.js";
import type { DocPlanPage } from "../planning/plan.js";
import type { QualityEvaluation, QualityEvaluationConfig } from "../evaluation/evaluator.js";
import { evaluatePage } from "../evaluation/evaluator.js";
import { generatePage } from "../generation/engine.js";
import type { AIGenerationConfig } from "../generation/engine.js";

/** Configuration for the review loop. */
export interface AIReviewLoopConfig {
  /** Maximum number of revision iterations. */
  readonly maxRevisions?: number;
  /** Quality score threshold to accept a page. */
  readonly acceptThreshold?: number;
  /** Quality evaluation config. */
  readonly evaluation?: QualityEvaluationConfig;
  /** Generation config. */
  readonly generation?: AIGenerationConfig;
}

/** Result of the review loop for a single page. */
export interface AIReviewResult {
  /** The final page content. */
  readonly page: AIGeneratedPage;
  /** Number of iterations performed. */
  readonly iterations: number;
  /** Whether the page was accepted. */
  readonly accepted: boolean;
  /** Quality evaluations from each iteration. */
  readonly evaluations: readonly QualityEvaluation[];
  /** Revision notes from each iteration. */
  readonly revisionNotes: readonly string[];
}

const DEFAULT_MAX_REVISIONS = 3;
const DEFAULT_ACCEPT_THRESHOLD = 0.7;

/**
 * Run the review loop for a single page.
 *
 *   generate → validate → evaluate → [revise | accept]
 */
export async function reviewPage(
  provider: AIProvider,
  page: DocPlanPage,
  context: AIContextBundle,
  config: AIReviewLoopConfig = {},
): Promise<AIReviewResult> {
  const maxRevisions = config.maxRevisions ?? DEFAULT_MAX_REVISIONS;
  const acceptThreshold = config.acceptThreshold ?? DEFAULT_ACCEPT_THRESHOLD;
  const evaluations: QualityEvaluation[] = [];
  const revisionNotes: string[] = [];

  // Step 1: Generate
  let current = await generatePage(provider, page, context, config.generation);

  for (let iteration = 0; iteration <= maxRevisions; iteration++) {
    // Step 2: Evaluate
    const evaluation = evaluatePage(current, config.evaluation);
    evaluations.push(evaluation);

    // Step 3: Accept or revise
    if (evaluation.score >= acceptThreshold || iteration === maxRevisions) {
      return {
        page: current,
        iterations: iteration,
        accepted: evaluation.score >= acceptThreshold,
        evaluations,
        revisionNotes,
      };
    }

    // Step 4: Revise — generate again with feedback
    revisionNotes.push(
      `Iteration ${iteration + 1}: score ${evaluation.score.toFixed(2)} below threshold ${acceptThreshold}. Issues: ${evaluation.issues.map((i) => i.message).join("; ")}`,
    );

    // Re-generate with the same context (the provider should produce different content)
    current = await generatePage(provider, page, context, config.generation);
  }

  // Should not reach here, but just in case
  return {
    page: current,
    iterations: maxRevisions,
    accepted: false,
    evaluations,
    revisionNotes,
  };
}

/**
 * Run the review loop for a batch of pages.
 */
export async function reviewBatch(
  provider: AIProvider,
  pages: readonly DocPlanPage[],
  context: AIContextBundle,
  config: AIReviewLoopConfig = {},
): Promise<readonly AIReviewResult[]> {
  return Promise.all(pages.map((page) => reviewPage(provider, page, context, config)));
}

/**
 * Summarize review results.
 */
export function summarizeReview(results: readonly AIReviewResult[]): {
  total: number;
  accepted: number;
  rejected: number;
  averageIterations: number;
  averageScore: number;
} {
  const total = results.length;
  const accepted = results.filter((r) => r.accepted).length;
  const averageIterations =
    total > 0 ? results.reduce((sum, r) => sum + r.iterations, 0) / total : 0;
  const averageScore =
    total > 0
      ? results.reduce((sum, r) => {
          const lastEval = r.evaluations[r.evaluations.length - 1];
          return sum + (lastEval?.score ?? 0);
        }, 0) / total
      : 0;

  return {
    total,
    accepted,
    rejected: total - accepted,
    averageIterations,
    averageScore,
  };
}
