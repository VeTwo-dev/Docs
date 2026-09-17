import type { RelationshipKind } from "./kind.js";
import { stableId } from "../../examples/shared/index.js";

/** A single derived relationship between two documentation pages. */
export interface DocumentationRelationship {
  /** Stable relationship id. */
  readonly id: string;
  /** The source page slug. */
  readonly from: string;
  /** The target page slug. */
  readonly to: string;
  /** The relationship kind. */
  readonly kind: RelationshipKind;
  /** Human-readable label. */
  readonly label: string;
  /** Why the relationship exists (structured evidence). */
  readonly evidence: readonly string[];
  /** Confidence in the relationship (0..1). */
  readonly confidence: number;
  /** Ranking weight (0..1), higher = more prominent. */
  readonly weight: number;
  /** Which resolver produced the relationship. */
  readonly source: string;
}

/** Input required to build a {@link DocumentationRelationship}. */
export interface DocumentationRelationshipInput {
  readonly from: string;
  readonly to: string;
  readonly kind: RelationshipKind;
  readonly label: string;
  readonly evidence?: readonly string[];
  readonly confidence?: number;
  readonly weight?: number;
  readonly source: string;
}

/** Builds an immutable {@link DocumentationRelationship}. */
export function createDocumentationRelationship(
  input: DocumentationRelationshipInput,
): DocumentationRelationship {
  return Object.freeze({
    id: stableId("rel", input.from, input.kind, input.to),
    from: input.from,
    to: input.to,
    kind: input.kind,
    label: input.label,
    evidence: Object.freeze([...(input.evidence ?? [])]),
    confidence: clampUnit(input.confidence ?? 0.7),
    weight: clampUnit(input.weight ?? 0.5),
    source: input.source,
  });
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}
