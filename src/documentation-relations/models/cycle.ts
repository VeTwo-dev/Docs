/** A cycle detected in the relationship graph. */
export interface RelationshipCycle {
  /** The relationship ids forming the cycle, in order. */
  readonly relationshipIds: readonly string[];
  /** Page slugs in the cycle, in order. */
  readonly pages: readonly string[];
  /** The cycle kind (e.g. "nextStep" circular navigation). */
  readonly kind: string;
  /** Severity hint: hard (blocking) or soft (informational). */
  readonly severity: "hard" | "soft";
}

/** Whether a cycle is hard (unidirectional) or soft (bidirectional). */
export function isHardCycle(cycle: RelationshipCycle): boolean {
  return cycle.severity === "hard";
}
