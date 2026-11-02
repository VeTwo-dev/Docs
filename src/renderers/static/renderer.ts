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
  planRoutes,
  posixDir,
  relativePath,
  resolveContentHref,
  resolveDocumentationLink,
  type DocumentationOutputPlan,
  type PlannedPage,
} from "../output-plan.js";
import { blocksToSearchText } from "../../site/blocks.js";
import { createHeadingSlugger, type HeadingSlugger } from "../anchors.js";
import { defaultDesignCss, themeOverrideCss } from "../design/sources.js";
import { highlightCode } from "./highlight.js";

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

/**
 * Render inline Markdown spans — code spans, emphasis, and links — as
 * HTML. Text is HTML-escaped first; code spans are extracted before any
 * other transformation so their contents stay literal, then emphasis and
 * link syntax are rewritten on the escaped non-code segments.
 */
function renderEmphasis(text: string): string {
  let out = text
    // Bold: **strong** (asterisk form; underscore form via __strong__).
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^\w])__([^_\n]+?)__(?=[^\w]|$)/g, "$1<strong>$2</strong>");
  // Italic: *em* / _em_ guarded against identifiers, escaped entities and
  // URLs (no word character immediately outside either delimiter).
  out = out.replace(/(^|[^\w`*])\*([^*\n]+?)\*(?=[^\w`*]|$)/g, "$1<em>$2</em>");
  out = out.replace(/(^|[^\w`])_([^_\n]+?)_(?=[^\w`]|$)/g, "$1<em>$2</em>");
  return out;
}

