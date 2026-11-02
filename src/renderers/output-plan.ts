/**
 * Documentation Output Plan (Phase 22.2).
 *
 * The single semantic bridge between Documentation IR and renderers.
 * Renderers must not reconstruct page identity, routes, or links from
 * filesystem paths — they consume this plan. Each renderer owns its output
 * root; the plan only carries renderer-relative paths.
 */

import type { DocumentationIR, IRBlock, IRPage } from "../documentation/compiler/ir.js";
import type { SiteRoute } from "./types.js";
import { mapBlockText, rewriteMarkdownLinks } from "../site/links.js";

export { rewriteMarkdownLinks } from "../site/links.js";

/** Renderer target ids (must match `RenderedSite["target"]`). */
export type OutputTarget = "nextjs" | "markdown" | "static-html" | "fumadocs";

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
  /** Path inside `md/` (e.g. `api/overview.md` or `api/overview.mdx`), POSIX. */
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
  /**
   * File extension for `md/` pages. Defaults to `".mdx"` (historical).
   * Use `".md"` for plain-Markdown output (no JSX components).
   */
  readonly markdownExtension?: ".md" | ".mdx";
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
    const ext = options.markdownExtension ?? ".mdx";
    return {
      id: page.slug,
      slug: page.slug,
      title: page.title,
      kinds: [],
      sectionId: page.sectionId,
      sectionTitle: sectionTitle.get(page.sectionId) ?? page.sectionId,
      route: `${base}/${page.slug}`,
      mdPath: page.slug === "index" ? `index${ext}` : `${page.slug}${ext}`,
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

  return {
    workspaceRoot: options.workspaceRoot,
    docsBasePath: base,
    pages,
    pagesBySlug,
    navigation,
    homeSlug,
  };
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
 * - markdown: relative markdown path from the source page (`../api/overview.md`)
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

/** Renderers that resolve authored Markdown links into their own URL space. */
export type ContentLinkRenderer = LinkRenderer | "fumadocs";

const URL_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

/** Normalize a POSIX path, collapsing `.` and `..` segments. */
function normalizePosixPath(path: string): string {
  const out: string[] = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (out.length > 0) out.pop();
      continue;
    }
    out.push(part);
  }
  return out.join("/");
}

/**
 * Resolve an authored Markdown link to a renderer URL, or undefined when the
 * link is external, an anchor, an asset, or does not target a planned page.
 *
 * Handles relative Markdown links (`../api/overview.md`, and `.../index.md`
 * that maps to a section root) as well as root-absolute routes
 * (`/api/overview`, optionally prefixed by the docs base path). Unresolvable
 * links are left verbatim by the caller.
 */
export function resolveContentHref(
  plan: DocumentationOutputPlan,
  sourceSlug: string,
  url: string,
  renderer: ContentLinkRenderer,
  fromDir?: string,
): string | undefined {
  if (url.length === 0) return undefined;
  if (url.startsWith("#") || url.startsWith("//") || URL_SCHEME_RE.test(url)) return undefined;
  const hashIndex = url.search(/[#?]/);
  const path = hashIndex < 0 ? url : url.slice(0, hashIndex);
  const suffix = hashIndex < 0 ? "" : url.slice(hashIndex);
  if (path.length === 0) return undefined;

  const source = plan.pagesBySlug.get(sourceSlug);
  if (source === undefined) return undefined;

  let slug: string;
  if (path.startsWith("/")) {
    slug = path.replace(/^\/+|\/+$/g, "");
    const base = plan.docsBasePath.replace(/^\/+|\/+$/g, "");
    if (base.length > 0 && (slug === base || slug.startsWith(`${base}/`))) {
      slug = slug.slice(base.length).replace(/^\/+/, "");
    }
  } else {
    if (!/\.mdx?$/i.test(path)) return undefined;
    slug = normalizePosixPath(`${posixDir(source.mdPath)}/${path}`).replace(/\.mdx?$/i, "");
  }
  if (slug.endsWith("/index")) slug = slug.slice(0, -"/index".length);
  if (slug.length === 0) return undefined;

  const target = plan.pagesBySlug.get(slug);
  if (target === undefined) return undefined;

  if (renderer === "next") return `${target.route}${suffix}`;
  if (renderer === "fumadocs") return `/${target.slug === "index" ? "" : target.slug}${suffix}`;
  if (renderer === "markdown") {
    if (source.slug === target.slug) return undefined;
    return `${relativePath(posixDir(source.mdPath), target.mdPath)}${suffix}`;
  }
  // static: relative URL from the rendered output directory (which may differ
  // from the source slug, e.g. the root `index.html` home alias) to the target.
  const from = fromDir ?? posixDir(source.staticPath);
  if (source.slug === target.slug && from === posixDir(target.staticPath)) return `./${suffix}`;
  if (from === posixDir(target.staticPath)) return `./${suffix}`;
  return `${relativePath(from, posixDir(target.staticPath))}/${suffix}`;
}

/**
 * Rewrite every inline link in a block list into the renderer's URL space.
 * Code, images, and non-text blocks are preserved verbatim.
 */
export function rewriteBlockLinks(
  blocks: readonly IRBlock[],
  plan: DocumentationOutputPlan,
  sourceSlug: string,
  renderer: ContentLinkRenderer,
): readonly IRBlock[] {
  return mapBlockText(blocks, (text) =>
    rewriteMarkdownLinks(text, (url) => resolveContentHref(plan, sourceSlug, url, renderer)),
  );
}

/** Directory portion of a POSIX path (`.` when there is none). */
export function posixDir(p: string): string {
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

/**
 * Project plan pages to site routes. Shared by every renderer so route
 * identity is derived in exactly one place.
 */
export function planRoutes(plan: DocumentationOutputPlan): SiteRoute[] {
  return plan.pages.map((p) => ({
    slug: p.slug,
    route: p.route,
    title: p.title,
    sectionId: p.sectionId,
    sectionTitle: p.sectionTitle,
  }));
}

/** A resolved related-page target (renderer formats label/href from this). */
export interface RelatedPageTarget {
  readonly slug: string;
  readonly title: string;
  readonly kind?: string;
}

/**
 * Resolve an IR page's `references` to known plan pages, deduplicated.
 * Shared by renderers so related-link targets resolve identically;
 * each renderer formats labels/hrefs for its own output.
 */
export function relatedPageTargets(
  plan: DocumentationOutputPlan,
  page: Pick<IRPage, "slug" | "references">,
): RelatedPageTarget[] {
  const seen = new Set<string>();
  const targets: RelatedPageTarget[] = [];
  for (const ref of page.references) {
    if (ref.targetSlug === undefined || seen.has(ref.targetSlug)) continue;
    const target = plan.pagesBySlug.get(ref.targetSlug);
    if (target === undefined) continue;
    seen.add(ref.targetSlug);
    targets.push({ slug: target.slug, title: target.title, kind: ref.relationship });
  }
  return targets;
}
