/**
 * Documentation Resolver.
 *
 * Canonical page detection (one authoritative page per concept; others
 * reference it) and duplicate content detection with resolution actions
 * (merge / cross-reference / reduce).
 */

import type { DocumentationPageDefinition } from "./types.js";

/** A duplicate content finding with a recommended action. */
export interface DuplicateFinding {
  readonly pages: readonly string[];
  /** 0..1 similarity of the two pages' subject matter. */
  readonly similarity: number;
  readonly action: "merge" | "cross-reference" | "keep-specialized";
  /** Which slug should become canonical when merging/cross-referencing. */
  readonly canonical?: string;
}

/** Result of resolving an architecture's page set. */
export interface ResolutionResult {
  /** Slug → canonical slug for concepts documented in multiple places. */
  readonly canonicalMap: Readonly<Record<string, string>>;
  readonly duplicates: readonly DuplicateFinding[];
}

/**
 * Detect canonical pages per concept and duplicate content.
 *
 * A page is canonical for a concept when it has the highest importance
 * among pages covering the same symbols/concepts; others cross-reference.
 */
export function resolveCanonicalPages(
  pages: readonly DocumentationPageDefinition[],
): ResolutionResult {
  const canonicalMap: Record<string, string> = {};
  const duplicates: DuplicateFinding[] = [];

  // ── Canonical detection via shared symbol coverage ────────────────
  const bySymbol = new Map<string, DocumentationPageDefinition[]>();
  for (const page of pages) {
    for (const symbol of page.symbols) {
      const list = bySymbol.get(symbol) ?? [];
      list.push(page);
      bySymbol.set(symbol, list);
    }
  }

  for (const [symbol, contenders] of bySymbol) {
    if (contenders.length < 2) continue;
    const sorted = [...contenders].sort(
      (a, b) => b.importance - a.importance || a.slug.localeCompare(b.slug),
    );
    const winner = sorted[0];
    if (winner === undefined) continue;
    canonicalMap[symbol] = winner.slug;
    for (const loser of sorted.slice(1)) {
      if (!loser.kinds.includes("api")) continue; // reference pages may coexist
      duplicates.push({
        pages: [...new Set([winner.slug, loser.slug])],
        similarity: 1,
        action: "cross-reference",
        canonical: winner.slug,
      });
    }
  }

  // ── Near-duplicate conceptual pages via summary/subject overlap ───
  const conceptPages = pages.filter(
    (p) => p.kinds.includes("concept") && p.splitFrom === undefined,
  );
  for (let i = 0; i < conceptPages.length; i++) {
    for (let j = i + 1; j < conceptPages.length; j++) {
      const a = conceptPages[i];
      const b = conceptPages[j];
      if (a === undefined || b === undefined) continue;
      const similarity = subjectSimilarity(a, b);
      if (similarity >= 0.7) {
        const canonical = a.importance >= b.importance ? a.slug : b.slug;
        duplicates.push({
          pages: [a.slug, b.slug],
          similarity,
          action: canonical === a.slug ? "merge" : "merge",
          canonical,
        });
      }
    }
  }

  return { canonicalMap, duplicates };
}

/** Subject overlap between two pages (title tokens + symbol overlap). */
export function subjectSimilarity(
  a: DocumentationPageDefinition,
  b: DocumentationPageDefinition,
): number {
  const tokensOf = (page: DocumentationPageDefinition): Set<string> => {
    const words = page.title.toLowerCase().split(/\s+/);
    const symbols = page.symbols.map((s) => s.toLowerCase());
    return new Set([...words, ...symbols]);
  };

  const ta = tokensOf(a);
  const tb = tokensOf(b);
  let shared = 0;
  for (const t of ta) {
    if (tb.has(t)) shared++;
  }
  const denom = Math.max(ta.size, tb.size, 1);

  // Consolidated-from overlap is strong evidence of duplication.
  const consolidatedOverlap =
    (a.consolidatedFrom ?? []).filter((c) => (b.consolidatedFrom ?? []).includes(c)).length > 0;

  const base = shared / denom;
  return consolidatedOverlap ? Math.max(base, 0.8) : base;
}