function renderInlineLinks(text: string, resolveHref?: (url: string) => string): string {
  return text
    .split(/(`+[^`]+`+)/g)
    .map((segment, index) => {
      if (index % 2 === 1) {
        const code = /^`+([\s\S]*?)`+$/.exec(segment);
        return code === null ? esc(segment) : `<code>${esc(code[1]!)}</code>`;
      }
      const escaped = esc(segment);
      return renderLinks(renderEmphasis(escaped), resolveHref);
    })
    .join("");
}

/** Link rewriting over already-escaped, already-emphasized text. */
function renderLinks(text: string, resolveHref?: (url: string) => string): string {
  return text.replace(
    /(?<![!\]])\[([^\]]*)\]\(([^)\s]+?)(?:\s+&quot;.*?&quot;)?\)/g,
    (_match, label: string, url: string) => {
      const href = resolveHref === undefined ? url : resolveHref(url);
      return `<a href="${href}">${label || url}</a>`;
    },
  );
}

/**
 * Resolve a Markdown link target to a portable static href. Relative
 * Markdown links (`../api/overview.md`) and root-absolute documentation
 * routes (`/api/overview`) that match a planned page become plan-relative
 * links (`../api/overview/`); external URLs, anchors, assets, and unknown
 * targets pass through verbatim.
 */
function resolveStaticHref(
  plan: DocumentationOutputPlan,
  sourceSlug: string,
  url: string,
  fromDir?: string,
): string {
  return resolveContentHref(plan, sourceSlug, url, "static", fromDir) ?? url;
}

function renderBlock(
  block: IRBlock,
  resolveHref?: (url: string) => string,
  slugHeading?: HeadingSlugger,
): string {
  switch (block.kind) {
    case "heading": {
      const level = Math.min(Math.max(block.level, 1), 6);
      // Heading ids make `#fragment` links resolvable in the static target,
      // matching the anchors the Fumadocs/MDX pipeline generates.
      const id = slugHeading === undefined ? "" : ` id="${esc(slugHeading(block.text))}"`;
      return `<h${level}${id}>${renderInlineLinks(block.text, resolveHref)}</h${level}>`;
    }
    case "paragraph":
      return `<p>${renderInlineLinks(block.text.replace(LINK_RE, "`$1`"), resolveHref)}</p>`;
    case "code":
      return `<pre data-language="${esc(block.language)}"><code>${highlightCode(
        block.code,
        block.language,
      )}</code></pre>`;
    case "list": {
      const tag = block.ordered ? "ol" : "ul";
      return `<${tag}>${block.items.map((i) => `<li>${renderInlineLinks(i, resolveHref)}</li>`).join("")}</${tag}>`;
    }
    case "table":
      return `<table><thead><tr>${block.headers.map((h) => `<th>${renderInlineLinks(h, resolveHref)}</th>`).join("")}</tr></thead><tbody>${block.rows.map((r) => `<tr>${r.map((c) => `<td>${renderInlineLinks(c, resolveHref)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    case "callout":
      return `<aside class="vetwo-callout vetwo-callout-${esc(block.tone)}"><strong>${esc(block.tone)}.</strong> ${renderInlineLinks(block.text, resolveHref)}</aside>`;
    case "horizontal-rule":
      return `<hr/>`;
    case "image":
      return `<figure><img src="${esc(block.src)}" alt="${esc(block.alt)}"${block.title !== undefined ? ` title="${esc(block.title)}"` : ""}/></figure>`;
    case "custom": {
      const props = (block.props ?? {}) as Record<string, unknown>;
      if (block.component === "ApiSignature") {
        const sig = props["signature"];
        if (typeof sig === "string" && sig.length > 0) {
          return `<div class="vetwo-api-signature"><span class="vetwo-api-badge">${esc(String(props["kind"] ?? ""))}</span> <strong>${esc(String(props["name"] ?? ""))}</strong><pre><code>${highlightCode(sig, "ts")}</code></pre></div>`;
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
      // Deterministic compatibility strategy for components without a static
      // HTML mapping: an HTML comment names the dropped component instead of
      // emitting nothing (silent loss) or raw JSX (broken HTML).
      const safeName = block.component.replace(/[^A-Za-z0-9._-]/g, "");
      return `<!-- unsupported-component: ${safeName} -->`;
    }
  }
}

/** Sidebar navigation with links resolved relative to an explicit directory. */
function navHtmlFromDir(
  plan: DocumentationOutputPlan,
  fromDir: string,
  currentSlug: string,
): string {
  const link = (targetSlug: string, label: string): string => {
    const href = relativeLink(plan, fromDir, targetSlug);
    if (href === undefined) return "";
    const current = targetSlug === currentSlug ? ` aria-current="page"` : "";
    return `<li><a href="${esc(href)}"${current}>${esc(label)}</a></li>`;
  };
  return `<nav aria-label="Documentation" class="vetwo-nav">${plan.navigation
    .map(
      (node) =>
        `<section><h2>${esc(node.label)}</h2><ul>${[
          ...(node.slug !== undefined ? [link(node.slug, node.label)] : []),
          ...(node.children ?? []).map((c) => (c.slug !== undefined ? link(c.slug, c.label) : "")),
        ].join("")}</ul></section>`,
    )
    .join("")}</nav>`;
}

/** Relative link from a static output directory to a target slug's page. */
function relativeLink(
  plan: DocumentationOutputPlan,
  fromDir: string,
  targetSlug: string,
): string | undefined {
  const target = plan.pagesBySlug.get(targetSlug);
  if (target === undefined) return undefined;
  return `${relativePath(fromDir, posixDir(target.staticPath))}/`;
}

/**
 * Renders the Documentation IR to a self-contained static HTML website.
 *
 * @param ir - Compiled Documentation IR (sole content input).
 * @param options - Site name, description and docs base path.
 * @returns Rendered site with static-relative file paths.
 */

/** External (http) links open in a new tab; same-host links stay in place. */
function headerLink(href: string, label: string): string {
  const external = href.startsWith("http://") || href.startsWith("https://");
  const attrs = external ? ` target="_blank" rel="noreferrer"` : "";
  return `<a class="vetwo-header-link" href="${esc(href)}"${attrs}>${esc(label)}</a>`;
}

/**
 * Shared site shell header: brand (logo + site name → home), external
 * project links (GitHub etc. from options, omitted when unconfigured),
 * and a search entry. All data comes from renderer options — never invented.
 */
function siteHeader(
  plan: DocumentationOutputPlan,
  pageSlug: string,
  siteName: string,
  options: StaticRendererOptions,
  searchHref: string | undefined,
): string {
  const homeHref =
    plan.homeSlug !== undefined
      ? (resolveDocumentationLink(plan, pageSlug, plan.homeSlug, "static") ?? "./")
      : "./";
  const brand =
    options.logoSvg !== undefined
      ? `<a class="vetwo-brand" href="${esc(homeHref)}">${options.logoSvg}<span>${esc(siteName)}</span></a>`
      : `<a class="vetwo-brand" href="${esc(homeHref)}"><span>${esc(siteName)}</span></a>`;
  const external = [...(options.navLinks ?? [])]
    .map((link) => headerLink(link.href, link.label))
    .join("");
  const searchEntry =
    searchHref !== undefined
      ? `<a class="vetwo-header-link" href="${esc(searchHref)}">Search</a>`
      : "";
  return `<header class="vetwo-header">${brand}<nav class="vetwo-header-nav" aria-label="External">${external}${searchEntry}</nav></header>`;
}

function siteFooter(siteName: string): string {
  return `<footer class="vetwo-footer"><p>${esc(siteName)}</p></footer>`;
}

/** Canonical search records for the static target (same shape as the site model). */
export interface StaticSearchRecord {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly route: string;
  readonly content: string;
  readonly section: string;
}

/** Build deterministic search records from IR pages (no separate index model). */
export function staticSearchRecords(
  ir: DocumentationIR,
  plan: DocumentationOutputPlan,
): StaticSearchRecord[] {
  const sectionTitle = new Map(ir.sections.map((s) => [s.id, s.title]));
  return plan.pages.map((p) => ({
    id: p.slug,
    title: p.title,
    description: p.page.description ?? "",
    route: p.route,
    content: blocksToSearchText(p.page.blocks).slice(0, 5000),
    section: sectionTitle.get(p.page.sectionId) ?? "",
  }));
}

/**
 * Render the client-side search page. Vanilla JS only (no runtime
 * dependency, no server): records are fetched from the sibling
 * `search.json`, ranked title > description > content, and rendered with
 * textContent exclusively (indexed content is never injected as HTML).
 */
function searchPage(recordCount: number): string {
  return `<article class="vetwo-doc-article"><h1>Search</h1><form class="vetwo-search" role="search" id="vetwo-search-form"><label class="vetwo-search-label" for="vetwo-search-input">Search documentation</label><input class="vetwo-search-input" id="vetwo-search-input" name="q" type="search" autocomplete="off" placeholder="Type to search ${recordCount} pages…"><p class="vetwo-search-hint">Results update as you type. Search covers titles, descriptions and page text.</p></form><p class="vetwo-search-status" role="status" aria-live="polite" id="vetwo-search-status"></p><ul class="vetwo-search-results" id="vetwo-search-results"></ul><script>
(function () {
  var input = document.getElementById("vetwo-search-input");
  var status = document.getElementById("vetwo-search-status");
  var results = document.getElementById("vetwo-search-results");
  var records = [];
  function score(record, query) {
    var score = 0;
    var title = record.title.toLowerCase();
    var description = (record.description || "").toLowerCase();
    var content = (record.content || "").toLowerCase();
    var terms = query.toLowerCase().split(/\\s+/).filter(function (t) { return t.length > 0; });
    if (terms.length === 0) return 0;
    for (var i = 0; i < terms.length; i++) {
      var term = terms[i];
      if (title.indexOf(term) !== -1) score += 3;
      if (description.indexOf(term) !== -1) score += 2;
      if (content.indexOf(term) !== -1) score += 1;
    }
    return score;
  }
  function render(query) {
    while (results.firstChild) results.removeChild(results.firstChild);
    var q = query.trim();
    if (q.length === 0) {
      status.textContent = "";
      return;
    }
    var ranked = records
      .map(function (record) { return { record: record, score: score(record, q) }; })
      .filter(function (entry) { return entry.score > 0; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, 20);
    if (ranked.length === 0) {
      status.textContent = "No results for \\"" + q + "\\"";
      return;
    }
    status.textContent = ranked.length + (ranked.length === 1 ? " result" : " results") + " for \\"" + q + "\\"";
    for (var i = 0; i < ranked.length; i++) {
      (function (entry) {
        var item = document.createElement("li");
        var link = document.createElement("a");
        link.setAttribute("href", entry.record.url);
        link.textContent = entry.record.title;
        item.appendChild(link);
        if (entry.record.description) {
          var desc = document.createElement("p");
          desc.textContent = entry.record.description;
          item.appendChild(desc);
        }
        results.appendChild(item);
      })(ranked[i]);
    }
  }
  fetch("./search.json")
    .then(function (res) { return res.json(); })
    .then(function (data) {
      records = Array.isArray(data.records) ? data.records : [];
      input.addEventListener("input", function () { render(input.value); });
      var initial = new URLSearchParams(window.location.search).get("q");
      if (initial) {
        input.value = initial;
        render(initial);
      }
    })
    .catch(function () {
      status.textContent = "Search index could not be loaded.";
    });
  document.getElementById("vetwo-search-form").addEventListener("submit", function (e) {
    e.preventDefault();
    render(input.value);
  });
})();
</script></article>`;
}

export function renderStaticSite(
  ir: DocumentationIR,
  options: StaticRendererOptions = {},
): RenderedSite {
  const plan = buildOutputPlan(ir, { workspaceRoot: "", docsBasePath: options.docsBasePath });
  const siteName = options.siteName ?? "Documentation";

  const files: RenderedFile[] = [];

  const depthOf = (outPath: string): number => outPath.split("/").length - 1;
  // A user document claiming `/search` owns the whole subtree: the
  // synthesized search page, index, and header entry are skipped.
  const searchTaken = plan.pagesBySlug.has("search");
  const searchHrefFor = (outPath: string): string | undefined =>
    searchTaken ? undefined : `${"../".repeat(depthOf(outPath))}search/`;

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
    // Directory of the actual output file. The home alias at `index.html` is
    // shallower than its canonical `index/index.html` path, so body links,
    // navigation, and breadcrumbs must be resolved from this directory.
    const fromDir = posixDir(outPath);
    const slugHeading = createHeadingSlugger();
    const body = blocks
      .map((b) =>
        renderBlock(b, (url) => resolveStaticHref(plan, page.slug, url, fromDir), slugHeading),
      )
      .join("\n");
    const cssHref = `${"../".repeat(depthOf(outPath))}assets/css/globals.css`;
    const crumbs = (ir.navigation.breadcrumbs[page.slug] ?? [])
      .map((c, index, list) => {
        const last = index === list.length - 1;
        const label = esc(c.label);
        let inner = label;
        if (!last && c.slug !== undefined) {
          const target = plan.pagesBySlug.get(c.slug);
          if (target !== undefined) {
            const toDir = posixDir(target.staticPath);
            const href = fromDir === toDir ? "./" : `${relativePath(fromDir, toDir)}/`;
            inner = `<a href="${esc(href)}">${label}</a>`;
          }
        } else if (last) {
          inner = `<span aria-current="location">${label}</span>`;
        }
        return `<span class="vetwo-crumb">${inner}</span>`;
      })
      .join(`<span class="vetwo-crumb-sep" aria-hidden="true">/</span>`);
    files.push({
      path: outPath,
      contents: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><title>${esc(page.title)} — ${esc(siteName)}</title><link rel="stylesheet" href="${cssHref}"></head><body><a class="vetwo-skip-link" href="#vetwo-main">Skip to content</a>${siteHeader(plan, page.slug, siteName, options, searchHrefFor(outPath))}<div class="vetwo-layout"><aside class="vetwo-sidebar"><h1>${esc(siteName)}</h1>${navHtmlFromDir(plan, fromDir, page.slug)}</aside><main class="vetwo-main" id="vetwo-main"><article class="vetwo-doc-article"><nav class="vetwo-breadcrumbs" aria-label="Breadcrumb">${crumbs}</nav><h1>${esc(page.title)}</h1>${page.description !== undefined && page.description.length > 0 ? `<p class="vetwo-doc-description">${esc(page.description)}</p>` : ""}${body}</article></main></div>${siteFooter(siteName)}</body></html>\n`,
    });
  };

  for (const planned of plan.pages) {
    // Home page (first nav page) is also the site root index.html — no hardcoded slug.
    if (planned.slug === plan.homeSlug) {
      renderPage(planned, "index.html");
    }
    renderPage(planned, planned.staticPath);
  }

  // Search: canonical records as `search/search.json` plus a self-contained
  // search page. URLs are relative from `search/` so the site stays portable.
  // Skipped entirely when user content claims the `/search` route.
  if (!searchTaken) {
    const records = staticSearchRecords(ir, plan).map((record) => ({
      ...record,
      url: record.id === plan.homeSlug ? "../" : `../${record.id}/`,
    }));
    files.push({
      path: "search/search.json",
      contents: `${JSON.stringify({ records }, null, 2)}\n`,
    });
    {
      const cssHref = "../assets/css/globals.css";
      files.push({
        path: "search/index.html",
        contents: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><title>Search — ${esc(siteName)}</title><link rel="stylesheet" href="${cssHref}"></head><body><a class="vetwo-skip-link" href="#vetwo-main">Skip to content</a>${siteHeader(plan, plan.homeSlug ?? "", siteName, options, "./")}<div class="vetwo-layout"><aside class="vetwo-sidebar"><h1>${esc(siteName)}</h1>${navHtmlFromDir(plan, "search", plan.homeSlug ?? "search")}</aside><main class="vetwo-main" id="vetwo-main">${searchPage(records.length)}</main></div>${siteFooter(siteName)}</body></html>\n`,
      });
    }
  }

  // Generated site CSS: composed from the persistent design sources
  // (design/tokens.css + base.css + components.css) with optional
  // docs.config.ts theme overrides pinned on top. Never edited by hand.
  const css = `${options.designCss ?? defaultDesignCss()}\n${themeOverrideCss(options.theme)}`;
  files.push({ path: "assets/css/globals.css", contents: css });

  return {
    target: "static-html",
    files,
    routes: planRoutes(plan),
    entrypoint: "index.html",
  };
}
