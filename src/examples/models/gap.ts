import type { ExampleType } from "./type.js";
import { stableId } from "../shared/hash.js";

/**
 * A documentation gap: an important concept or API that has no suitable
 * example. Gaps are recommendations — the engine never writes the missing
 * content, it only records the need.
 */
export interface ExampleGap {
  /** Stable gap id. */
  readonly id: string;
  /** The symbol id or name the gap concerns. */
  readonly relatedNodeId: string;
  /** The documentation page slug the gap relates to, when known. */
  readonly documentationPage?: string;
  /** Importance of filling the gap (0..1). */
  readonly importance: number;
  /** The example type that is missing. */
  readonly missingExampleType: ExampleType;
  /** Recommended complexity: "minimal" | "basic" | "advanced". */
  readonly recommendedComplexity: "minimal" | "basic" | "advanced";
  /** Why the gap exists (structured evidence). */
  readonly evidence: readonly string[];
  /** Confidence that the gap is real (0..1). */
  readonly confidence: number;
}

/** Input required to build an {@link ExampleGap}. */
export interface ExampleGapInput {
  readonly relatedNodeId: string;
  readonly documentationPage?: string;
  readonly importance?: number;
  readonly missingExampleType?: ExampleType;
  readonly recommendedComplexity?: ExampleGap["recommendedComplexity"];
  readonly evidence?: readonly string[];
  readonly confidence?: number;
}

/** Builds an immutable {@link ExampleGap}. */
export function createExampleGap(input: ExampleGapInput): ExampleGap {
  return Object.freeze({
    id: stableId("gap", input.relatedNodeId, input.missingExampleType ?? "production"),
    relatedNodeId: input.relatedNodeId,
    ...(input.documentationPage !== undefined
      ? { documentationPage: input.documentationPage }
      : {}),
    importance: clampUnit(input.importance ?? 0.5),
    missingExampleType: input.missingExampleType ?? "production",
    recommendedComplexity: input.recommendedComplexity ?? "basic",
    evidence: Object.freeze([...(input.evidence ?? [])]),
    confidence: clampUnit(input.confidence ?? 0.5),
  });
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}
