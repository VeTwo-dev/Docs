/**
 * Canonical site model builder (Phase 4).
 *
 * Turns canonical documents into a DocumentationSite: exactly one home
 * page (root index), documentation sections from top-level directories,
 * blog posts from the blog directory, one navigation tree, canonical
 * search records, deduplicated assets, and minimal metadata. Pure and
 * deterministic. Duplicate routes fail loudly — two sources must never
 * claim one URL.
 */

import { DocsError } from "../errors/classes.js";
import { ErrorCode } from "../errors/codes.js";
import { blocksToSearchText } from "./blocks.js";
import type {
  BlogPost,
  BuildSiteOptions,
  CanonicalDocument,
  DocumentationSite,
  SiteMetadata,
  SiteNavigation,
  SiteNavItem,
  SitePage,
  SiteSearchDocument,
  SiteSection,
} from "./types.js";

const SEARCH_CONTENT_LIMIT = 5000;

/** Build a documentation site model from canonical documents. */
export function buildSiteModel(
  documents: readonly CanonicalDocument[],
  options: BuildSiteOptions,
): DocumentationSite {
  assertUniqueRoutes(documents);

  const home = documents.find((doc) => doc.kind === "home" && doc.route === "/");
  const rest = documents.filter((doc) => doc !== home);
  const blogDocs = rest.filter((doc) => doc.kind === "blog").sort((a, b) => compareBlogPosts(a, b));
  const pageDocs = rest.filter((doc) => doc.kind !== "blog").sort((a, b) => comparePages(a, b));
  const searchable = new Set(documents.filter((doc) => isSearchable(doc)).map((doc) => doc.id));

  const sections = buildSections(pageDocs);
  const pages: SitePage[] = pageDocs.map((doc) => toSitePage(doc, sectionIdFor(doc, sections)));
  const homePage = home !== undefined ? toSitePage(home, undefined) : undefined;
  const blog: BlogPost[] = blogDocs.map(toBlogPost);
  const listing = buildBlogListing(
    blog,
    documents.some((doc) => doc.route === "/blog"),
  );
  if (listing !== undefined) {
    pages.push(listing);
    // The synthetic listing is always searchable (no frontmatter to opt out).
    searchable.add(listing.id);
  }
  const navigation = buildNavigation(homePage, sections, pages, blog, listing);
  const search = buildSearch(homePage, pages, blog, sections, searchable);
  const assets = dedupeAssets([...(homePage?.assets ?? []), ...pages.flatMap((p) => p.assets)]);
  const metadata: SiteMetadata = {
    name: options.siteName,
    title: options.title,
    description: options.description,
    ...(options.baseUrl !== undefined ? { url: options.baseUrl } : {}),
    ...(options.github !== undefined ? { github: options.github } : {}),
    ...(options.logo !== undefined ? { logo: options.logo } : {}),
  };

  return {
    ...(homePage !== undefined ? { home: homePage } : {}),
    sections,
    pages,
    blog,
    navigation,
    search,
    assets,
    metadata,
  };
}

function assertUniqueRoutes(documents: readonly CanonicalDocument[]): void {
  const seen = new Map<string, string>();
  for (const doc of documents) {
    const previous = seen.get(doc.route);
    if (previous !== undefined) {
      throw new DocsError({
        code: ErrorCode.VALIDATION_FAILED,
        message: `Duplicate route "${doc.route}" from ${previous} and ${doc.relativePath}: each source file needs a unique route.`,
      });
    }
    seen.set(doc.route, doc.relativePath);
  }
}

function comparePages(a: CanonicalDocument, b: CanonicalDocument): number {
  return a.order - b.order || a.title.localeCompare(b.title) || a.route.localeCompare(b.route);
}

function compareBlogPosts(a: CanonicalDocument, b: CanonicalDocument): number {
  if (a.date !== undefined && b.date !== undefined && a.date !== b.date) {
    return b.date.localeCompare(a.date);
  }
  if (a.date !== undefined && b.date === undefined) return -1;
  if (a.date === undefined && b.date !== undefined) return 1;
  return a.id.localeCompare(b.id);
}

