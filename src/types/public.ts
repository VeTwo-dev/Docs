import type { LIFECYCLE_HOOKS } from "../constants/defaults.js";

/** Supported package managers. */
export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

/** Describes the kind of project being documented. */
export type ProjectType = "library" | "application" | "monorepo" | "unknown";

/** Information about a workspace (monorepo root). */
export interface WorkspaceInfo {
  readonly name: string;
  readonly version: string;
  readonly path: string;
  readonly packageManager: PackageManager;
  readonly workspaces: ReadonlyArray<string>;
}

/** Information about an individual package. */
export interface PackageInfo {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly path: string;
  readonly main: string | undefined;
  readonly module: string | undefined;
  readonly types: string | undefined;
  readonly exports:
    Record<string, string | { import?: string; types?: string; require?: string }> | undefined;
  readonly files: readonly string[];
  /** Runtime dependencies (name → semver range). */
  readonly dependencies?: Readonly<Record<string, string>>;
  /** Development dependencies. */
  readonly devDependencies?: Readonly<Record<string, string>>;
  /** Peer dependencies. */
  readonly peerDependencies?: Readonly<Record<string, string>>;
  /** Optional dependencies. */
  readonly optionalDependencies?: Readonly<Record<string, string>>;
}

/** Represents a discovered source or documentation file. */
export interface SourceFile {
  readonly path: string;
  readonly relativePath: string;
  readonly extension: string;
  readonly size: number;
  readonly lastModified: Date;
  readonly content?: string;
}

/** A processed documentation page ready for rendering. */
export interface DocPage {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly slug: string;
  readonly filePath: string;
  readonly relativePath: string;
  readonly category: string;
  readonly order: number;
  readonly content: string;
  readonly frontmatter: Record<string, unknown>;
  readonly headings: readonly Heading[];
  readonly links: readonly PageLink[];
  readonly wordCount: number;
  readonly readingTimeMinutes: number;
  readonly lastModified: Date;
}

/** A heading extracted from a document. */
export interface Heading {
  readonly level: 1 | 2 | 3 | 4 | 5 | 6;
  readonly text: string;
  readonly id: string;
}

/** A link found in a document's content. */
export interface PageLink {
  readonly text: string;
  readonly url: string;
  readonly isExternal: boolean;
}

/** An item in the top navigation bar. */
export interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly items?: readonly NavItem[];
  readonly badge?: string;
  readonly external?: boolean;
}

/** An item in the sidebar. */
export interface SidebarItem {
  readonly label: string;
  readonly href?: string;
  readonly items?: readonly SidebarItem[];
  readonly collapsed?: boolean;
  readonly badge?: string;
}

/** A group of sidebar items under a shared title. */
export interface SidebarGroup {
  readonly title: string;
  readonly items: readonly SidebarItem[];
}

/** A single entry in the search index. */
export interface SearchEntry {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly url: string;
  readonly category: string;
}

/** The full search index containing all entries and a timestamp. */
export interface SearchIndex {
  readonly entries: readonly SearchEntry[];
  readonly generatedAt: string;
  readonly engine?: string;
}

/** A single API documentation entry extracted from source code. */
export interface ApiDocEntry {
  readonly name: string;
  readonly kind: "function" | "class" | "interface" | "type" | "variable" | "enum" | "module";
  readonly description: string;
  readonly signature: string;
  readonly parameters: readonly ApiParameter[];
  readonly returnType: string;
  readonly examples: readonly string[];
  readonly sourceFile: string;
  readonly since: string | undefined;
  readonly deprecated: boolean;
  readonly tags: readonly string[];
}

/** A parameter of an API entry. */
export interface ApiParameter {
  readonly name: string;
  readonly type: string;
  readonly description: string;
  readonly required: boolean;
  readonly defaultValue: string | undefined;
}

/** SEO metadata for a page, including Open Graph and Twitter card data. */
export interface SeoMetadata {
  readonly title: string;
  readonly description: string;
  readonly canonical: string;
  readonly openGraph: OpenGraphMetadata;
  readonly twitter: TwitterMetadata;
}

/** Open Graph protocol metadata for social sharing. */
export interface OpenGraphMetadata {
  readonly title: string;
  readonly description: string;
  readonly url: string;
  readonly image: string;
  readonly type: string;
}

/** Twitter Card metadata for social sharing. */
export interface TwitterMetadata {
  readonly card: string;
  readonly title: string;
  readonly description: string;
  readonly image: string;
}

/** A single entry in the sitemap. */
export interface SitemapEntry {
  readonly url: string;
  readonly lastModified: Date;
  readonly changeFrequency:
    "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  readonly priority: number;
}

/** A single entry in the RSS feed. */
export interface RssEntry {
  readonly title: string;
  readonly link: string;
  readonly description: string;
  readonly pubDate: Date;
  readonly guid: string;
}

/** A valid lifecycle hook name derived from the `LIFECYCLE_HOOKS` constant. */
export type LifecycleHookName = (typeof LIFECYCLE_HOOKS)[number];
