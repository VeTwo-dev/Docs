import type { PageDescriptor } from "../resolvers/index.js";
import type {
  LearningAudience,
  LearningPath,
  LearningPathStep,
  ReaderStage,
} from "../models/index.js";
import { createLearningPath, READER_STAGES, isLearningAudience } from "../models/index.js";

/** Options for learning-path planning. */
export interface LearningPathOptions {
  /** Only plan paths for these audiences. */
  readonly audiences?: readonly LearningAudience[];
}

/**
 * Plans an ordered learning path for each audience represented in the page
 * set. Steps are ordered by reader progression stage, then by page slug.
 * The plan is deterministic and evidence-backed (each step records the
 * page's stage and audience).
 */
export function planLearningPaths(
  pages: readonly PageDescriptor[],
  options: LearningPathOptions = {},
): readonly LearningPath[] {
  const audiences = options.audiences ?? audiencesPresent(pages);
  const paths: LearningPath[] = [];

  for (const audience of audiences) {
    const steps = pages
      .filter((page) => page.audience === audience)
      .map((page, index) => stepFor(page, index))
      .sort((a, b) => {
        const stageDiff = stageIndex(a.stage) - stageIndex(b.stage);
        if (stageDiff !== 0) return stageDiff;
        return a.page.localeCompare(b.page);
      })
      .map((step, index) => ({ ...step, position: index + 1 }));

    if (steps.length === 0) continue;
    paths.push(
      createLearningPath({
        title: `${audience} learning path`,
        audience,
        steps: Object.freeze(steps),
        evidence: steps.map(
          (step) => `page "${step.page}" serves ${audience} at stage "${step.stage}"`,
        ),
        confidence: Math.min(1, 0.5 + steps.length * 0.05),
      }),
    );
  }

  return Object.freeze(paths);
}

function stepFor(page: PageDescriptor, index: number): LearningPathStep {
  return {
    page: page.slug,
    stage: page.stage ?? "reference",
    label: page.title,
    position: index + 1,
  };
}

function audiencesPresent(pages: readonly PageDescriptor[]): readonly LearningAudience[] {
  const seen = new Set<LearningAudience>();
  for (const page of pages) {
    if (page.audience !== undefined && isLearningAudience(page.audience)) seen.add(page.audience);
  }
  return Object.freeze([...seen]);
}

function stageIndex(stage: ReaderStage): number {
  return READER_STAGES.indexOf(stage);
}
