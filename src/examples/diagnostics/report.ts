import type { Example } from "../models/index.js";
import type { DuplicateGroup, ExampleGap } from "../models/index.js";
import type { StaleFinding } from "./stale.js";

/** The complete diagnostic report for an example extraction run. */
export interface ExampleDiagnostics {
  /** Examples whose validation status is "invalid". */
  readonly invalidExamples: readonly Example[];
  /** Examples whose validation status is "stale". */
  readonly staleExamples: readonly Example[];
  /** Duplicate groups discovered. */
  readonly duplicateGroups: readonly DuplicateGroup[];
  /** Documentation gaps discovered. */
  readonly gaps: readonly ExampleGap[];
  /** Stale findings (evidence-backed). */
  readonly staleFindings: readonly StaleFinding[];
  /** Human-readable summary counts. */
  readonly summary: Readonly<{
    readonly total: number;
    readonly invalid: number;
    readonly stale: number;
    readonly duplicateGroups: number;
    readonly gaps: number;
  }>;
}

/** Build a diagnostic report from extraction results. */
export function buildExampleDiagnostics(input: {
  readonly examples: readonly Example[];
  readonly duplicateGroups?: readonly DuplicateGroup[];
  readonly gaps?: readonly ExampleGap[];
  readonly staleFindings?: readonly StaleFinding[];
}): ExampleDiagnostics {
  const examples = input.examples;
  const invalid = examples.filter((example) => example.validation === "invalid");
  const stale = examples.filter((example) => example.validation === "stale");
  const duplicateGroups = input.duplicateGroups ?? [];
  const gaps = input.gaps ?? [];
  const staleFindings = input.staleFindings ?? [];

  return Object.freeze({
    invalidExamples: Object.freeze([...invalid]),
    staleExamples: Object.freeze([...stale]),
    duplicateGroups: Object.freeze([...duplicateGroups]),
    gaps: Object.freeze([...gaps]),
    staleFindings: Object.freeze([...staleFindings]),
    summary: Object.freeze({
      total: examples.length,
      invalid: invalid.length,
      stale: stale.length,
      duplicateGroups: duplicateGroups.length,
      gaps: gaps.length,
    }),
  });
}
