import type { Example } from "../models/index.js";
import type { ExampleProvenanceKind } from "../models/index.js";
import { isExampleType } from "../models/index.js";

/** A single explainable scoring factor. */
export interface ScoreFactor {
  readonly name: string;
  /** How much this factor contributed (0..1). */
  readonly value: number;
  /** Relative weight applied (0..1). */
  readonly weight: number;
  readonly reason: string;
}

/** The explainable score for an example. */
export interface ExampleScore {
  /** Weighted total in 0..1. */
  readonly importance: number;
  /** Extraction confidence in 0..1. */
  readonly confidence: number;
  readonly factors: readonly ScoreFactor[];
  /** Human-readable summary of why this score was assigned. */
  readonly explanation: string;
}

/** Provenance kinds weighted toward user-facing documentation. */
const USER_FACING_WEIGHT: Partial<Record<ExampleProvenanceKind, number>> = {
  readme: 1,
  docs: 1,
  examples: 0.9,
  source: 0.8,
  storybook: 0.7,
  playground: 0.6,
  configuration: 0.6,
  cli: 0.6,
  tests: 0.3,
  fixtures: 0.2,
};

/**
 * Scores an example's documentation importance. The score is fully
 * explainable: every contributing factor is recorded with its value, weight
 * and reason.
 */
export function scoreExample(example: Example): ExampleScore {
  const factors: ScoreFactor[] = [];
  const contribution = (factor: ScoreFactor): void => {
    factors.push(factor);
  };

  const provenanceValue = USER_FACING_WEIGHT[example.provenance.kind] ?? 0.4;
  contribution({
    name: "provenance",
    value: provenanceValue,
    weight: 0.3,
    reason: `provenance kind "${example.provenance.kind}"`,
  });

  const referenced = example.referencedSymbols.length + example.referencedPackages.length;
  const linkageValue = Math.min(1, referenced / 3);
  contribution({
    name: "linkage",
    value: linkageValue,
    weight: 0.25,
    reason: `${example.referencedSymbols.length} symbols, ${example.referencedPackages.length} packages referenced`,
  });

  const contentValue = Math.min(1, example.content.trim().length / 800);
  contribution({
    name: "completeness",
    value: contentValue,
    weight: 0.15,
    reason: `body length ${example.content.trim().length} chars`,
  });

  const descriptionValue = example.description !== undefined ? 1 : 0.3;
  contribution({
    name: "context",
    value: descriptionValue,
    weight: 0.1,
    reason: example.description !== undefined ? "has surrounding description" : "no description",
  });

  const typeValue = isExampleType(example.type) ? typeRelevance(example.type) : 0.5;
  contribution({
    name: "type",
    value: typeValue,
    weight: 0.1,
    reason: `type "${example.type}"`,
  });

  const validationValue =
    example.validation === "valid" ? 1 : example.validation === "stale" ? 0.2 : 0.6;
  contribution({
    name: "validation",
    value: validationValue,
    weight: 0.1,
    reason: `validation status "${example.validation}"`,
  });

  const weighted = factors.reduce((sum, factor) => sum + factor.value * factor.weight, 0);
  const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);
  const importance = clamp(totalWeight > 0 ? weighted / totalWeight : 0);
  const confidence = clamp(example.confidence * (0.6 + 0.4 * validationValue));

  return Object.freeze({
    importance,
    confidence: clamp(Math.round(confidence * 100) / 100),
    factors: Object.freeze(factors),
    explanation: factors.map((factor) => `${factor.name}: ${factor.reason}`).join("; "),
  });
}

/** How relevant an example type is to end-user documentation. */
function typeRelevance(type: string): number {
  switch (type) {
    case "example":
    case "demo":
      return 1;
    case "configuration":
    case "cli":
    case "snippet":
      return 0.9;
    case "reference":
      return 0.8;
    case "production":
      return 0.7;
    case "benchmark":
      return 0.5;
    case "test":
      return 0.4;
    case "fixture":
      return 0.3;
    case "internal":
      return 0.2;
    default:
      return 0.5;
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
