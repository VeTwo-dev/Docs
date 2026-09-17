import {
  SKILL_ID,
  MANAGED_SECTIONS,
  MANAGED_START,
  MANAGED_END,
} from "../../init/templates/skill.js";
import type { ManagedSection } from "../../init/templates/skill.js";
import type { DocumentationIntelligence } from "../aggregate.js";

/**
 * Skill integration contracts (Part D).
 *
 * These contracts describe how documentation intelligence artifacts are
 * delivered to the project skill. They only expose the contract — they do
 * not modify the skill architecture or write any skill files.
 */

/** Reference to the managed skill sections defined by the init module. */
export const SKILL_MANAGED_SECTIONS: readonly ManagedSection[] = MANAGED_SECTIONS;

/** Marker used to delimit system-managed skill sections. */
export const SKILL_MANAGED_START = MANAGED_START;
export const SKILL_MANAGED_END = MANAGED_END;

/** The skill frontmatter identifier. */
export const SKILL_IDENTIFIER = SKILL_ID;

/** A single deliverable artifact the skill can reference. */
export interface SkillArtifact {
  /** Artifact kind. */
  readonly kind: "report" | "examples" | "relationships" | "learning-paths";
  /** Project-relative path where the artifact lives. */
  readonly path: string;
  /** Brief description of the artifact. */
  readonly description: string;
}

/** The manifest of intelligence artifacts handed to the skill. */
export interface SkillIntelligenceManifest {
  readonly skill: typeof SKILL_ID;
  readonly version: number;
  readonly generatedAt: string;
  /** Sections the generator is allowed to update. */
  readonly managedSections: readonly ManagedSection[];
  /** Deliverable artifact references. */
  readonly artifacts: readonly SkillArtifact[];
  /** Structured evidence summary. */
  readonly summary: DocumentationIntelligence["summary"];
  /** Machine-readable facts the skill can rely on. */
  readonly facts: Readonly<{
    readonly hasExamples: boolean;
    readonly hasGaps: boolean;
    readonly hasCycles: boolean;
    readonly hasOrphans: boolean;
    readonly topSymbols: readonly string[];
  }>;
}

/** Builds a skill intelligence manifest from the aggregate. */
export function buildSkillIntelligenceManifest(
  intelligence: DocumentationIntelligence,
  options: { readonly generatedAt?: string; readonly reportDirectory?: string } = {},
): SkillIntelligenceManifest {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const reportDirectory = options.reportDirectory ?? "agent/reports";

  const artifacts: readonly SkillArtifact[] = Object.freeze([
    {
      kind: "examples",
      path: `${reportDirectory}/example-inventory.json`,
      description: "Evidence-backed inventory of extracted examples",
    },
    {
      kind: "relationships",
      path: `${reportDirectory}/relationships.json`,
      description: "Derived documentation relationships and navigation",
    },
    {
      kind: "learning-paths",
      path: `${reportDirectory}/learning-paths.json`,
      description: "Planned learning paths per audience",
    },
    {
      kind: "report",
      path: `${reportDirectory}/example-gaps.md`,
      description: "Documentation gap recommendations (never written into docs)",
    },
  ]);

  const symbolFrequency = new Map<string, number>();
  for (const example of intelligence.examples) {
    for (const symbol of example.referencedSymbols) {
      symbolFrequency.set(symbol, (symbolFrequency.get(symbol) ?? 0) + 1);
    }
  }
  const topSymbols = Object.freeze(
    [...symbolFrequency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([symbol]) => symbol),
  );

  return Object.freeze({
    skill: SKILL_ID,
    version: 1,
    generatedAt,
    managedSections: Object.freeze([...MANAGED_SECTIONS]),
    artifacts,
    summary: intelligence.summary,
    facts: Object.freeze({
      hasExamples: intelligence.examples.length > 0,
      hasGaps: intelligence.exampleGaps.length > 0,
      hasCycles: intelligence.cycles.length > 0,
      hasOrphans: intelligence.summary.orphans > 0,
      topSymbols,
    }),
  });
}
