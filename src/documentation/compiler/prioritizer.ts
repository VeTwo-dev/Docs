/**
 * Documentation Prioritizer.
 *
 * Scores page importance across multiple dimensions. The raw 0..1 score
 * drives internal ordering and effort allocation — it is never surfaced
 * to users as an unexplained number.
 */

import type {
  CompilerProjectInput,
  DocumentationCoverage,
  DocumentationPageDefinition,
} from "./types.js";

/** Weights for importance dimensions (sum ≈ 1). */
export const IMPORTANCE_WEIGHTS = {
  publicApi: 0.25,
  userFrequency: 0.15,
  dependencyCentrality: 0.15,
  conceptualImportance: 0.1,
  entryPoint: 0.1,
  frameworkRelevance: 0.05,
  configurationImportance: 0.05,
  learningValue: 0.1,
  changeFrequency: 0.05,
} as const;

/**
 * Compute the importance of a page across weighted dimensions.
 */
export function computeImportance(
  page: Pick<DocumentationPageDefinition, "kinds" | "symbols" | "slug" | "sectionId" | "canonical">,
  input: CompilerProjectInput,
  context: {
    /** How many pages depend on this slug (centrality signal). */
    readonly dependents?: number;
    /** Relative churn of the covered area (0..1). */
    readonly changeFrequency?: number;
  } = {},
): number {
  let score = 0;

  // Public API importance.
  if (page.kinds.includes("api") || page.kinds.includes("cli-command")) {
    const apiCount = page.symbols.length;
    const totalApis = Math.max(input.apis?.length ?? 1, 1);
    score += IMPORTANCE_WEIGHTS.publicApi * Math.min(1, apiCount / totalApis + 0.4);
  }

  // User frequency proxy: getting-started/overview are read by everyone.
  if (page.slug === "getting-started") score += IMPORTANCE_WEIGHTS.userFrequency;
  else if (page.kinds.includes("overview")) score += IMPORTANCE_WEIGHTS.userFrequency * 0.8;
  else if (page.kinds.includes("guide")) score += IMPORTANCE_WEIGHTS.userFrequency * 0.5;

  // Dependency centrality.
  if ((context.dependents ?? 0) > 0) {
    score += IMPORTANCE_WEIGHTS.dependencyCentrality * Math.min(1, (context.dependents ?? 0) / 3);
  }

  // Conceptual importance.
  if (page.kinds.includes("concept")) score += IMPORTANCE_WEIGHTS.conceptualImportance;
  if (page.canonical === true) score += IMPORTANCE_WEIGHTS.conceptualImportance * 0.5;

  // Entry-point importance.
  if (page.kinds.includes("overview")) score += IMPORTANCE_WEIGHTS.entryPoint;

  // Framework relevance.
  if (input.signals.framework !== undefined && page.sectionId === "core-concepts") {
    score += IMPORTANCE_WEIGHTS.frameworkRelevance;
  }

  // Configuration importance.
  if (page.kinds.includes("configuration")) {
    score += IMPORTANCE_WEIGHTS.configurationImportance;
  }

  // Learning value: tutorials and guides teach transferable skills.
  if (page.kinds.includes("tutorial")) score += IMPORTANCE_WEIGHTS.learningValue;
  else if (page.kinds.includes("guide")) score += IMPORTANCE_WEIGHTS.learningValue * 0.6;

  // Change frequency: fast-moving areas deserve fresher docs.
  if (context.changeFrequency !== undefined) {
    score += IMPORTANCE_WEIGHTS.changeFrequency * context.changeFrequency;
  }

  return Math.min(1, Math.max(0, score));
}

/** Rank pages by importance (descending). Stable for equal scores. */
export function rankPages(
  pages: readonly DocumentationPageDefinition[],
): readonly DocumentationPageDefinition[] {
  return [...pages]
    .map((page, index) => ({ page, index }))
    .sort((a, b) => b.page.importance - a.page.importance || a.index - b.index)
    .map(({ page }) => page);
}

/**
 * Select which gaps to work on first: highest impact per unit of effort.
 * Returns gap descriptors sorted by priority (best first).
 */
export function prioritizeGaps(
  coverage: DocumentationCoverage,
  limit = 10,
): readonly { area: string; item: string; reason: string }[] {
  const priorities: { area: string; item: string; reason: string; weight: number }[] = [];

  for (const area of coverage.areas) {
    for (const gap of area.gaps) {
      const weight =
        area.area === "apis"
          ? 0.9
          : area.area === "configuration"
            ? 0.7
            : area.area === "concepts"
              ? 0.6
              : 0.4;
      priorities.push({
        area: area.area,
        item: gap,
        reason: `${gap} is part of the project's ${area.area.replace(/-/g, " ")} but has no documentation.`,
        weight,
      });
    }
  }

  return priorities
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
    .map(({ area, item, reason }) => ({ area, item, reason }));
}
