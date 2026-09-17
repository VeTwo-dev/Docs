import type { Plugin } from "../types/internal.js";

/** Visual theme configuration for the generated documentation site. */
export interface ThemeConfig {
  readonly name: string;
  readonly colors?: {
    readonly primary?: string;
    readonly secondary?: string;
    readonly background?: string;
    readonly surface?: string;
    readonly text?: string;
    readonly muted?: string;
    readonly accent?: string;
  };
  readonly fonts?: {
    readonly heading?: string;
    readonly body?: string;
    readonly code?: string;
  };
  readonly logo?: string;
  readonly favicon?: string;
  readonly cssOverrides?: string;
}

/** Top-level navigation bar configuration. */
export interface NavConfig {
  readonly items: ReadonlyArray<{
    readonly label: string;
    readonly href: string;
    readonly items?: ReadonlyArray<{
      readonly label: string;
      readonly href: string;
    }>;
  }>;
}

/** Sidebar configuration, supporting auto-generation or manual groups. */
export interface SidebarConfig {
  readonly auto: boolean;
  readonly groups: ReadonlyArray<{
    readonly title: string;
    readonly items: ReadonlyArray<string>;
  }>;
  readonly collapsed: boolean;
}

/** SEO metadata configuration. */
export interface SeoConfig {
  readonly title?: string;
  readonly description?: string;
  readonly image?: string;
  readonly url?: string;
  readonly twitter?: string;
}

/** RSS feed options. */
export interface RssOptions {
  readonly title?: string;
  readonly description?: string;
  readonly link?: string;
  readonly language?: string;
}

/** Search index configuration. */
export interface SearchConfig {
  readonly enabled: boolean;
  readonly engine: "minisearch" | "pagefind";
  readonly indexFields: readonly string[];
  readonly maxResults: number;
}

/** Multi-version documentation configuration. */
export interface VersioningConfig {
  readonly enabled: boolean;
  readonly current: string;
  readonly versions: readonly string[];
}

/** Monorepo workspace configuration. */
export interface MonorepoConfig {
  readonly root: string;
}

/**
 * Output layout configuration for the documentation workspace.
 *
 * When `output` is given as an object, the documentation workspace is
 * prepared as a set of dedicated sub-directories (`next/`, `md/`, `static/`)
 * under {@link OutputLayoutConfig.directory}. Only layouts enabled here are
 * created during `docs init`.
 */
export interface OutputLayoutConfig {
  /** Directory that holds the documentation workspace (e.g. `docs`, `wiki`). */
  readonly directory: string;
  /** Which output layouts to prepare inside the workspace. */
  readonly layout: {
    /** Prepare a Next.js documentation application under `next/`. */
    readonly next: boolean;
    /** Prepare a canonical Markdown/MDX workspace under `md/`. */
    readonly markdown: boolean;
    /** Prepare a static output workspace under `static/`. */
    readonly static: boolean;
  };
}

/** Location of the AI documentation skill file. */
export interface AgentSkillConfig {
  /** Path to the skill file, relative to the project root. */
  readonly path: string;
}

/** AI documentation agent configuration. */
export interface AgentConfig {
  /** Whether the AI documentation agent workspace is enabled. */
  readonly enabled: boolean;
  /** The agent skill file configuration. */
  readonly skill: AgentSkillConfig;
}

/** AI provider configuration. */
export interface AIProviderEntry {
  /** Provider ID (e.g. "openwiki", "openai"). */
  readonly id: string;
  /** Whether this provider is the default. */
  readonly default?: boolean;
  /** Provider-specific configuration (API keys, base URLs, etc.). */
  readonly config?: Record<string, unknown>;
}

/** AI documentation system configuration. */
export interface AIConfig {
  /** Whether the AI system is enabled. */
  readonly enabled: boolean;
  /** Available AI providers. */
  readonly providers: readonly AIProviderEntry[];
  /** Provider fallback chain order (provider IDs). */
  readonly fallbackChain?: readonly string[];
  /** Default audience for AI-generated documentation. */
  readonly defaultAudience?: string;
  /** Default voice for AI-generated documentation. */
  readonly defaultVoice?: string;
  /** Maximum revision iterations per page. */
  readonly maxRevisions?: number;
  /** Quality score threshold to accept generated pages. */
  readonly acceptThreshold?: number;
}

/** User overrides for the inferred documentation architecture.
 *  Priority: inferred defaults → project configuration → explicit user overrides. */
