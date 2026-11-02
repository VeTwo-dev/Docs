/**
 * Canonical site model → Documentation IR adapter (Phase 4.9/4.11).
 *
 * Lets the existing output plan and modern renderers consume the canonical
 * site model without modification: the adapter translates site pages (home,
 * documentation, blog) into IR pages, the canonical navigation into IR
 * navigation (home first, so it becomes the plan's home slug), and document
 * links into IR references. No inference, no analysis — pure reshaping.
 */

import { IR_SCHEMA_VERSION } from "../documentation/compiler/ir.js";
import type {
  DocumentationIR,
  IRNavigation,
  IRPage,
  IRReference,
} from "../documentation/compiler/ir.js";
import type { DocumentationManifest } from "../documentation/compiler/manifest.js";
import { hashString } from "../utils/hash.js";
import { relative } from "node:path";
import {
  buildOutputPlan,
  type DocumentationOutputPlan,
  type OutputPlanOptions,
} from "../renderers/output-plan.js";
import type { BlogPost, DocumentationSite, SiteNavigation, SitePage } from "./types.js";

/** Translate a canonical site model into a Documentation IR. */
export function siteModelToIR(site: DocumentationSite): DocumentationIR {
  const pageIds = new Set<string>([
    ...(site.home !== undefined ? [site.home.id] : []),
    ...site.pages.map((page) => page.id),
    ...site.blog.map((post) => post.id),
  ]);

  const sections = site.sections.map((section) => ({
    id: section.id,
    title: section.title,
    pageSlugs: section.pageIds.filter((id) => pageIds.has(id)),
  }));
  if (site.blog.length > 0) {
    sections.push({
      id: "blog",
      title: "Blog",
      pageSlugs: site.blog.map((post) => post.id),
    });
  }

  const pages: IRPage[] = [];
  if (site.home !== undefined) {
    pages.push(sitePageToIR(site.home, undefined, pageIds));
  }
  for (const page of site.pages) {
    pages.push(sitePageToIR(page, page.sectionId, pageIds));
  }
  for (const post of site.blog) {
    pages.push(blogPostToIR(post, pageIds));
  }

  return {
    schemaVersion: IR_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sections,
    pages,
    navigation: siteNavigationToIR(site.navigation),
  };
}

/** Build an output plan directly from a site model (IR as the intermediate). */
export function planSiteOutput(
  site: DocumentationSite,
  options: OutputPlanOptions,
): DocumentationOutputPlan {
  return buildOutputPlan(siteModelToIR(site), options);
}

/**
 * Build a documentation manifest for a canonical site: same shape as the
 * compiler manifest (pages/routes/symbols/packages/categories) but sourced
 * from content (slugs/titles/sections) instead of inferred architecture.
 * `sourceMappings` uses content-root-relative POSIX paths (portable).
 */
export function siteManifest(
  site: DocumentationSite,
  plan: DocumentationOutputPlan,
  projectName: string,
  rootDir: string,
): DocumentationManifest {
  const toRel = (abs: string): string => relative(rootDir, abs).replace(/\\/g, "/") || ".";
  const sources = new Map<string, string>();
  if (site.home !== undefined) {
    sources.set(site.home.id, toRel(String(site.home.metadata["sourcePath"] ?? site.home.id)));
  }
  for (const page of site.pages) {
    sources.set(page.id, toRel(String(page.metadata["sourcePath"] ?? page.id)));
  }
  return {
    generatedAt: new Date().toISOString(),
    pages: plan.pages.map((p) => ({ slug: p.slug, title: p.title, kinds: [] as string[] })),
    routes: plan.pages.map((p) => ({ slug: p.slug, path: p.route })),
    symbols: [],
    packages: [{ name: projectName }],
    categories: site.sections.map((s) => s.id),
    relationships: [],
    sourceMappings: Object.fromEntries(sources),
    searchEntries: plan.pages.length,
  };
}

function sitePageToIR(
  page: SitePage,
  sectionId: string | undefined,
  knownIds: ReadonlySet<string>,
): IRPage {
  return {
    slug: page.id,
    title: page.title,
    sectionId: sectionId ?? "",
    description: page.description,
    blocks: [...page.blocks],
    examples: [],
    claims: [],
    references: referencesFor(page.id, page.links, knownIds),
    fingerprint: hashString(
      JSON.stringify({ slug: page.id, title: page.title, blocks: page.blocks }),
    ),
    provenance: "user",
  };
}

function blogPostToIR(post: BlogPost, knownIds: ReadonlySet<string>): IRPage {
  return {
    slug: post.id,
    title: post.title,
    sectionId: "blog",
    description: post.description,
    blocks: [...post.blocks],
    examples: [],
    claims: [],
    references: referencesFor(post.id, post.links, knownIds),
    fingerprint: hashString(JSON.stringify({ slug: post.id, title: post.title, body: post.body })),
    provenance: "user",
  };
}

function referencesFor(
  sourcePage: string,
  links: readonly { url: string; target?: string }[],
  knownIds: ReadonlySet<string>,
): IRReference[] {
  const references: IRReference[] = [];
  const seen = new Set<string>();
  for (const link of links) {
    if (link.target === undefined || !knownIds.has(link.target) || seen.has(link.target)) {
      continue;
    }
    seen.add(link.target);
    references.push({ sourcePage, targetSlug: link.target });
  }
  return references;
}

/** Canonical navigation → IR navigation (home first → plan home slug). */
function siteNavigationToIR(navigation: SiteNavigation): IRNavigation {
  const breadcrumbs: Record<string, { label: string; slug?: string }[]> = {};
  const sidebar: {
    label: string;
    slug?: string;
    children?: { label: string; slug: string }[];
  }[] = [];
  for (const item of navigation.items) {
    if (item.kind === "link") {
      const slug = item.external === true ? undefined : slugFromRoute(item.route);
      if (slug !== undefined) breadcrumbs[slug] = [{ label: item.title }];
      sidebar.push({ label: item.title, ...(slug !== undefined ? { slug } : {}) });
      continue;
    }
    const children: { label: string; slug: string }[] = [];
    for (const child of item.children) {
      if (child.kind === "section") continue;
      const slug = child.external === true ? undefined : slugFromRoute(child.route);
      if (slug === undefined) continue;
      const sectionSlug = item.route !== undefined ? slugFromRoute(item.route) : undefined;
      breadcrumbs[slug] =
        sectionSlug !== undefined && sectionSlug !== slug
          ? [{ label: item.title, slug: sectionSlug }, { label: child.title }]
          : [{ label: child.title }];
      children.push({ label: child.title, slug });
    }
    sidebar.push({
      label: item.title,
      ...(item.route !== undefined ? { slug: slugFromRoute(item.route) } : {}),
      children,
    });
  }
  return { sidebar, breadcrumbs };
}

/** Canonical route → IR slug (`/` → `index`, `/a/b` → `a/b`). */
export function slugFromRoute(route: string): string {
  return route === "/" ? "index" : route.replace(/^\//, "");
}
