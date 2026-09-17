import { stableId } from "../../examples/shared/index.js";

/** The learning audiences documentation can target. */
export const LEARNING_AUDIENCES = [
  "Beginner",
  "Developer",
  "Advanced",
  "Maintainer",
  "API Consumer",
  "Plugin Author",
] as const;

/** The union of learning audiences. */
export type LearningAudience = (typeof LEARNING_AUDIENCES)[number];

/** Reader progression stages. */
export const READER_STAGES = [
  "discover",
  "understand",
  "install",
  "start",
  "learn",
  "apply",
  "reference",
  "troubleshoot",
  "extend",
  "maintain",
] as const;

/** The union of reader progression stages. */
export type ReaderStage = (typeof READER_STAGES)[number];

/** One step in a learning path. */
export interface LearningPathStep {
  /** The page slug. */
  readonly page: string;
  /** The reader stage this step serves. */
  readonly stage: ReaderStage;
  /** Human label for the step. */
  readonly label: string;
  /** 1-based position in the path. */
  readonly position: number;
}

/** An ordered, curated learning path across documentation pages. */
export interface LearningPath {
  /** Stable path id. */
  readonly id: string;
  /** Path name. */
  readonly title: string;
  /** The target audience. */
  readonly audience: LearningAudience;
  /** Ordered steps. */
  readonly steps: readonly LearningPathStep[];
  /** Why the path was created (evidence). */
  readonly evidence: readonly string[];
  /** Overall path confidence (0..1). */
  readonly confidence: number;
}

/** Input required to build a {@link LearningPath}. */
export interface LearningPathInput {
  readonly title: string;
  readonly audience: LearningAudience;
  readonly steps: readonly LearningPathStep[];
  readonly evidence?: readonly string[];
  readonly confidence?: number;
}

/** Builds an immutable {@link LearningPath}. */
export function createLearningPath(input: LearningPathInput): LearningPath {
  const steps = Object.freeze(
    input.steps.map((step, index) =>
      Object.freeze({
        ...step,
        position: step.position ?? index + 1,
      }),
    ),
  );
  return Object.freeze({
    id: stableId("path", input.audience, input.title, input.steps.map((s) => s.page).join(">")),
    title: input.title,
    audience: input.audience,
    steps,
    evidence: Object.freeze([...(input.evidence ?? [])]),
    confidence: clampUnit(input.confidence ?? 0.7),
  });
}

/** Whether a string is a valid learning audience. */
export function isLearningAudience(value: string): value is LearningAudience {
  return (LEARNING_AUDIENCES as readonly string[]).includes(value);
}

/** Whether a string is a valid reader stage. */
export function isReaderStage(value: string): value is ReaderStage {
  return (READER_STAGES as readonly string[]).includes(value);
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}
