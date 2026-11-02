/**
 * Documentation Site Renderers.
 *
 * Renderers consume the versioned Documentation IR and produce complete
 * static sites. The IR is the only input — no source analysis, project
 * intelligence, AI providers, or compiler access.
 */

// ─── Contracts ───────────────────────────────────────────────────────────
export type {
  RenderedFile,
  RenderedSite,
  SiteRoute,
  SiteRenderer,
  SiteRendererOptions,
} from "./types.js";

// ─── MDX serializer ──────────────────────────────────────────────────────
export { serializeBlock, serializeBlocks, serializeFrontmatter, serializePage } from "./mdx.js";

// ─── API custom blocks → plain Markdown (shared by md + Fumadocs) ─────────
export { escCell, renderCustomMarkdown, KNOWN_API_COMPONENTS } from "./api-markdown.js";

// ─── Next.js runtime (compatibility) ─────────────────────────────────────
// Custom App Router implementation. Retained for the `docs render
// --target nextjs` CLI contract, the `layout.next` workspace output, the
// public renderer API, and generated-template stability — new Next.js
// documentation sites should prefer the canonical Fumadocs renderer below.
export type { NextJsRendererOptions } from "./nextjs/adapter.js";
export { createNextJsRenderer, renderNextJsSite } from "./nextjs/adapter.js";
export { buildRouteManifest, normalizeBasePath } from "./nextjs/manifest.js";
export { generateScaffold, generatedTypesFile } from "./nextjs/scaffold.js";
export type { ScaffoldInput, GeneratedPageData } from "./nextjs/scaffold.js";

// ─── Markdown renderer (owns md/) ────────────────────────────────────────
export type { MarkdownRendererOptions } from "./markdown/renderer.js";
export {
  createMarkdownRenderer,
  renderMarkdownSite,
  toPlainMarkdown,
} from "./markdown/renderer.js";

// ─── Static HTML renderer (owns static/) ─────────────────────────────────
export type { StaticRendererOptions } from "./static/renderer.js";
export { createStaticRenderer, renderStaticSite } from "./static/renderer.js";

// ─── Fumadocs renderer (owns site/) ──────────────────────────────────────
// PRIMARY canonical Next.js documentation renderer. Generates a real
// Fumadocs + Next.js project; Fumadocs owns all page runtime, navigation
// UI, search UI and theming. This module only compiles IR content +
// metadata into that project.
export type { FumadocsRendererOptions } from "./fumadocs/renderer.js";
export {
  createFumadocsRenderer,
  renderFumadocsSite,
  toFumadocsMarkdown,
} from "./fumadocs/renderer.js";
export type { GraphData, GraphNode, GraphEdge } from "./fumadocs/graph.js";
export { buildGraphData } from "./fumadocs/graph.js";

// ─── Output plan + link resolver (renderer-independent) ──────────────────
export type {
  DocumentationOutputPlan,
  PlannedPage,
  PlannedNavNode,
  OutputTarget,
  LinkRenderer,
} from "./output-plan.js";
export {
  buildOutputPlan,
  planRoutes,
  relatedPageTargets,
  resolveDocumentationLink,
  relativePath,
} from "./output-plan.js";
export type { RelatedPageTarget } from "./output-plan.js";

// ─── Asset registry ──────────────────────────────────────────────────────
export type { PlannedAsset, AssetPlan } from "./assets.js";
export { discoverImageSources } from "./assets.js";

// ─── Filesystem writer (the only impure step) ─────────────────────────────
export { writeRenderedSite, writeSiteFiles } from "./writer.js";

// ─── Legacy HTML renderer (pre-IR) ───────────────────────────────────────
export { createHtmlRenderer } from "../renderer/index.js";
export type { Renderer } from "../renderer/index.js";
export { createDefaultTemplate } from "../renderer/template.js";
