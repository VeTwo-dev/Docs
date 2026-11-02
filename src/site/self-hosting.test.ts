/**
 * Self-hosting regression tests.
 *
 * These tests dogfood the canonical content pipeline against @vetwo/docs's
 * own authored corpus (`./md`). They run the real stages — discovery →
 * normalization → site model → Documentation IR → static/Fumadocs renderers —
 * without writing to disk, and assert the concrete facts the self-hosting
 * build depends on. If the pipeline or the corpus drifts, these fail loudly.
 */

import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { DocumentationIR } from "../documentation/compiler/ir.js";
import { discoverContentDocuments } from "./discovery.js";
import { buildSiteModel } from "./model.js";
import { siteModelToIR } from "./adapters.js";
import { renderStaticSite } from "../renderers/static/renderer.js";
import { renderFumadocsSite } from "../renderers/fumadocs/renderer.js";
import type { CanonicalDocument, DocumentationSite } from "./types.js";

const rootDir = process.cwd();
const sourceDir = resolve(rootDir, "md");

let documents: readonly CanonicalDocument[];
let site: DocumentationSite;
let ir: DocumentationIR;

beforeAll(async () => {
  documents = await discoverContentDocuments({ rootDir, sourceDir });
  site = buildSiteModel(documents, {
    siteName: "@vetwo/docs",
    title: "@vetwo/docs — Documentation Engine",
    description: "Self-hosted documentation.",
    baseUrl: "https://vetwo.github.io/Docs/",
  });
  ir = siteModelToIR(site);
}, 60_000);

describe("self-hosted documentation", () => {
  it("discovers the authored Markdown corpus from ./md", () => {
    expect(documents.length).toBeGreaterThan(0);
    for (const doc of documents) {
      expect(doc.relativePath.endsWith(".md") || doc.relativePath.endsWith(".mdx")).toBe(true);
      expect(doc.route.startsWith("/")).toBe(true);
      expect(doc.title.length).toBeGreaterThan(0);
    }
  });

  it("assigns exactly one unique route per source document", () => {
    const routes = documents.map((doc) => doc.route);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it("builds a site model with a root home page and sections", () => {
    expect(site.home).toBeDefined();
    expect(site.home?.route).toBe("/");
    expect(site.sections.length).toBeGreaterThan(0);
    // Every non-home document becomes a page.
    expect(site.pages.length).toBe(documents.length - 1);
  });

  it("produces a Documentation IR covering every page plus the home page", () => {
    expect(ir.pages.length).toBe(documents.length);
    expect(ir.pages.some((page) => page.slug === "index")).toBe(true);
    expect(ir.navigation.sidebar.length).toBeGreaterThan(0);
  });

  it("renders a portable static HTML site from the IR", () => {
    const rendered = renderStaticSite(ir, { docsBasePath: "/docs" });
    expect(rendered.target).toBe("static-html");
    expect(rendered.files.some((file) => file.path === "index.html")).toBe(true);
    expect(rendered.routes.length).toBe(ir.pages.length);
    const html = rendered.files.find((file) => file.path === "index.html");
    expect(html?.contents).toContain("<html");
  });

  it("resolves every authored .md link in static HTML", () => {
    const rendered = renderStaticSite(ir, { docsBasePath: "/docs" });
    for (const file of rendered.files) {
      if (!file.path.endsWith(".html")) continue;
      expect(file.contents).not.toMatch(/href="[^"]*\.mdx?"/);
    }
  });

  it("emits github-slugger heading anchors in static HTML", () => {
    const rendered = renderStaticSite(ir, { docsBasePath: "/docs" });
    const withHeadings = rendered.files.filter((file) => {
      const article = file.contents.slice(
        file.contents.indexOf("<article"),
        file.contents.indexOf("</article>"),
      );
      return /<h[23]/.test(article);
    });
    expect(withHeadings.length).toBeGreaterThan(0);
    for (const file of withHeadings) {
      const article = file.contents.slice(
        file.contents.indexOf("<article"),
        file.contents.indexOf("</article>"),
      );
      expect(article).toMatch(/<h[23] id="[^"]+"/);
    }
  });

  it("renders a Fumadocs + Next.js project from the IR", () => {
    const rendered = renderFumadocsSite(ir, { docsBasePath: "/" });
    expect(rendered.target).toBe("fumadocs");
    const mdx = rendered.files.filter((file) => /^content\/docs\/.*\.mdx$/.test(file.path));
    expect(mdx.length).toBe(ir.pages.length);
    expect(rendered.files.some((file) => file.path === "app/[[...slug]]/page.tsx")).toBe(true);
  });

  it("rewrites .md links, including code-labelled ones, in Fumadocs content", () => {
    const rendered = renderFumadocsSite(ir, { docsBasePath: "/" });
    const plugins = rendered.files.find((file) => file.path === "content/docs/api/plugins.mdx");
    expect(plugins?.contents).toContain("(/cli/plugin)");
    expect(plugins?.contents).not.toContain("cli/plugin.md");
  });
});
