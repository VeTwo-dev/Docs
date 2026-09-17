import type { Example } from "../models/index.js";
import type { ExampleGap } from "../models/index.js";
import { createExampleGap } from "../models/index.js";

/** Evidence about important nodes that may need examples. */
export interface GapCandidate {
  /** Symbol id or name. */
  readonly id: string;
  /** Human label for the node. */
  readonly label: string;
  /** Whether the node is user-facing (exported/public). */
  readonly userFacing: boolean;
  /** Where the node lives (project-relative path). */
  readonly file?: string;
  /** How important the node is to users (0..1). */
  readonly importance?: number;
}

/** Options for gap detection. */
export interface GapDetectionOptions {
  /** Minimum importance for a candidate to produce a gap. */
  readonly minImportance?: number;
}

/**
 * Detects documentation gaps: important, user-facing nodes with no suitable
 * example. Gaps are recommendations — the engine records the need but never
 * writes the missing example.
 */
export function detectExampleGaps(
  examples: readonly Example[],
  candidates: readonly GapCandidate[],
  options: GapDetectionOptions = {},
): readonly ExampleGap[] {
  const minImportance = options.minImportance ?? 0.5;
  const gaps: ExampleGap[] = [];

  for (const candidate of candidates) {
    if (!candidate.userFacing) continue;
    const importance = candidate.importance ?? 0.5;
    if (importance < minImportance) continue;

    const covering = examples.filter((example) => example.referencedSymbols.includes(candidate.id));
    if (covering.length > 0) continue;

    const evidence: string[] = [
      `node "${candidate.label}" is user-facing`,
      `no example references symbol "${candidate.id}"`,
    ];
    if (candidate.file !== undefined) evidence.push(`defined in ${candidate.file}`);

    gaps.push(
      createExampleGap({
        relatedNodeId: candidate.id,
        importance,
        missingExampleType: "production",
        recommendedComplexity: importance > 0.75 ? "basic" : "minimal",
        evidence,
        confidence: Math.min(1, 0.5 + importance * 0.4),
      }),
    );
  }

  return Object.freeze(gaps);
}
