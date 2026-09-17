/**
 * Content Links.
 *
 * Resolves internal links against the documentation graph, detects
 * missing pages / broken anchors, rewrites renamed references, and
 * manages redirects + aliases for moved pages.
 */

import { diagnostic } from "../documentation/compiler/diagnostics.js";
import type { DocumentationDiagnostic } from "../documentation/compiler/diagnostics.js";

/** The known page space of a documentation site. */
export interface LinkGraph {
  /** Known page slugs. */
  readonly slugs: readonly string[];
  /** slug → anchors available on that page. */
  readonly anchors?: Readonly<Record<string, readonly string[]>>;
  /** Explicit aliases: alias → canonical slug. */
  readonly aliases?: Readonly<Record<string, string>>;
}

/** A link found in authored or generated content. */
export interface ContentLink {
  readonly sourceSlug: string;
  readonly target: string;
  /** True when the link points inside this site. */
  readonly internal: boolean;
  readonly anchor?: string;
}

/** Result of resolving one link. */
export interface LinkResolution {
  readonly link: ContentLink;
  readonly status: "ok" | "missing-page" | "missing-anchor" | "renamed" | "alias" | "external";
  /** Rewritten target when renamed/aliased. */
  readonly rewrittenTo?: string;
}

/** Extract markdown-style links from content text. */
export function extractContentLinks(sourceSlug: string, text: string): readonly ContentLink[] {
  const links: ContentLink[] = [];
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const raw = match[1];
    if (raw === undefined) continue;
    if (/^https?:\/\//.test(raw)) {
      links.push({ sourceSlug, target: raw, internal: false });
      continue;
    }
    const [pathPart, anchorPart] = raw.split("#", 2);
    links.push({
      sourceSlug,
      target: pathPart ?? "",
      internal: true,
      ...(anchorPart !== undefined ? { anchor: anchorPart } : {}),
    });
  }
  return links;
}

/** Resolve links against the graph, detecting renames via close matching. */
export function resolveContentLinks(
  links: readonly ContentLink[],
  graph: LinkGraph,
): readonly LinkResolution[] {
  const slugSet = new Set(graph.slugs);
  const aliasMap = new Map(Object.entries(graph.aliases ?? {}));

  return links.map((link) => {
    if (!link.internal) return { link, status: "external" as const };

    const normalized = normalizeTarget(link.target);
    const anchorOk =
      link.anchor === undefined || (graph.anchors?.[normalized]?.includes(link.anchor) ?? true);

    if (slugSet.has(normalized)) {
      return anchorOk
        ? { link, status: "ok" as const }
        : { link, status: "missing-anchor" as const };
    }

    // Alias?
    const aliased = aliasMap.get(normalized);
    if (aliased !== undefined && slugSet.has(aliased)) {
      return { link, status: "alias" as const, rewrittenTo: aliased };
    }

    // Rename heuristic: unique close match among known slugs.
    const candidate = closestSlug(normalized, graph.slugs);
    if (candidate !== undefined) {
      return { link, status: "renamed" as const, rewrittenTo: candidate };
    }

    return { link, status: "missing-page" as const };
  });
}

/** Diagnostics from link resolution. */
export function linkDiagnostics(resolutions: readonly LinkResolution[]): DocumentationDiagnostic[] {
  const diagnostics: DocumentationDiagnostic[] = [];
  for (const resolution of resolutions) {
    switch (resolution.status) {
      case "missing-page":
        diagnostics.push(
          diagnostic(
            "DOC_BROKEN_LINK",
            "error",
            `Link to "${resolution.link.target}" does not resolve.`,
            resolution.link.sourceSlug,
          ),
        );
        break;
      case "missing-anchor":
        diagnostics.push(
          diagnostic(
            "DOC_MISSING_ANCHOR",
            "warning",
            `Anchor "#${resolution.link.anchor ?? ""}" not found on "${resolution.link.target}".`,
            resolution.link.sourceSlug,
          ),
        );
        break;
      case "renamed":
        diagnostics.push(
          diagnostic(
            "DOC_BROKEN_LINK",
            "info",
            `Link "${resolution.link.target}" refers to a renamed page; update to "${resolution.rewrittenTo}".`,
            resolution.link.sourceSlug,
          ),
        );
        break;
      default:
        break;
    }
  }
  return diagnostics;
}

// ─── Redirects & aliases ─────────────────────────────────────────────────

/** A generated redirect entry. */
export interface RedirectEntry {
  readonly from: string;
  readonly to: string;
}

/**
 * Build redirects from page renames + declared aliases.
 * Renames come from impact analysis; aliases from frontmatter.
 */
export function buildRedirects(input: {
  readonly renames?: readonly { from: string; to: string }[];
  /** slug → declared alias paths. */
  readonly aliases?: Readonly<Record<string, readonly string[]>>;
}): readonly RedirectEntry[] {
  const entries: RedirectEntry[] = [];

  for (const rename of input.renames ?? []) {
    entries.push({ from: `/${rename.from}`, to: `/${rename.to}` });
  }

  for (const [slug, aliases] of Object.entries(input.aliases ?? {})) {
    for (const alias of aliases) {
      entries.push({ from: normalizeTarget(alias), to: `/${slug}` });
    }
  }

  return entries;
}

function normalizeTarget(target: string): string {
  return target.replace(/^\/+|\/+$/g, "").replace(/\.(md|mdx)$/i, "");
}

/** Unique close-match detection (conservative — no suggestion on ambiguity). */
function closestSlug(target: string, slugs: readonly string[]): string | undefined {
  let best: string | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  let ties = 0;

  for (const slug of slugs) {
    const distance = boundedLevenshtein(target.toLowerCase(), slug.toLowerCase(), bestDistance);
    if (distance === null) continue; // exceeded current best
    if (distance < bestDistance) {
      bestDistance = distance;
      best = slug;
      ties = 1;
    } else if (distance === bestDistance) {
      ties++;
    }
  }

  const maxAllowed = Math.max(2, Math.floor(target.length / 4));
  return ties === 1 && bestDistance <= maxAllowed ? best : undefined;
}

/** Levenshtein with early cutoff; returns null when exceeding `max`. */
function boundedLevenshtein(a: string, b: string, max: number): number | null {
  if (Math.abs(a.length - b.length) > max) return null;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min((prev[j] ?? 0) + 1, (curr[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
      rowMin = Math.min(rowMin, curr[j] ?? 0);
    }
    if (rowMin > max) return null;
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j] ?? 0;
  }
  const result = prev[b.length] ?? a.length;
  return result <= max ? result : null;
}
