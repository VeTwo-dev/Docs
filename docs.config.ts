import { defineDocs } from "@vetwo/docs/config";

/**
 * Self-documentation configuration for @vetwo/docs.
 *
 * @vetwo/docs documents itself with the exact same public pipeline every
 * project uses: authored Markdown under `./md` → discovery → normalization →
 * site model → Documentation IR → Markdown / static HTML / Fumadocs + Next.js.
 * There is no hardcoded self-path: the canonical content pipeline is the sole
 * source of truth.
 */
export default defineDocs({
  title: "@vetwo/docs — Documentation Engine",
  description:
    "The easiest and most powerful documentation generator for JavaScript and TypeScript — now documenting itself.",
  source: "./md",
  // Self-documentation now dogfoods the content-first canonical pipeline:
  // the authored Markdown corpus under ./md is the single source of truth.
  content: { pipeline: "canonical" },
  output: {
    directory: "./docs",
    // Full workspace: canonical Markdown pages, a portable static HTML site,
    // and a real Fumadocs + Next.js site — all materialized from ./md.
    layout: { next: false, markdown: true, static: true, site: true },
  },
  baseUrl: "https://vetwo.github.io/Docs/",
  // The VeTwo visual identity lives in the persistent design sources
  // (design/tokens.css — created by `docs init`, never regenerated).
  // Explicit values here act as documented overrides pinned on top:
  // theme: { colors: { accent: "#..." } }.
  theme: {
    name: "vetwo",
  },
  api: {
    // The canonical content pipeline derives everything from `./md`; the
    // source-code API extractor belongs to the legacy knowledge path.
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
    // Plain-Markdown pages (`docs/md/**/*.md`, no JSX components).
    extension: ".md",
  },
  architecture: {
    // No forced exclusions — planner evidence-gates sections (installation, quick-start, architecture, etc.)
  },
});
