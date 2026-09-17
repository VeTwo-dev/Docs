/**
 * Documentation Impact Analysis.
 *
 * Maps detected project changes onto affected documentation through the
 * change graph, classifies impact severity, detects drift and stale
 * pages, and produces human-readable explanations for every decision.
 */

import type { ProjectChange } from "./change-detection.js";
import { propagateImpact } from "./graph.js";
import type { ChangeGraph } from "./graph.js";
import type { ProjectSnapshot, ArtifactEntry } from "./snapshot.js";

/** Impact severity levels (extensible ordering). */
export type ImpactLevel = "none" | "low" | "medium" | "high" | "critical";

const LEVEL_ORDER: Record<ImpactLevel, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/** A documentation artifact affected by changes. */
export interface AffectedArtifact {
  readonly id: string;
  readonly kind: ArtifactEntry["kind"];
  /** Why this artifact is affected. */
  readonly reason: string;
}

/** The complete documentation impact of a change set. */
export interface DocumentationImpact {
  readonly level: ImpactLevel;
  readonly changedFiles: number;
  readonly semanticChanges: number;
  readonly affectedPages: readonly string[];
  readonly affectedArtifacts: readonly {
    readonly id: string;
    readonly kind: ArtifactEntry["kind"];
    readonly reason: string;
  }[];
  readonly stalePages: readonly { slug: string; reason: string }[];
  /** Human-readable explanation of what happened and why. */
  readonly explanation: readonly string[];
}

/**
 * Compute documentation impact from a change set.
 * Deterministic — no AI required. Formatting-only and documentation-only
 * changes propagate with reduced severity.
 */
export function computeDocumentationImpact(
  changes: readonly ProjectChange[],
  graph: ChangeGraph,
  snapshot: ProjectSnapshot | undefined,
): DocumentationImpact {
  const explanation: string[] = [];
  const seeds: string[] = [];

  let semanticChanges = 0;
  let maxChangeWeight = 0;

  for (const change of changes) {
    if (change.kind === "unchanged") continue;
    seeds.push(`file:${change.path}`);

    const weight = changeWeight(change);
    maxChangeWeight = Math.max(maxChangeWeight, weight);
    if (!change.categories.includes("formatting-only")) semanticChanges++;

    // Symbol-level seeds so symbol-dependent artifacts are caught too.
    for (const removed of change.affectedSymbols.removed) seeds.push(`symbol:${removed}`);
    for (const added of change.affectedSymbols.added) seeds.push(`symbol:${added}`);
  }

  const affectedNodes = propagateImpact(graph, seeds);
  const affectedArtifacts: AffectedArtifact[] = [];
  const pageSet = new Set<string>();

  for (const node of affectedNodes) {
    if (!node.startsWith("artifact:")) continue;
    const rest = node.slice("artifact:".length);
    const sep = rest.indexOf(":");
    const kind = (sep >= 0 ? rest.slice(0, sep) : "page") as ArtifactEntry["kind"];
    const id = sep >= 0 ? rest.slice(sep + 1) : rest;

    // Find the most explanatory seed for this artifact.
    const deps = graph.dependencies[node] ?? [];
    const seedFiles = deps
      .filter((d) => seeds.includes(d))
      .map((d) => d.slice("file:".length));
    const seedSymbols = deps
      .filter((d) => d.startsWith("symbol:") && seeds.includes(d))
      .map((d) => d.slice("symbol:".length));

    const reason =
      seedSymbols.length > 0
        ? `references changed symbols (${seedSymbols.slice(0, 3).join(", ")})`
        : seedFiles.length > 0
          ? `depends on ${seedFiles.slice(0, 3).join(", ")}`
          : "transitively affected";

    if (kind === "page") pageSet.add(id);
    affectedArtifacts.push({ id, kind, reason });
  }

  // ── Drift & staleness ────────────────────────────────────────────────
  const stalePages: { slug: string; reason: string }[] = [];
  if (snapshot !== undefined) {
    const allRemovedSymbols = new Set(
      changes.flatMap((c) => c.affectedSymbols.removed),
    );
    for (const [id, entry] of Object.entries(snapshot.artifacts)) {
      if (entry.kind !== "page") continue;
      const missing = entry.dependsOnSymbols.filter((s) => allRemovedSymbols.has(s));
      if (missing.length > 0 && !pageSet.has(id)) {
        pageSet.add(id); // drifted pages must be revalidated too
        stalePages.push({
          slug: id,
          reason: `references removed symbols: ${missing.slice(0, 3).join(", ")}`,
        });
        affectedArtifacts.push({
          id,
          kind: "page",
          reason: `stale — ${missing.slice(0, 3).join(", ")}`,
        });
      }
    }
  }

  // ── Level ────────────────────────────────────────────────────────────
  let level: ImpactLevel = "none";
  if (changes.length > 0) level = "low";
  if (semanticChanges > 0) level = "medium";
  if (maxChangeWeight >= 3) level = "high";
  if (
    changes.some(
      (c) =>
        c.categories.includes("public-api") &&
        c.affectedSymbols.removed.length > 0,
    ) ||
    stalePages.length > 0
  ) {
    level = "critical";
  }

  // ── Explanation ──────────────────────────────────────────────────────
  explanation.push(`${changes.length} file(s) changed, ${semanticChanges} semantic`);
  if (maxChangeWeight >= 3) explanation.push("public API surface affected");
  if (affectedArtifacts.length > 0) {
    explanation.push(
      `${pageSet.size} page(s) and ${affectedArtifacts.length - pageSet.size} other artifact(s) affected`,
    );
  } else {
    explanation.push("no documentation depends on the changed files");
  }
  for (const change of changes.slice(0, 5)) {
    const detail =
      change.affectedSymbols.removed.length > 0 || change.affectedSymbols.added.length > 0
        ? ` (+${change.affectedSymbols.added.length}/-${change.affectedSymbols.removed.length} exports)`
        : "";
    explanation.push(`${change.kind}: ${change.path}${detail}`);
  }

  return {
    level,
    changedFiles: changes.length,
    semanticChanges,
    affectedPages: [...pageSet],
    affectedArtifacts,
    stalePages,
    explanation,
  };
}

function changeWeight(change: ProjectChange): number {
  let weight = 1;
  if (change.categories.includes("configuration")) weight = Math.max(weight, 3);
  if (change.categories.includes("dependency")) weight = Math.max(weight, 2);
  if (change.categories.includes("public-api")) weight = Math.max(weight, 4);
  if (change.categories.includes("architecture")) weight = Math.max(weight, 3);
  if (change.categories.includes("documentation-only")) weight = Math.min(weight, 1);
  if (change.categories.includes("formatting-only")) weight = 0;
  if (change.kind === "removed" && change.categories.includes("public-api")) weight = 5;
  return weight;
}

/** Compare impact levels. */
export function maxLevel(a: ImpactLevel, b: ImpactLevel): ImpactLevel {
  return LEVEL_ORDER[a] >= LEVEL_ORDER[b] ? a : b;
}
