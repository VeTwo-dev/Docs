import { defineDocs } from "@vetwo/docs/config";

/**
 * Self-documentation configuration for @vetwo/docs.
 *
 * This file makes @vetwo/docs document itself using the exact same
 * public pipeline (`npx docs generate` → Project Knowledge → Planner →
 * Documentation IR → Markdown/Next.js/Static). No hardcoded self-path exists;
 * the engine discovers identity, purpose, API, CLI, architecture, etc. from
 * deterministic sources (package.json, README, source, symbols).
 */
export default defineDocs({
  title: "@vetwo/docs — Documentation Engine",
  description:
    "The easiest and most powerful documentation generator for JavaScript and TypeScript — now documenting itself.",
  source: "./src",
  output: {
    directory: "./docs",
    layout: { next: true, markdown: true, static: true },
  },
  baseUrl: "https://vetwo.github.io/Docs/",
  theme: {
    name: "default",
    colors: { primary: "#2563eb", accent: "#7c3aed" },
  },
  api: {
    enabled: true,
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
  markdown: { gfm: true, toc: true, syntaxHighlighting: true, mdx: true },
  architecture: {
    // No forced exclusions — planner evidence-gates sections (installation, quick-start, architecture, etc.)
  },
});
