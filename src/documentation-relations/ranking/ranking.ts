import type { DocumentationRelationship } from "../models/index.js";

/** Rank relationships by prominence (weight then confidence). */
export function rankRelationships(
  relationships: readonly DocumentationRelationship[],
): readonly DocumentationRelationship[] {
  return Object.freeze(
    [...relationships].sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return a.label.localeCompare(b.label);
    }),
  );
}

/** Rank related pages for a given page, most prominent first. */
export function rankRelatedPages(
  relationships: readonly DocumentationRelationship[],
  page: string,
  excludeKinds?: readonly string[],
): readonly DocumentationRelationship[] {
  const relevant = relationships.filter((relationship) => {
    if (relationship.from !== page) return false;
    if (excludeKinds !== undefined && excludeKinds.includes(relationship.kind)) return false;
    return true;
  });
  return rankRelationships(relevant);
}
