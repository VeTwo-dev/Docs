import type { RelationshipKind } from "./kind.js";
import { stableId } from "../../examples/shared/index.js";

/** Severity of a documentation recommendation. */
export type RecommendationSeverity = "high" | "medium" | "low";

/** A recommendation to improve the documentation set. */
export interface DocumentationRecommendation {
  /** Stable recommendation id. */
  readonly id: string;
  /** The page the recommendation concerns. */
  readonly page: string;
  /** What to do. */
  readonly action: string;
  /** Why (structured evidence). */
  readonly evidence: readonly string[];
  /** Suggested relationship kind to add. */
  readonly suggestionKind?: RelationshipKind;
  /** Recommended target page, when known. */
  readonly suggestedTarget?: string;
  /** Severity. */
  readonly severity: RecommendationSeverity;
  /** Confidence (0..1). */
  readonly confidence: number;
}

/** Input required to build a {@link DocumentationRecommendation}. */
export interface DocumentationRecommendationInput {
  readonly page: string;
  readonly action: string;
  readonly evidence?: readonly string[];
  readonly suggestionKind?: RelationshipKind;
  readonly suggestedTarget?: string;
  readonly severity?: RecommendationSeverity;
  readonly confidence?: number;
}

/** Builds an immutable {@link DocumentationRecommendation}. */
export function createDocumentationRecommendation(
  input: DocumentationRecommendationInput,
): DocumentationRecommendation {
  return Object.freeze({
    id: stableId(
      "recommendation",
      input.page,
      input.suggestionKind ?? "none",
      input.suggestedTarget ?? "none",
      input.action,
    ),
    page: input.page,
    action: input.action,
    evidence: Object.freeze([...(input.evidence ?? [])]),
    ...(input.suggestionKind !== undefined ? { suggestionKind: input.suggestionKind } : {}),
    ...(input.suggestedTarget !== undefined ? { suggestedTarget: input.suggestedTarget } : {}),
    severity: input.severity ?? "medium",
    confidence: clampUnit(input.confidence ?? 0.6),
  });
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}
