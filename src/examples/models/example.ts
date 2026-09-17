import type { ExampleType, ExampleValidationStatus, ExampleClassificationFlags } from "./type.js";
import type { ExampleProvenance, ExampleLocation } from "./provenance.js";
import { stableId } from "../shared/hash.js";

/**
 * The universal example model.
 *
 * Every example is evidence-backed: it records where it was found, what the
 * surrounding context was, and which symbols/packages/concepts it references.
 * Models are immutable and frozen.
 */
export interface Example {
  /** Stable id derived from provenance + content. */
  readonly id: string;
  /** A short human-readable title. */
  readonly title: string;
  /** The classified example type. */
  readonly type: ExampleType;
  /** Programming/markup language of the example body. */
  readonly language: string;
  /** Detected framework (react, next, cli, ...), when applicable. */
  readonly framework?: string;
  /** Where the example was found. */
  readonly provenance: ExampleProvenance;
  /** The normalized source text of the example. */
  readonly content: string;
  /** Description / nearby explanation, when available. */
  readonly description?: string;
  /** Symbol ids or names referenced by the example. */
  readonly referencedSymbols: readonly string[];
  /** Package names referenced by the example. */
  readonly referencedPackages: readonly string[];
  /** Configuration files or keys referenced by the example. */
  readonly referencedConfiguration: readonly string[];
  /** Concept ids referenced by the example. */
  readonly referencedConcepts: readonly string[];
  /** Workflow ids referenced by the example. */
  readonly referencedWorkflows: readonly string[];
  /** Confidence in the extraction (0..1). */
  readonly confidence: number;
  /** Importance for documentation purposes (0..1). */
  readonly importance: number;
  /** Validation status. */
  readonly validation: ExampleValidationStatus;
  /** Audience-facing classification flags. */
  readonly classification: ExampleClassificationFlags;
  /** Knowledge-graph node ids the example links to. */
  readonly linkedNodes: readonly string[];
  /** Documentation page slugs the example links to. */
  readonly linkedPages: readonly string[];
  /** Whether this example is a duplicate of another (see duplicates). */
  readonly duplicateOf?: string;
}

/** Input required to build an {@link Example}. */
export interface ExampleInput {
  readonly title: string;
  readonly type: ExampleType;
  readonly language: string;
  readonly framework?: string;
  readonly provenance: ExampleProvenance;
  readonly content: string;
  readonly description?: string;
  readonly referencedSymbols?: readonly string[];
  readonly referencedPackages?: readonly string[];
  readonly referencedConfiguration?: readonly string[];
  readonly referencedConcepts?: readonly string[];
  readonly referencedWorkflows?: readonly string[];
  readonly confidence?: number;
  readonly importance?: number;
  readonly validation?: ExampleValidationStatus;
  readonly classification?: ExampleClassificationFlags;
  readonly linkedNodes?: readonly string[];
  readonly linkedPages?: readonly string[];
  readonly duplicateOf?: string;
  /** Explicit id (rare); otherwise derived from provenance + content. */
  readonly id?: string;
}

/** Builds an immutable {@link Example}. */
export function createExample(input: ExampleInput): Example {
  const id =
    input.id ??
    stableId("example", input.provenance.source, input.provenance.kind, input.content.trim());
  const classification: ExampleClassificationFlags = input.classification ?? {
    userFacing: true,
    productionLike: false,
    internalOnly: false,
  };
  return Object.freeze({
    id,
    title: input.title,
    type: input.type,
    language: input.language,
    ...(input.framework !== undefined ? { framework: input.framework } : {}),
    provenance: input.provenance,
    content: input.content,
    ...(input.description !== undefined ? { description: input.description } : {}),
    referencedSymbols: Object.freeze([...(input.referencedSymbols ?? [])]),
    referencedPackages: Object.freeze([...(input.referencedPackages ?? [])]),
    referencedConfiguration: Object.freeze([...(input.referencedConfiguration ?? [])]),
    referencedConcepts: Object.freeze([...(input.referencedConcepts ?? [])]),
    referencedWorkflows: Object.freeze([...(input.referencedWorkflows ?? [])]),
    confidence: clampUnit(input.confidence ?? 0.5),
    importance: clampUnit(input.importance ?? 0.5),
    validation: input.validation ?? "unverified",
    classification: Object.freeze(classification),
    linkedNodes: Object.freeze([...(input.linkedNodes ?? [])]),
    linkedPages: Object.freeze([...(input.linkedPages ?? [])]),
    ...(input.duplicateOf !== undefined ? { duplicateOf: input.duplicateOf } : {}),
  });
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export type { ExampleLocation };
