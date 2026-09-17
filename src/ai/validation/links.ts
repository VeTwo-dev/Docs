/**
 * Link Validation.
 *
 * Validates that AI-generated relationships and links resolve against
 * the Documentation Model. Prevents broken links in the final output.
 */

/** A link found in generated documentation. */
export interface GeneratedLink {
  /** The link text. */
  readonly text: string;
  /** The link target (slug, path, or URL). */
  readonly target: string;
  /** The page the link appears in. */
  readonly sourcePage: string;
  /** Link kind: `"page"`, `"api"`, `"concept"`, `"external"`, `"anchor"`. */
  readonly kind: "page" | "api" | "concept" | "external" | "anchor";
}

/** Result of validating a single link. */
export interface LinkValidationResult {
  /** The original link. */
  readonly link: GeneratedLink;
  /** Whether the link resolves. */
  readonly valid: boolean;
  /** Reason if invalid. */
  readonly reason?: string;
  /** Suggested fix, if available. */
  readonly suggestion?: string;
}

/** Known pages and slugs in the documentation model. */
export interface DocumentationModel {
  /** Known page slugs. */
  readonly slugs: readonly string[];
  /** Known API names. */
  readonly apiNames: readonly string[];
  /** Known concept names. */
  readonly conceptNames: readonly string[];
  /** Known external URLs. */
  readonly externalUrls?: readonly string[];
}

/**
 * Validate a single link against the documentation model.
 */
export function validateLink(link: GeneratedLink, model: DocumentationModel): LinkValidationResult {
  switch (link.kind) {
    case "page": {
      const valid = model.slugs.includes(link.target);
      return {
        link,
        valid,
        reason: valid ? undefined : `Page slug "${link.target}" not found.`,
        suggestion: valid ? undefined : findClosestSlug(link.target, model.slugs),
      };
    }
    case "api": {
      const valid = model.apiNames.includes(link.target);
      return {
        link,
        valid,
        reason: valid ? undefined : `API "${link.target}" not found.`,
      };
    }
    case "concept": {
      const valid = model.conceptNames.includes(link.target);
      return {
        link,
        valid,
        reason: valid ? undefined : `Concept "${link.target}" not found.`,
      };
    }
    case "external": {
      // External links are assumed valid (we don't fetch them)
      return { link, valid: true };
    }
    case "anchor": {
      // Anchor links within the same page are assumed valid
      return { link, valid: true };
    }
  }
}

/**
 * Validate all links in a set of generated pages.
 */
export function validateLinks(
  links: readonly GeneratedLink[],
  model: DocumentationModel,
): LinkValidationResult[] {
  return links.map((link) => validateLink(link, model));
}

/**
 * Extract all markdown links from content.
 */
export function extractLinksFromContent(content: string, sourcePage: string): GeneratedLink[] {
  const links: GeneratedLink[] = [];
  const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;

  let match = pattern.exec(content);
  while (match !== null) {
    const text = match[1];
    const target = match[2];

    if (text !== undefined && target !== undefined) {
      let kind: GeneratedLink["kind"] = "page";
      if (target.startsWith("http://") || target.startsWith("https://")) {
        kind = "external";
      } else if (target.startsWith("#")) {
        kind = "anchor";
      } else if (target.includes("/api/")) {
        kind = "api";
      } else if (target.includes("/concepts/")) {
        kind = "concept";
      }

      links.push({ text, target: target.replace(/^#/, ""), sourcePage, kind });
    }
    match = pattern.exec(content);
  }

  return links;
}

/**
 * Summarize link validation results.
 */
export function summarizeLinkValidation(results: readonly LinkValidationResult[]): {
  total: number;
  valid: number;
  broken: number;
  validationRate: number;
} {
  const total = results.length;
  const valid = results.filter((r) => r.valid).length;
  return {
    total,
    valid,
    broken: total - valid,
    validationRate: total > 0 ? valid / total : 1,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function findClosestSlug(target: string, slugs: readonly string[]): string | undefined {
  let closest: string | undefined;
  let bestDistance = Infinity;

  for (const slug of slugs) {
    const distance = levenshteinDistance(target, slug);
    if (distance < bestDistance) {
      bestDistance = distance;
      closest = slug;
    }
  }

  // Only suggest if reasonably close
  return bestDistance <= 3 ? closest : undefined;
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));

  for (let i = 0; i <= m; i++) {
    const row = dp[i];
    if (row === undefined) continue;
    row[0] = i;
  }
  for (let j = 0; j <= n; j++) {
    const firstRow = dp[0];
    if (firstRow !== undefined) firstRow[j] = j;
  }

  for (let i = 1; i <= m; i++) {
    const prevRow = dp[i - 1];
    const row = dp[i];
    if (prevRow === undefined || row === undefined) continue;
    for (let j = 1; j <= n; j++) {
      const diag = prevRow[j - 1];
      const up = prevRow[j];
      const left = row[j - 1];
      if (diag === undefined || up === undefined || left === undefined) continue;
      row[j] = a[i - 1] === b[j - 1] ? diag : 1 + Math.min(up, left, diag);
    }
  }

  return dp[m]?.[n] ?? Math.max(m, n);
}
