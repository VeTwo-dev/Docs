import type { AgentConfig, DocsConfig, DocsConfigInput, OutputLayoutConfig } from "./types.js";
import {
  DEFAULT_SOURCE_DIR,
  DEFAULT_OUTPUT_DIR,
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
  DEFAULT_IGNORE_PATTERNS,
} from "../constants/defaults.js";
import { defu } from "defu";

const DEFAULT_AGENT_CONFIG: AgentConfig = {
  enabled: false,
  skill: {
    path: "agent/skill.md",
  },
};

/** The default output-layout workspace configuration. */
export const DEFAULT_OUTPUT_LAYOUT: OutputLayoutConfig = {
  directory: "docs",
  layout: {
    next: true,
    markdown: true,
    static: true,
  },
};

const DEFAULT_CONFIG: DocsConfig = {
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  source: DEFAULT_SOURCE_DIR,
  output: DEFAULT_OUTPUT_DIR,
  baseUrl: "/",
  theme: "default",
  nav: undefined,
  sidebar: {
    auto: true,
    groups: [],
    collapsed: false,
  },
  seo: {},
  search: {
    enabled: true,
    engine: "minisearch",
    indexFields: ["title", "content", "category"],
    maxResults: 20,
  },
  versioning: {
    enabled: false,
    current: "latest",
    versions: [],
  },
  monorepo: false,
  sitemap: true,
  rss: false,
  rssOptions: {},
  robots: true,
  og: true,
  watch: false,
  clean: true,
  cache: true,
  ignore: [...DEFAULT_IGNORE_PATTERNS],
  include: [],
  rehypePlugins: [],
  remarkPlugins: [],
  plugins: [],
  markdown: {
    gfm: true,
    breaks: false,
    pedantic: false,
    headerIds: true,
    toc: true,
    tocDepth: 3,
    syntaxHighlighting: true,
    mdx: false,
    smartypants: false,
    raw: false,
    document: false,
    lineHighlighting: false,
    diffHighlighting: false,
    focusRegions: false,
  },
  api: {
    enabled: false,
    source: "./src",
    include: [],
    exclude: ["**/*.test.*", "**/*.spec.*", "**/*.d.ts"],
    readme: true,
  },
  agent: DEFAULT_AGENT_CONFIG,
  ai: {
    enabled: false,
    providers: [],
    fallbackChain: [],
    defaultAudience: "developer",
    defaultVoice: "neutral",
    maxRevisions: 3,
    acceptThreshold: 0.7,
  },
  architecture: {
    sections: {},
    excludePages: [],
  },
  components: {},
};

const ARRAY_KEYS: readonly string[] = [
  "ignore",
  "include",
  "rehypePlugins",
  "remarkPlugins",
  "plugins",
];

/**
 * Creates a fully resolved {@link DocsConfig} by merging the user-provided input with sensible defaults.
 *
 * Uses `defu` for deep merging — later user values take priority while
 * missing nested keys are filled from defaults. Explicitly provided arrays
 * (including empty ones) always take precedence.
 *
 * @param input - Partial configuration object supplied by the user (all fields are optional).
 * @returns A frozen, fully resolved documentation configuration.
 *
 * @example
 * ```ts
 * const config = defineDocs({
 *   title: "My API Docs",
 *   description: "Documentation for my project",
 *   source: "./docs",
 * });
 * ```
 */
export function defineDocs(input: DocsConfigInput = {}): DocsConfig {
  const cleaned = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );

  const config = defu(cleaned, DEFAULT_CONFIG) as unknown as DocsConfig;
  const mutable = config as unknown as Record<string, unknown>;

  // defu treats empty arrays as "empty" and won't override the default.
  // We need to explicitly apply any array values the user provided.
  for (const key of ARRAY_KEYS) {
    if (key in cleaned) {
      mutable[key] = (cleaned as Record<string, unknown>)[key];
    }
  }
  // Also handle nested array fields
  const nestedArrayKeys: Array<{ parent: string; key: string }> = [
    { parent: "search", key: "indexFields" },
    { parent: "versioning", key: "versions" },
    { parent: "api", key: "include" },
    { parent: "api", key: "exclude" },
    { parent: "ai", key: "providers" },
    { parent: "ai", key: "fallbackChain" },
    { parent: "architecture", key: "excludePages" },
  ];
  for (const { parent, key } of nestedArrayKeys) {
    const parentInput = (cleaned as Record<string, unknown>)[parent] as
      Record<string, unknown> | undefined;
    if (parentInput && key in parentInput) {
      const parentConfig = mutable[parent] as Record<string, unknown>;
      parentConfig[key] = parentInput[key];
    }
  }
  // Nested object fields whose partial values must replace, not merge with,
  // their defaults (otherwise `agent: { skill: { path } }` would keep a
  // default `enabled` that the user explicitly disabled).
  const nestedObjectKeys: Array<{ parent: string; key: string }> = [
    { parent: "agent", key: "skill" },
  ];
  for (const { parent, key } of nestedObjectKeys) {
    const parentInput = (cleaned as Record<string, unknown>)[parent] as
      Record<string, unknown> | undefined;
    const childInput = parentInput?.[key];
    if (childInput !== undefined && typeof childInput === "object" && childInput !== null) {
      const parentConfig = mutable[parent] as Record<string, unknown>;
      const current = parentConfig[key] as Record<string, unknown> | undefined;
      parentConfig[key] = { ...(current ?? {}), ...(childInput as Record<string, unknown>) };
    }
  }

  return Object.freeze(config);
}
