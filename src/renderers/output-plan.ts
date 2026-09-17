/**
 * Documentation Output Plan (Phase 22.2).
 *
 * The single semantic bridge between Documentation IR and renderers.
 * Renderers must not reconstruct page identity, routes, or links from
 * filesystem paths — they consume this plan. Each renderer owns its output
 * root; the plan only carries renderer-relative paths.
 */

import type { DocumentationIR, IRPage } from "../documentation/compiler/ir.js";

/** Renderer target ids (must match `RenderedSite["target"]`). */
export type OutputTarget = "nextjs" | "markdown" | "static-html";

/** One planned documentation page with all renderer-relative addresses. */
export interface PlannedPage {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly kinds: readonly string[];
  readonly sectionId: string;
  readonly sectionTitle: string;
  /** Canonical Next.js route (e.g. `/docs/api/overview`). */
  readonly route: string;
  /** Path inside `md/` (e.g. `api/overview.mdx`), POSIX. */
  readonly mdPath: string;
  /** Path inside `static/` (e.g. `api/overview/index.html`), POSIX. */
  readonly staticPath: string;
  /** Next.js App Router segments for `app/docs/[...slug]` (e.g. `["api","overview"]`). */
  readonly segments: readonly string[];
  readonly page: IRPage;
}

/** One planned navigation node (canonical, renderer-independent). */
export interface PlannedNavNode {
  readonly label: string;
  readonly slug?: string;
  readonly children?: readonly PlannedNavNode[];
}

/** The full output plan for one compilation. */
export interface DocumentationOutputPlan {
  readonly workspaceRoot: string;
  readonly docsBasePath: string;
  readonly pages: readonly PlannedPage[];
  readonly pagesBySlug: ReadonlyMap<string, PlannedPage>;
  readonly navigation: readonly PlannedNavNode[];
  /** First valid canonical page slug, or undefined when empty. */
  readonly homeSlug?: string;
}

export interface OutputPlanOptions {
  readonly workspaceRoot: string;
  readonly docsBasePath?: string;
}

function splitSegments(slug: string): readonly string[] {
  return slug.split("/").filter((s) => s.length > 0);
}

/** Build the output plan from a Documentation IR. Pure + deterministic. */
export function buildOutputPlan(
  ir: DocumentationIR,
  options: OutputPlanOptions,
): DocumentationOutputPlan {
  const base = normalizeBase(options.docsBasePath);
  const sectionTitle = new Map(ir.sections.map((s) => [s.id, s.title]));

  // Navigation order first, then slug order for determinism.
  const navOrder = ir.navigation.sidebar
    .flatMap((n) => [n.slug, ...(n.children ?? []).map((c) => c.slug)])
    .filter((s): s is string => s !== undefined);
  const orderIndex = new Map(navOrder.map((slug, i) => [slug, i]));
  const ordered = [...ir.pages].sort(
    (a, b) =>
      (orderIndex.get(a.slug) ?? Number.MAX_SAFE_INTEGER) -
        (orderIndex.get(b.slug) ?? Number.MAX_SAFE_INTEGER) || a.slug.localeCompare(b.slug),
  );

  const pages: PlannedPage[] = ordered.map((page) => {
    const segments = splitSegments(page.slug);
    return {
      id: page.slug,
      slug: page.slug,
      title: page.title,
      kinds: [],
      sectionId: page.sectionId,
      sectionTitle: sectionTitle.get(page.sectionId) ?? page.sectionId,
      route: `${base}/${page.slug}`,
      mdPath: page.slug === "index" ? "index.mdx" : `${page.slug}.mdx`,
      staticPath: `${page.slug}/index.html`,
      segments,
      page,
    };
  });

  const pagesBySlug = new Map(pages.map((p) => [p.slug, p] as const));

  const navigation: PlannedNavNode[] = ir.navigation.sidebar.map((node) => ({
    label: node.label,
    slug: node.slug !== undefined && pagesBySlug.has(node.slug) ? node.slug : undefined,
    children: (node.children ?? [])
      .filter((c) => c.slug !== undefined && pagesBySlug.has(c.slug))
      .map((c) => ({ label: c.label, slug: c.slug })),
  }));

  // Home = first nav page that exists, else first planned page, else undefined (empty-state).
  const navSlugs = ir.navigation.sidebar
    .flatMap((n) => [n.slug, ...(n.children ?? []).map((c) => c.slug)])
    .filter((s): s is string => s !== undefined && pagesBySlug.has(s));
  const homeSlug = navSlugs[0] ?? pages[0]?.slug;

  return { workspaceRoot: options.workspaceRoot, docsBasePath: base, pages, pagesBySlug, navigation, homeSlug };
}

function normalizeBase(basePath: string | undefined): string {
  const base = basePath ?? "/docs";
  if (base === "/" || base === "") return "";
  return `/${base.replace(/^\/+|\/+$/g, "")}`;
}

/** Link resolution target. */
export type LinkRenderer = "next" | "markdown" | "static";

/**
 * Resolve a canonical documentation link for a renderer.
 * - next: absolute route (`/docs/api/overview`)
 * - markdown: relative `.mdx` path from the source page (`../api/overview.mdx`)
 * - static: relative URL from the source page dir (`../api/overview/`)
 * Returns undefined when the target slug is not in the plan.
 */
export function resolveDocumentationLink(
  plan: DocumentationOutputPlan,
  sourceSlug: string,
  targetSlug: string,
  renderer: LinkRenderer,
): string | undefined {
  const source = plan.pagesBySlug.get(sourceSlug);
  const target = plan.pagesBySlug.get(targetSlug);
  if (source === undefined || target === undefined) return undefined;

  if (renderer === "next") return target.route;
  if (renderer === "markdown") {
    if (source.slug === target.slug) return undefined;
    return relativePath(posixDir(source.mdPath), target.mdPath);
  }
  // static: relative from source dir to target dir (trailing slash resolves index.html)
  if (source.slug === target.slug) return "./";
  return relativePath(posixDir(source.staticPath), posixDir(target.staticPath)) + "/";
}

function posixDir(p: string): string {
  const i = p.lastIndexOf("/");
  return i < 0 ? "." : p.slice(0, i);
}

/** POSIX relative path from `fromDir` to `to` (both POSIX, no leading slash). */
export function relativePath(fromDir: string, to: string): string {
  if (fromDir === "." || fromDir === "") return to;
  const from = fromDir.split("/");
  const parts = to.split("/");
  let common = 0;
  while (common < from.length && common < parts.length && from[common] === parts[common]) common++;
  const up = from.length - common;
  const rel = [...Array<string>(up).fill(".."), ...parts.slice(common)];
  return rel.join("/") || ".";
}