/** Top-level directory of a content-root-relative path ("" for root files). */
function topDir(relativePath: string): string {
  const index = relativePath.indexOf("/");
  return index === -1 ? "" : relativePath.slice(0, index);
}

function sectionTitle(dir: string): string {
  return dir
    .split(/[-_]+/)
    .filter((part) => part.length > 0)
    .map((part) => (/^[A-Z0-9]+$/.test(part) ? part : part[0]!.toUpperCase() + part.slice(1)))
    .join(" ");
}

function buildSections(pageDocs: readonly CanonicalDocument[]): SiteSection[] {
  const byDir = new Map<string, CanonicalDocument[]>();
  for (const doc of pageDocs) {
    const dir = topDir(doc.relativePath);
    const list = byDir.get(dir) ?? [];
    list.push(doc);
    byDir.set(dir, list);
  }
  const sections: SiteSection[] = [];
  const ordered = [...byDir.entries()].sort((a, b) =>
    sectionTitle(a[0]).localeCompare(sectionTitle(b[0])),
  );
  for (const [dir, docs] of ordered) {
    const indexDoc = docs.find((doc) => doc.id === dir);
    sections.push({
      id: dir === "" ? "general" : dir,
      title: dir === "" ? "General" : sectionTitle(dir),
      ...(indexDoc !== undefined ? { route: indexDoc.route } : {}),
      pageIds: docs.map((doc) => doc.id),
    });
  }
  return sections;
}

function sectionIdFor(
  doc: CanonicalDocument,
  sections: readonly SiteSection[],
): string | undefined {
  const dir = topDir(doc.relativePath);
  return sections.find((s) => s.id === (dir === "" ? "general" : dir))?.id;
}

function toSitePage(doc: CanonicalDocument, sectionId: string | undefined): SitePage {
  return {
    id: doc.id,
    route: doc.route,
    title: doc.title,
    description: doc.description,
    ...(sectionId !== undefined ? { sectionId } : {}),
    kind: doc.kind,
    body: doc.body,
    blocks: doc.blocks,
    headings: doc.headings,
    links: doc.links,
    assets: doc.assets,
    ...(doc.date !== undefined ? { date: doc.date } : {}),
    metadata: {
      sourcePath: doc.sourcePath,
      wordCount: doc.wordCount,
      readingTimeMinutes: doc.readingTimeMinutes,
    },
  };
}

function toBlogPost(doc: CanonicalDocument): BlogPost {
  return {
    id: doc.id,
    route: doc.route,
    title: doc.title,
    description: doc.description,
    ...(doc.date !== undefined ? { date: doc.date } : {}),
    ...(doc.author !== undefined ? { author: doc.author } : {}),
    body: doc.body,
    blocks: doc.blocks,
    headings: doc.headings,
    links: doc.links,
    metadata: {
      sourcePath: doc.sourcePath,
      wordCount: doc.wordCount,
      readingTimeMinutes: doc.readingTimeMinutes,
    },
  };
}

/**
 * Frontmatter `search: false` opts a document out of the search index.
 * Everything else is searchable; the rule is explicit and documented.
 */
function isSearchable(doc: CanonicalDocument): boolean {
  return (doc.frontmatter as Record<string, unknown>)["search"] !== false;
}

/**
 * Synthesize the Blog listing page from post metadata (titles, routes,
 * dates, authors, descriptions only — no invented copy). Returns undefined
 * when there are no posts or the author claimed `/blog` themselves
 * (user-authored route always wins).
 */
function buildBlogListing(
  blog: readonly BlogPost[],
  blogRouteClaimed: boolean,
): SitePage | undefined {
  if (blog.length === 0 || blogRouteClaimed) return undefined;
  const items = blog.map((post) => {
    const segments = [`[${post.title}](${post.route})`];
    if (post.date !== undefined) segments.push(post.date);
    if (post.author !== undefined) segments.push(`by ${post.author}`);
    if (post.description.length > 0) segments.push(post.description);
    return segments.join(" — ");
  });
  const body = items.map((item) => `- ${item}`).join("\n");
  return {
    id: "blog",
    route: "/blog",
    title: "Blog",
    description: "",
    sectionId: "blog",
    kind: "documentation",
    body: `${body}\n`,
    blocks: [{ kind: "list", ordered: false, items }],
    headings: [],
    links: [],
    assets: [],
    metadata: { wordCount: body.split(/\s+/).length, readingTimeMinutes: 1 },
  };
}

