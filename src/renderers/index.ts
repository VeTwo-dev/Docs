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

// ─── Next.js runtime ─────────────────────────────────────────────────────
export type { NextJsRendererOptions } from "./nextjs/adapter.js";
export { createNextJsRenderer, renderNextJsSite } from "./nextjs/adapter.js";
export { buildRouteManifest, normalizeBasePath } from "./nextjs/manifest.js";
export { generateScaffold, generatedTypesFile } from "./nextjs/scaffold.js";
export type { ScaffoldInput, GeneratedPageData } from "./nextjs/scaffold.js";

// ─── Markdown renderer (owns md/) ────────────────────────────────────────
export type { MarkdownRendererOptions } from "./markdown/renderer.js";
export { createMarkdownRenderer, renderMarkdownSite } from "./markdown/renderer.js";

// ─── Static HTML renderer (owns static/) ─────────────────────────────────
export type { StaticRendererOptions } from "./static/renderer.js";
export { createStaticRenderer, renderStaticSite } from "./static/renderer.js";

// ─── Output plan + link resolver (renderer-independent) ──────────────────
export type {
  DocumentationOutputPlan,
  PlannedPage,
  PlannedNavNode,
  OutputTarget,
  LinkRenderer,
} from "./output-plan.js";
export { buildOutputPlan, resolveDocumentationLink, relativePath } from "./output-plan.js";

// ─── Asset registry ──────────────────────────────────────────────────────
export type { PlannedAsset, AssetPlan } from "./assets.js";
export { discoverImageSources } from "./assets.js";

// ─── Filesystem writer (the only impure step) ─────────────────────────────
export { writeRenderedSite } from "./writer.js";

// ─── Legacy HTML renderer (pre-IR) ───────────────────────────────────────
export { createHtmlRenderer } from "../renderer/index.js";
export type { Renderer } from "../renderer/index.js";
export { createDefaultTemplate } from "../renderer/template.js";
