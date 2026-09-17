import type { RelationshipType } from "../types/categories.js";

/** An immutable relationship between two indexed resources. */
export interface RelationshipModel {
  /** The type of relationship. */
  readonly type: RelationshipType;
  /** The source relative path. */
  readonly from: string;
  /** The target relative path. */
  readonly to: string;
  /** A human-readable label for the relationship. */
  readonly kind: string;
}

/** Input required to build a {@link RelationshipModel}. */
export interface RelationshipModelInput {
  readonly type: RelationshipType;
  readonly from: string;
  readonly to: string;
  readonly kind: string;
}

/** Builds an immutable, frozen {@link RelationshipModel}. */
export function createRelationship(input: RelationshipModelInput): RelationshipModel {
  return Object.freeze({
    type: input.type,
    from: input.from,
    to: input.to,
    kind: input.kind,
  });
}
