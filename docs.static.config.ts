import { defineDocs } from "@vetwo/docs/config";

/**
 * Static-only self-documentation configuration for @vetwo/docs.
 *
 * Same authored corpus (`./md`, canonical pipeline) as `docs.config.ts`, but
 * materialized as a portable static HTML site only — used by
 * `pnpm docs:static:build`. Kept in a separate output directory so building
 * the static target never sweeps the Markdown or Fumadocs workspaces.
 */
export default defineDocs({
  title: "@vetwo/docs — Documentation Engine",
  description:
    "The easiest and most powerful documentation generator for JavaScript and TypeScript — now documenting itself.",
  source: "./md",
  content: { pipeline: "canonical" },
  output: {
    directory: "./docs-static",
    layout: { next: false, markdown: false, static: true, site: false },
  },
  baseUrl: "https://vetwo.github.io/Docs/",
  theme: {
    name: "default",
    // No colors/font overrides: the static self-hosting output uses the
    // canonical adaptive VeTwo tokens (design/tokens.css). Declarative
    // overrides via `theme.colors`/`theme.fonts` remain available — see
    // design/README.md.
  },
  api: {
    enabled: false,
    source: "./src",
    include: ["src/**/*.ts"],
    exclude: ["**/*.test.*", "**/*.spec.*", "**/*.d.ts", "**/__tests__/**"],
    readme: true,
  },
  search: {
    enabled: true,
    engine: "minisearch",
    indexFields: ["title", "content", "category"],
    maxResults: 20,
  },
  sitemap: true,
  robots: true,
  og: true,
  cache: true,
  markdown: {
    gfm: true,
    toc: true,
    syntaxHighlighting: true,
    mdx: true,
    extension: ".md",
  },
});