function buildNavigation(
  home: SitePage | undefined,
  sections: readonly SiteSection[],
  pages: readonly SitePage[],
  blog: readonly BlogPost[],
  listing: SitePage | undefined,
): SiteNavigation {
  const items: SiteNavItem[] = [];
  if (home !== undefined) {
    items.push({ kind: "link", title: home.title, route: home.route });
  }
  const byId = new Map(pages.map((page) => [page.id, page] as const));
  for (const section of sections) {
    // Directory index page, if it belongs to this section.
    const indexPage =
      section.route !== undefined && section.pageIds.includes(section.id)
        ? byId.get(section.id)
        : undefined;
    const children: SiteNavItem[] = [];
    for (const pageId of section.pageIds) {
      if (indexPage !== undefined && pageId === indexPage.id) continue;
      const page = byId.get(pageId);
      if (page === undefined) continue;
      children.push({ kind: "link", title: page.title, route: page.route });
    }
    if (children.length === 0 && indexPage === undefined) continue;
    items.push({
      kind: "section",
      title: section.title,
      ...(section.route !== undefined ? { route: section.route } : {}),
      children:
        indexPage !== undefined
          ? [{ kind: "link", title: indexPage.title, route: indexPage.route }, ...children]
          : children,
    });
  }
  if (blog.length > 0) {
    const children: SiteNavItem[] = [];
    if (listing !== undefined) {
      children.push({ kind: "link", title: listing.title, route: listing.route });
    }
    for (const post of blog) {
      children.push({ kind: "link", title: post.title, route: post.route });
    }
    items.push({
      kind: "section",
      title: "Blog",
      ...(listing !== undefined ? { route: listing.route } : {}),
      children,
    });
  }
  return { items };
}

function buildSearch(
  home: SitePage | undefined,
  pages: readonly SitePage[],
  blog: readonly BlogPost[],
  sections: readonly SiteSection[],
  searchable: ReadonlySet<string>,
): SiteSearchDocument[] {
  const sectionTitleOf = new Map<string, string>();
  for (const page of pages) {
    if (page.sectionId !== undefined) {
      const section = sections.find((s) => s.id === page.sectionId);
      if (section !== undefined) sectionTitleOf.set(page.id, section.title);
    }
  }
  const entries: SiteSearchDocument[] = [];
  if (home !== undefined && searchable.has(home.id)) {
    entries.push({
      id: home.id,
      title: home.title,
      description: home.description,
      route: home.route,
      content: blocksToSearchText(home.blocks).slice(0, SEARCH_CONTENT_LIMIT),
      section: "Home",
    });
  }
  for (const page of pages) {
    if (!searchable.has(page.id)) continue;
    entries.push({
      id: page.id,
      title: page.title,
      description: page.description,
      route: page.route,
      content: blocksToSearchText(page.blocks).slice(0, SEARCH_CONTENT_LIMIT),
      section: sectionTitleOf.get(page.id) ?? (page.sectionId === "blog" ? "Blog" : ""),
    });
  }
  for (const post of blog) {
    if (!searchable.has(post.id)) continue;
    entries.push({
      id: post.id,
      title: post.title,
      description: post.description,
      route: post.route,
      content: blocksToSearchText(post.blocks).slice(0, SEARCH_CONTENT_LIMIT),
      section: "Blog",
    });
  }
  return entries;
}

/** Deduplicate assets by source (first occurrence wins; input order is deterministic). */
function dedupeAssets(
  assets: readonly CanonicalDocument["assets"][number][],
): CanonicalDocument["assets"][number][] {
  const seen = new Set<string>();
  const out: CanonicalDocument["assets"][number][] = [];
  for (const asset of assets) {
    if (seen.has(asset.source)) continue;
    seen.add(asset.source);
    out.push(asset);
  }
  return out;
}