export interface ArchitectureConfig {
  /** Enable/disable or rename inferred sections (keyed by section id). */
  readonly sections?: Readonly<Record<string, { enabled?: boolean; title?: string }>>;
  /** Page slugs to exclude from the compiled architecture. */
  readonly excludePages?: readonly string[];
}

/** Custom MDX documentation components (name → module path). */
export type ComponentsConfig = Readonly<Record<string, string>>;

/** The fully resolved documentation configuration. */
export interface DocsConfig {
  readonly title: string;
  readonly description: string;
  readonly source: string;
  /** Output directory or a full output-layout workspace configuration. */
  readonly output: string | OutputLayoutConfig;
  readonly baseUrl: string;
  readonly theme: string | ThemeConfig;
  readonly nav: NavConfig | undefined;
  readonly sidebar: SidebarConfig;
  readonly seo: SeoConfig;
  readonly search: SearchConfig;
  readonly versioning: VersioningConfig;
  readonly monorepo: boolean | MonorepoConfig;
  readonly sitemap: boolean;
  readonly rss: boolean;
  readonly rssOptions: RssOptions;
  readonly robots: boolean;
  readonly og: boolean;
  readonly watch: boolean;
  readonly clean: boolean;
  readonly cache: boolean;
  readonly ignore: readonly string[];
  readonly include: readonly string[];
  readonly rehypePlugins: readonly string[];
  readonly remarkPlugins: readonly string[];
  readonly plugins: readonly Plugin[];
  readonly markdown: MarkdownConfig;
  readonly api: ApiConfig;
  /** AI documentation agent configuration. */
  readonly agent: AgentConfig;
  /** AI documentation system configuration. */
  readonly ai: AIConfig;
  /** User overrides for the inferred documentation architecture. */
  readonly architecture: ArchitectureConfig;
  /** Custom MDX documentation components. */
  readonly components: ComponentsConfig;
}

/** Markdown processing configuration. */
export interface MarkdownConfig {
  readonly gfm: boolean;
  readonly breaks: boolean;
  readonly pedantic: boolean;
  readonly headerIds: boolean;
  readonly toc: boolean;
  readonly tocDepth: number;
  readonly syntaxHighlighting: boolean;
  readonly mdx: boolean;
  readonly smartypants: boolean;
  readonly raw: boolean;
  readonly document: boolean;
  readonly lineHighlighting: boolean;
  readonly diffHighlighting: boolean;
  readonly focusRegions: boolean;
}

/** API documentation extraction configuration. */
export interface ApiConfig {
  readonly enabled: boolean;
  readonly source: string;
  readonly include: readonly string[];
  readonly exclude: readonly string[];
  readonly readme: boolean;
}

/** Partial user-provided configuration that is merged with defaults. */
export interface DocsConfigInput {
  readonly title?: string;
  readonly description?: string;
  readonly source?: string;
  /** Output directory, or a full output-layout workspace configuration. */
  readonly output?: string | OutputLayoutConfig;
  readonly baseUrl?: string;
  readonly theme?: string | ThemeConfig;
  readonly nav?: NavConfig;
  readonly sidebar?: Partial<SidebarConfig>;
  readonly seo?: Partial<SeoConfig>;
  readonly search?: Partial<SearchConfig>;
  readonly versioning?: Partial<VersioningConfig>;
  readonly monorepo?: boolean | MonorepoConfig;
  readonly sitemap?: boolean;
  readonly rss?: boolean;
  readonly rssOptions?: Partial<RssOptions>;
  readonly robots?: boolean;
  readonly og?: boolean;
  readonly watch?: boolean;
  readonly clean?: boolean;
  readonly cache?: boolean;
  readonly ignore?: readonly string[];
  readonly include?: readonly string[];
  readonly rehypePlugins?: readonly string[];
  readonly remarkPlugins?: readonly string[];
  readonly plugins?: readonly Plugin[];
  readonly markdown?: Partial<MarkdownConfig>;
  readonly api?: Partial<ApiConfig>;
  /** AI documentation agent configuration. */
  readonly agent?: Partial<AgentConfig>;
  /** AI documentation system configuration. */
  readonly ai?: Partial<AIConfig>;
  /** User overrides for the inferred documentation architecture. */
  readonly architecture?: Partial<ArchitectureConfig>;
  /** Custom MDX documentation components (name → module path). */
  readonly components?: ComponentsConfig;
}
