/**
 * Documentation Site Renderer Contracts.
 *
 * Renderers consume the versioned Documentation IR and produce a complete
 * static site description. They never see source code, project
 * intelligence, AI providers, or the compiler — the IR is the only input.
 *
 * Rendering is pure: `render` returns a file map. Filesystem access is an
 * explicit, separate step (`writeRenderedSite`).
 */

import type { DocumentationIR } from "../documentation/compiler/ir.js";

/** A single file in a rendered site (always POSIX-style paths). */
export interface RenderedFile {
  /** Path relative to the site root (e.g. `app/layout.tsx`). */
  readonly path: string;
  readonly contents: string;
}

/** One routable documentation page in the rendered site. */
export interface SiteRoute {
  /** IR page slug (e.g. `api/users`). */
  readonly slug: string;
  /** URL path within the site (e.g. `/docs/api/users`). */
  readonly route: string;
  readonly title: string;
  readonly sectionId: string;
  readonly sectionTitle: string;
}

/** The complete output of rendering an IR document. */
export interface RenderedSite {
  /** Renderer target id. */
  readonly target: "nextjs" | "static-html" | "markdown";
  /** All files of the site, ready to be written to disk. */
  readonly files: readonly RenderedFile[];
  /** Routable pages with their URL mapping. */
  readonly routes: readonly SiteRoute[];
  /** The file to treat as the site entrypoint for humans. */
  readonly entrypoint: string;
}

/** Shared renderer options. */
export interface SiteRendererOptions {
  /** Display name of the documentation site. */
  readonly siteName?: string;
  /** Site description used for metadata/SEO. */
  readonly description?: string;
  /** Base URL used for metadata/SEO. */
  readonly baseUrl?: string;
  /** Route prefix for doc pages (default `/docs`). */
  readonly docsBasePath?: string;
}

/**
 * A site renderer turns a Documentation IR into files.
 * Implementations must be pure and deterministic.
 */
export interface SiteRenderer<Options extends SiteRendererOptions = SiteRendererOptions> {
  readonly target: RenderedSite["target"];
  render(ir: DocumentationIR, options?: Options): RenderedSite;
}
