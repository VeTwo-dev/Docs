/**
 * Static HTML Renderer (Phase 22.2).
 *
 * Owns `static/` exclusively. Produces a self-contained website:
 * `index.html` for the home page, `<slug>/index.html` for every other page,
 * shared CSS under `assets/css/`, no Next.js runtime dependency.
 * All internal links are plan-resolved relative URLs.
 */

import type { DocumentationIR, IRBlock } from "../../documentation/compiler/ir.js";
import type { RenderedFile, RenderedSite, SiteRenderer, SiteRendererOptions } from "../types.js";
import {
  buildOutputPlan,
  resolveDocumentationLink,
  type DocumentationOutputPlan,
  type PlannedPage,
} from "../output-plan.js";
import { generateScaffold } from "../nextjs/scaffold.js";

export type StaticRendererOptions = SiteRendererOptions;

/**
 * Creates the static HTML site renderer (owns the static/ output root).
 *
 * @returns Site renderer for the static-html target.
 */
export function createStaticRenderer(): SiteRenderer<StaticRendererOptions> {
  return {
    target: "static-html",
    render(ir, options = {}) {
      return renderStaticSite(ir, options);
    },
  };
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// JSDoc {@link Target} is not valid inline markup — render the target as code.
const LINK_RE = /\{@link\s+([^}|]+)(?:\|[^}]*)?\}/g;

function renderBlock(block: IRBlock): string {
  switch (block.kind) {
    case "heading": {
      const level = Math.min(Math.max(block.level, 1), 6);
      return `<h${level}>${esc(block.text)}</h${level}>`;
    }
    case "paragraph":
      return `<p>${esc(block.text.replace(LINK_RE, "`$1`"))}</p>`;
    case "code":
      return `<pre data-language="${esc(block.language)}"><code>${esc(block.code)}</code></pre>`;
    case "list": {
      const tag = block.ordered ? "ol" : "ul";
      return `<${tag}>${block.items.map((i) => `<li>${esc(i)}</li>`).join("")}</${tag}>`;
    }
    case "table":
      return `<table><thead><tr>${block.headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${block.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    case "callout":
      return `<aside class="vetwo-callout vetwo-callout-${esc(block.tone)}"><strong>${esc(block.tone)}.</strong> ${esc(block.text)}</aside>`;
    case "horizontal-rule":
      return `<hr/>`;
    case "image":
      return `<figure><img src="${esc(block.src)}" alt="${esc(block.alt)}"${block.title !== undefined ? ` title="${esc(block.title)}"` : ""}/></figure>`;
    case "custom": {
      const props = (block.props ?? {}) as Record<string, unknown>;
      if (block.component === "ApiSignature") {
        const sig = props["signature"];
        if (typeof sig === "string" && sig.length > 0) {
          return `<div class="vetwo-api-signature"><span class="vetwo-api-badge">${esc(String(props["kind"] ?? ""))}</span> <strong>${esc(String(props["name"] ?? ""))}</strong><pre><code>${esc(sig)}</code></pre></div>`;
        }
        return "";
      }
      if (block.component === "ParameterTable") {
        const params = (props["parameters"] as Array<Record<string, unknown>> | undefined) ?? [];
        if (params.length === 0) return "";
        return `<table class="vetwo-param-table"><thead><tr><th>Name</th><th>Type</th><th>Description</th></tr></thead><tbody>${params.map((p) => `<tr><td><code>${esc(String(p["name"] ?? ""))}</code></td><td><code>${esc(String(p["type"] ?? ""))}</code></td><td>${esc(String(p["description"] ?? ""))}</td></tr>`).join("")}</tbody></table>`;
      }
      if (block.component === "TypeDisplay") {
        const t = props["type"];
        if (typeof t !== "string" || t.length === 0) return "";
        return `<p><strong>${esc(String(props["label"] ?? "Type"))}:</strong> <code>${esc(t)}</code></p>`;
      }
      return "";
    }
  }
}

function navHtml(plan: DocumentationOutputPlan, pageSlug: string): string {
  return `<nav aria-label="Documentation" class="vetwo-nav">${plan.navigation
    .map(
      (node) =>
        `<section><h2>${esc(node.label)}</h2><ul>${[
          ...(node.slug !== undefined
            ? [
                `<li><a href="${esc(resolveDocumentationLink(plan, pageSlug, node.slug, "static") ?? "#")}">${esc(node.label)}</a></li>`,
              ]
            : []),
          ...(node.children ?? []).map((c) =>
            c.slug !== undefined
              ? `<li><a href="${esc(resolveDocumentationLink(plan, pageSlug, c.slug, "static") ?? "#")}">${esc(c.label)}</a></li>`
              : "",
          ),
        ].join("")}</ul></section>`,
    )
    .join("")}</nav>`;
}

