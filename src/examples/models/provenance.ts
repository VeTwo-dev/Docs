import type { ExampleProvenanceKind } from "./type.js";

/** A location range within a file (1-indexed, inclusive). */
export interface ExampleLocation {
  readonly startLine: number;
  readonly endLine: number;
}

/** The provenance of an example — where the evidence came from. */
export interface ExampleProvenance {
  /** The kind of source (readme, docs, tests, ...). */
  readonly kind: ExampleProvenanceKind;
  /** The file the example was found in (project-relative path). */
  readonly source: string;
  /** The nearest documentation context (heading/section title), when known. */
  readonly context?: string;
  /** Line range within the source file, when known. */
  readonly location?: ExampleLocation;
}

/** Input required to build an {@link ExampleProvenance}. */
export interface ExampleProvenanceInput {
  readonly kind: ExampleProvenanceKind;
  readonly source: string;
  readonly context?: string;
  readonly location?: ExampleLocation;
}

/** Builds an immutable {@link ExampleProvenance}. */
export function createExampleProvenance(input: ExampleProvenanceInput): ExampleProvenance {
  return Object.freeze({
    kind: input.kind,
    source: input.source,
    ...(input.context !== undefined ? { context: input.context } : {}),
    ...(input.location !== undefined ? { location: Object.freeze({ ...input.location }) } : {}),
  });
}
