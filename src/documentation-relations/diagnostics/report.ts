import type { DocumentationRelationship } from "../models/index.js";
import type { RelationshipCycle } from "../models/index.js";
import type { RelationshipGapFinding } from "./gaps.js";

/** The complete diagnostic report for a relationship derivation run. */
export interface RelationshipDiagnostics {
  readonly cycles: readonly RelationshipCycle[];
  readonly gaps: readonly RelationshipGapFinding[];
  /** Hard cycles (blocking navigation). */
  readonly hardCycleCount: number;
  /** Pages with no relationships. */
  readonly orphanCount: number;
  readonly summary: Readonly<{
    readonly relationships: number;
    readonly cycles: number;
    readonly orphans: number;
  }>;
}

/** Build a diagnostic report. */
export function buildRelationshipDiagnostics(input: {
  readonly relationships: readonly DocumentationRelationship[];
  readonly cycles?: readonly RelationshipCycle[];
  readonly gaps?: readonly RelationshipGapFinding[];
}): RelationshipDiagnostics {
  const cycles = input.cycles ?? [];
  const gaps = input.gaps ?? [];
  return Object.freeze({
    cycles: Object.freeze([...cycles]),
    gaps: Object.freeze([...gaps]),
    hardCycleCount: cycles.filter((cycle) => cycle.severity === "hard").length,
    orphanCount: gaps.filter((gap) => gap.kind === "orphan").length,
    summary: Object.freeze({
      relationships: input.relationships.length,
      cycles: cycles.length,
      orphans: gaps.filter((gap) => gap.kind === "orphan").length,
    }),
  });
}