/**
 * Renders the Documentation IR to a self-contained static HTML website.
 *
 * @param ir - Compiled Documentation IR (sole content input).
 * @param options - Site name, description and docs base path.
 * @returns Rendered site with static-relative file paths.
 */
export function renderStaticSite(
  ir: DocumentationIR,
  options: StaticRendererOptions = {},
): RenderedSite {
  const plan = buildOutputPlan(ir, { workspaceRoot: "", docsBasePath: options.docsBasePath });
  const siteName = options.siteName ?? "Documentation";

  const files: RenderedFile[] = [];

  const renderPage = (planned: PlannedPage, outPath: string): void => {
    const page = planned.page;
    // Skip the duplicate H1 + summary: the template already renders them.
    let blocks = page.blocks;
    if (blocks[0]?.kind === "heading" && blocks[0].level === 1 && blocks[0].text === page.title) {
      blocks = blocks.slice(1);
      if (
        page.description !== undefined &&
        blocks[0]?.kind === "paragraph" &&
        blocks[0].text === page.description
      ) {
        blocks = blocks.slice(1);
      }
    }
    const body = blocks.map((b) => renderBlock(b)).join("\n");
    // Depth from static root for the CSS href (e.g. api/overview → ../../assets/css/globals.css)
    const depth = planned.staticPath.split("/").length - 1;
    const cssHref = `${"../".repeat(depth)}assets/css/globals.css`;
    const crumbs = (ir.navigation.breadcrumbs[page.slug] ?? [])
      .map((c) => {
        if (c.slug === undefined) return esc(c.label);
        const href = resolveDocumentationLink(plan, page.slug, c.slug, "static");
        return href !== undefined ? `<a href="${esc(href)}">${esc(c.label)}</a>` : esc(c.label);
      })
      .join(" / ");
    files.push({
      path: outPath,
      contents: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(page.title)} — ${esc(siteName)}</title><link rel="stylesheet" href="${cssHref}"></head><body><div class="vetwo-layout"><aside class="vetwo-sidebar"><h1>${esc(siteName)}</h1>${navHtml(plan, page.slug)}</aside><main class="vetwo-main"><article class="vetwo-doc-article"><nav class="vetwo-breadcrumbs" aria-label="Breadcrumb">${crumbs}</nav><h1>${esc(page.title)}</h1>${page.description !== undefined && page.description.length > 0 ? `<p class="vetwo-doc-description">${esc(page.description)}</p>` : ""}${body}</article></main></div></body></html>\n`,
    });
  };

  for (const planned of plan.pages) {
    // Home page (first nav page) is also the site root index.html — no hardcoded slug.
    if (planned.slug === plan.homeSlug) {
      renderPage(planned, "index.html");
    }
    renderPage(planned, planned.staticPath);
  }

  // Shared design-system CSS (same tokens as Next.js globals.css).
  const scaffold = generateScaffold({
    siteName,
    description: options.description,
    routes: [],
    sidebar: [],
  });
  const css = scaffold.find((f) => f.path === "app/globals.css");
  files.push({ path: "assets/css/globals.css", contents: css?.contents ?? ":root{}\n" });

  return {
    target: "static-html",
    files,
    routes: plan.pages.map((p) => ({
      slug: p.slug,
      route: p.route,
      title: p.title,
      sectionId: p.sectionId,
      sectionTitle: p.sectionTitle,
    })),
    entrypoint: "index.html",
  };
}
