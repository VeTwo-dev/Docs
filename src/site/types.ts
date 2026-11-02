/**
 * Canonical site model contracts (Phase 4).
 *
 * The canonical pipeline turns user Markdown/MDX into normalized
 * {@link CanonicalDocument}s and, from them, a deterministic
 * {@link DocumentationSite}: one home page, documentation sections, blog
 * posts, navigation, search records, assets and metadata. These types are
 * content-only — no source-code intelligence participates.
 */

import type { IRBlock } from "../documentation/compiler/ir.js";
import type { Heading } from "../types/public.js";

/** Classification of a canonical document, derived from its route and frontmatter. */
export type CanonicalPageKind = "home" | "blog" | "documentation";

/** A normalized internal or external link discovered in a document body. */
export interface CanonicalLink {
  /** Visible link text (from the rendered Markdown source). */
  readonly text: string;
  /** Href exactly as authored (slashes normalized, leading `./` stripped). */
  readonly url: string;
  /** True for absolute, anchor, `data:` and `mailto:` links. */
  readonly isExternal: boolean;
  /** Content-root-relative slug for internal `.md`/`.mdx` links. */
  readonly target?: string;
}

/** An image or embedded asset referenced by a document. */
export interface ContentAsset {
  /** Location as authored (slashes normalized, leading `./` stripped). */
  readonly source: string;
  /** Alternative text (empty string when absent). */
  readonly alt: string;
  /** Optional title. */
  readonly title?: string;
  /** True when the asset is not an absolute/remote URL. */
  readonly local: boolean;
}

/** A fully normalized user documentation source file. */
export interface CanonicalDocument {
  /** Content-root-relative slug (`guide/index` → `guide`). */
  readonly id: string;
  /** Absolute path to the source file. */
  readonly sourcePath: string;
  /** Content-root-relative POSIX path including extension. */
  readonly relativePath: string;
  /** Site route (`/`, `/guide`). */
  readonly route: string;
  readonly kind: CanonicalPageKind;
  readonly title: string;
  readonly description: string;
  /** Merged frontmatter (known + unknown keys). */
  readonly frontmatter: Readonly<Record<string, unknown>>;
  /** Normalized Markdown body. */
  readonly body: string;
  readonly blocks: readonly IRBlock[];
  readonly headings: readonly Heading[];
  readonly links: readonly CanonicalLink[];
  readonly assets: readonly ContentAsset[];
  /** Sidebar/order weight; defaults to 0. */
  readonly order: number;
  /** Author passthrough, present only when authored. */
  readonly author?: string;
  /** ISO `YYYY-MM-DD` publication date, present only when authored. */
  readonly date?: string;
  readonly wordCount: number;
  readonly readingTimeMinutes: number;
}

/** Options controlling canonical content discovery. */
export interface DiscoverContentOptions {
  /** Extra glob patterns (content-root-relative) to ignore. */
  readonly ignore?: readonly string[];
  /** Enable GitHub-Flavored Markdown (default true). */
  readonly gfm?: boolean;
  /** Directory whose documents are treated as blog posts (default `blog`). */
  readonly blogDir?: string;
}

/** Options controlling site model construction. */
export interface BuildSiteOptions {
  /** Short site name, used in metadata. */
  readonly siteName: string;
  /** Full site title. */
  readonly title: string;
  readonly description: string;
  /** Canonical base URL. */
  readonly baseUrl?: string;
  /** Repository URL. */
  readonly github?: string;
  /** Logo URL or path. */
  readonly logo?: string;
}

/** Per-page provenance and statistics. */
export interface SitePageMetadata {
  /** Absolute source path when known. */
  readonly sourcePath?: string;
  readonly wordCount: number;
  readonly readingTimeMinutes: number;
}

/** A routable non-blog page in the site model. */
export interface SitePage {
  readonly id: string;
  readonly route: string;
  readonly title: string;
  readonly description: string;
  /** Owning section id (absent for the home page). */
  readonly sectionId?: string;
  readonly kind: CanonicalPageKind;
  readonly body: string;
  readonly blocks: readonly IRBlock[];
  readonly headings: readonly Heading[];
  readonly links: readonly CanonicalLink[];
  readonly assets: readonly ContentAsset[];
  readonly date?: string;
  readonly metadata: SitePageMetadata;
}

/** A blog post in the site model. */
export interface BlogPost {
  readonly id: string;
  readonly route: string;
  readonly title: string;
  readonly description: string;
  readonly date?: string;
  readonly author?: string;
  readonly body: string;
  readonly blocks: readonly IRBlock[];
  readonly headings: readonly Heading[];
  readonly links: readonly CanonicalLink[];
  readonly metadata: SitePageMetadata;
}

/** A top-level documentation section (a directory). */
export interface SiteSection {
  readonly id: string;
  readonly title: string;
  /** Route of the section's index page, when one exists. */
  readonly route?: string;
  readonly pageIds: readonly string[];
}

/** A navigation entry: either a link or a titled section. */
export type SiteNavItem = SiteNavLink | SiteNavSection;

/** A leaf navigation link. */
export interface SiteNavLink {
  readonly kind: "link";
  readonly title: string;
  readonly route: string;
  /** True for links that leave the site (rendered non-routable). */
  readonly external?: boolean;
}

/** A titled navigation section with children. */
export interface SiteNavSection {
  readonly kind: "section";
  readonly title: string;
  readonly route?: string;
  readonly children: readonly SiteNavItem[];
}

/** The site navigation tree. */
export interface SiteNavigation {
  readonly items: readonly SiteNavItem[];
}

/** A canonical search index record. */
export interface SiteSearchDocument {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly route: string;
  readonly content: string;
  readonly section: string;
}

/** Site-level metadata. */
export interface SiteMetadata {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly url?: string;
  readonly github?: string;
  readonly logo?: string;
}

/** The complete canonical site model. */
export interface DocumentationSite {
  readonly home?: SitePage;
  readonly sections: readonly SiteSection[];
  readonly pages: readonly SitePage[];
  readonly blog: readonly BlogPost[];
  readonly navigation: SiteNavigation;
  readonly search: readonly SiteSearchDocument[];
  readonly assets: readonly ContentAsset[];
  readonly metadata: SiteMetadata;
}
