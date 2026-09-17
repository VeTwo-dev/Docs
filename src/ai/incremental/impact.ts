/**
 * Incremental AI Generation.
 *
 * Detects which documentation pages are affected by code changes and
 * only regenerates those pages, avoiding full regeneration.
 */

import type { AIGeneratedPage } from "../types.js";
import type { DocPlanPage } from "../planning/plan.js";

/** A code change that may affect documentation. */
export interface CodeChange {
  /** File path that changed. */
  readonly filePath: string;
  /** Change kind: `"added"`, `"modified"`, `"deleted"`, `"renamed"`. */
  readonly kind: "added" | "modified" | "deleted" | "renamed";
  /** Symbols that were added/modified/deleted in this file. */
  readonly symbols?: readonly string[];
  /** Old path if renamed. */
  readonly oldPath?: string;
}

/** The result of impact analysis. */
export interface ImpactAnalysis {
  /** Pages that should be regenerated. */
  readonly affected: readonly string[];
  /** Pages that are unchanged. */
  readonly unchanged: readonly string[];
  /** Pages that should be removed (orphaned). */
  readonly orphaned: readonly string[];
  /** New pages that should be created (if new APIs/features were added). */
  readonly newPages: readonly DocPlanPage[];
}

/**
 * Analyze the impact of code changes on documentation.
 */
export function analyzeImpact(
  changes: readonly CodeChange[],
  existingPages: readonly AIGeneratedPage[],
  plan: readonly DocPlanPage[],
): ImpactAnalysis {
  const affected = new Set<string>();
  const unchanged = new Set(existingPages.map((p) => p.slug));
  const orphaned = new Set<string>();

  for (const change of changes) {
    // Find pages that reference the changed file
    for (const page of existingPages) {
      if (isPageAffectedByChange(page, change)) {
        affected.add(page.slug);
        unchanged.delete(page.slug);
      }
    }

    // Find plan pages that reference the changed symbols
    for (const planned of plan) {
      if (isPlannedPageAffectedByChange(planned, change)) {
        // Check if this page already exists
        const existing = existingPages.find((p) => p.slug === planned.slug);
        if (existing !== undefined) {
          affected.add(planned.slug);
          unchanged.delete(planned.slug);
        }
      }
    }
  }

  // Detect orphaned pages (pages whose subject was deleted)
  for (const change of changes) {
    if (change.kind === "deleted") {
      for (const page of existingPages) {
        if (
          page.content.includes(change.filePath) ||
          (change.symbols !== undefined && change.symbols.some((s) => page.content.includes(s)))
        ) {
          orphaned.add(page.slug);
          affected.delete(page.slug);
        }
      }
    }
  }

  // Detect new pages needed
  const newPages: DocPlanPage[] = [];
  for (const change of changes) {
    if (change.kind === "added" && change.symbols !== undefined) {
      for (const symbol of change.symbols) {
        // Check if there's a plan page for this symbol that doesn't exist yet
        const planned = plan.find(
          (p) => p.apis?.includes(symbol) && !existingPages.some((ep) => ep.slug === p.slug),
        );
        if (planned !== undefined && !newPages.some((np) => np.slug === planned.slug)) {
          newPages.push(planned);
        }
      }
    }
  }

  return {
    affected: [...affected],
    unchanged: [...unchanged],
    orphaned: [...orphaned],
    newPages,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function isPageAffectedByChange(page: AIGeneratedPage, change: CodeChange): boolean {
  // Check if the page references the changed file
  if (page.content.includes(change.filePath)) return true;

  // Check if the page references changed symbols
  if (change.symbols !== undefined) {
    for (const symbol of change.symbols) {
      if (page.content.includes(symbol)) return true;
    }
  }

  return false;
}

function isPlannedPageAffectedByChange(planned: DocPlanPage, change: CodeChange): boolean {
  // Check if the planned page's APIs overlap with changed symbols
  if (planned.apis !== undefined && change.symbols !== undefined) {
    for (const api of planned.apis) {
      if (change.symbols.includes(api)) return true;
    }
  }

  return false;
}
