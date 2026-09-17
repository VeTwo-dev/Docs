/**
 * Relationship kinds between documentation pages.
 *
 * These are the document-level relationships derived by the relationship
 * engine. Each relationship is evidence-backed — resolvers record why it
 * exists (shared symbol, dependency, configuration reference, etc.).
 */
export const RELATIONSHIP_KINDS = [
  "prerequisite",
  "nextStep",
  "previousStep",
  "relatedTo",
  "explains",
  "exampleOf",
  "referenceFor",
  "configuredBy",
  "uses",
  "usedBy",
  "implements",
  "extends",
  "complements",
  "alternativeTo",
  "migrationFrom",
  "migrationTo",
  "troubleshoots",
  "causedBy",
  "fixes",
  "belongsTo",
  "partOf",
  "deepens",
  "summarizes",
] as const;

/** The union of all relationship kinds. */
export type RelationshipKind = (typeof RELATIONSHIP_KINDS)[number];

/** Marker used when a relationship would form a cycle. */
export const RELATIONSHIP_CYCLE = "cycle" as const;

/** Whether a string is a valid relationship kind. */
export function isRelationshipKind(value: string): value is RelationshipKind {
  return (RELATIONSHIP_KINDS as readonly string[]).includes(value);
}

/** Inverse-direction relationship kinds (used to mirror edges). */
const INVERSE_KINDS: Partial<Record<RelationshipKind, RelationshipKind>> = {
  prerequisite: "nextStep",
  nextStep: "previousStep",
  previousStep: "nextStep",
  exampleOf: "referenceFor",
  referenceFor: "exampleOf",
  configuredBy: "uses",
  uses: "usedBy",
  usedBy: "uses",
  explains: "deepens",
  deepens: "explains",
  migrationFrom: "migrationTo",
  migrationTo: "migrationFrom",
  causedBy: "fixes",
  fixes: "causedBy",
  partOf: "belongsTo",
  belongsTo: "partOf",
  summarizes: "deepens",
};

/** The inverse of a relationship kind, when defined. */
export function inverseRelationshipKind(kind: RelationshipKind): RelationshipKind | undefined {
  return INVERSE_KINDS[kind];
}

/** Whether a relationship kind is directional (has an inverse). */
export function isDirectionalRelationshipKind(kind: RelationshipKind): boolean {
  return inverseRelationshipKind(kind) !== undefined;
}
