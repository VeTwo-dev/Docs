import type { Example } from "../models/index.js";

/** Evidence about the current state of the project. */
export interface CurrentState {
  /** Project-relative paths that still exist. */
  readonly existingFiles: ReadonlySet<string>;
  /** Symbol ids or names that still exist. */
  readonly existingSymbols: ReadonlySet<string>;
}

/** A stale example finding. */
export interface StaleFinding {
  readonly exampleId: string;
  readonly status: "stale";
  readonly missingFile?: string;
  readonly missingSymbols: readonly string[];
  readonly evidence: readonly string[];
}

/**
 * Detects stale examples: examples whose source file or referenced symbols
 * no longer exist in the current project.
 *
 * Stale examples are never removed — they are reported with evidence so a
 * human or a later stage can decide what to do.
 */
export function detectStaleExamples(
  examples: readonly Example[],
  state: CurrentState,
): readonly StaleFinding[] {
  const findings: StaleFinding[] = [];
  for (const example of examples) {
    const missingSymbols = example.referencedSymbols.filter(
      (symbol) => !state.existingSymbols.has(symbol),
    );
    const sourceMissing = !state.existingFiles.has(example.provenance.source);
    if (!sourceMissing && missingSymbols.length === 0) continue;

    const finding: StaleFinding = {
      exampleId: example.id,
      status: "stale",
      ...(sourceMissing ? { missingFile: example.provenance.source } : {}),
      missingSymbols: Object.freeze(missingSymbols),
      evidence: Object.freeze([
        ...(sourceMissing ? [`source file "${example.provenance.source}" no longer exists`] : []),
        ...(missingSymbols.length > 0
          ? [`referenced symbols no longer exist: ${missingSymbols.join(", ")}`]
          : []),
      ]),
    };
    findings.push(finding);
  }
  return Object.freeze(findings);
}
