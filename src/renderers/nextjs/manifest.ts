/**
 * Next.js Route Manifest.
 *
 * Maps IR pages to URL routes from the IR navigation (never filesystem
 * order), producing the routing model the generated App Router consumes.
 */

import type { DocumentationIR } from "../../documentation/compiler/ir.js";
import type { SiteRoute } from "../types.js";
import { buildOutputPlan } from "../output-plan.js";

/** Normalize a docs base path: "" or leading-slash, no trailing slash. */
export function normalizeBasePath(basePath: string | undefined): string {
  const base = basePath ?? "/docs";
  if (base === "/" || base === "") return "";
  return `/${base.replace(/^\/+|\/+$/g, "")}`;
}

/**
 * Build the route manifest: one route per IR page.
 * Split children keep their hierarchy in the URL (`parent/child`).
 *
 * Delegates to the canonical output plan — this module is the single route
 * authority shared by all renderers (no duplicated route derivation).
 */
export function buildRouteManifest(
  ir: DocumentationIR,
  options: { readonly docsBasePath?: string } = {},
): readonly SiteRoute[] {
  const plan = buildOutputPlan(ir, { workspaceRoot: "", docsBasePath: options.docsBasePath });
  return plan.pages.map((p) => ({
    slug: p.slug,
    route: p.route,
    title: p.title,
    sectionId: p.sectionId,
    sectionTitle: p.sectionTitle,
  }));
}
