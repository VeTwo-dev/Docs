/**
 * Universal example taxonomy.
 *
 * Every example is classified into one {@link ExampleType} and carries
 * provenance (where it came from) plus audience-facing flags. The taxonomy
 * distinguishes production usage from test-only and internal usage so the
 * future AI documentation engine never mistakes a fixture for user-facing
 * documentation evidence.
 */

/** The kinds of examples the engine can classify. */
export const EXAMPLE_TYPES = [
  "production",
  "test",
  "demo",
  "fixture",
  "benchmark",
  "configuration",
  "cli",
  "snippet",
  "reference",
  "internal",
] as const;

/** The type of an extracted example. */
export type ExampleType = (typeof EXAMPLE_TYPES)[number];

/** Whether `type` is a known example type. */
export function isExampleType(type: string): type is ExampleType {
  return (EXAMPLE_TYPES as readonly string[]).includes(type);
}

/**
 * The provenance of an example — where in the project the evidence was
 * found. Provenance is explicit and never inferred silently.
 */
export const EXAMPLE_PROVENANCE_KINDS = [
  "readme",
  "docs",
  "tests",
  "examples",
  "playground",
  "storybook",
  "source",
  "configuration",
  "cli",
  "fixtures",
  "benchmarks",
] as const;

/** The kind of an {@link import("./provenance.js").ExampleProvenance}. */
export type ExampleProvenanceKind = (typeof EXAMPLE_PROVENANCE_KINDS)[number];

/** Whether `kind` is a known provenance kind. */
export function isExampleProvenanceKind(kind: string): kind is ExampleProvenanceKind {
  return (EXAMPLE_PROVENANCE_KINDS as readonly string[]).includes(kind);
}

/** The validation state of an example. */
export const EXAMPLE_VALIDATION_STATUSES = ["valid", "invalid", "unverified", "stale"] as const;

/** The status of an example after validation. */
export type ExampleValidationStatus = (typeof EXAMPLE_VALIDATION_STATUSES)[number];

/** The audience-facing classification flags of an example. */
export interface ExampleClassificationFlags {
  /** Suitable for end-user documentation. */
  readonly userFacing: boolean;
  /** Mirrors realistic production usage (not mocked). */
  readonly productionLike: boolean;
  /** Only meaningful inside the project (tests, internals). */
  readonly internalOnly: boolean;
}
