import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BuildContextMutable } from "../types/internal.js";
import type { DocPage } from "../types/public.js";
import { defineDocs } from "../config/define.js";
import { generateSitemap, writeSitemap, writeRobotsTxt } from "./seo.js";

function createMockCtx(overrides?: Partial<BuildContextMutable>): BuildContextMutable {
  return {
    config: defineDocs(),
    rootDir: "/tmp/test",
    sourceDir: "./src",
    outputDir: "/tmp/test/output",
    projectType: "library",
    packageManager: "npm",
    workspaceInfo: undefined,
    packages: [],
    sourceFiles: [],
    pages: [],
    navItems: [],
    sidebarGroups: [],
    searchIndex: undefined,
    apiDocs: [],
    sitemapEntries: [],
    rssEntries: [],
    errors: [],
    warnings: [],
    startTime: Date.now(),
    ...overrides,
  };
}

function makePage(overrides: Partial<DocPage> = {}): DocPage {
  return {
    id: "test-page",
    title: "Test Page",
    description: "A test page",
    slug: "/test-page",
    filePath: "/tmp/test/page.md",
    relativePath: "page.md",
    category: "guides",
    order: 0,
    content: "<h1>Test Page</h1>",
    frontmatter: {},
    headings: [],
    links: [],
    wordCount: 10,
    readingTimeMinutes: 1,
    lastModified: new Date("2024-06-15"),
    ...overrides,
  };
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "seo-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("generateSitemap", () => {
  it("generates entries from pages when sitemap is enabled", () => {
    const ctx = createMockCtx({
      config: defineDocs({ baseUrl: "https://example.com/", sitemap: true }),
      pages: [
        makePage({
          slug: "/guides/intro",
          category: "guides",
          lastModified: new Date("2024-01-10"),
        }),
        makePage({ slug: "/api/overview", category: "api", lastModified: new Date("2024-02-15") }),
      ],
    });

    generateSitemap(ctx);

    expect(ctx.sitemapEntries).toHaveLength(2);
    expect(ctx.sitemapEntries[0]!.url).toBe("https://example.com/guides/intro");
    expect(ctx.sitemapEntries[1]!.url).toBe("https://example.com/api/overview");
  });

  it("strips trailing slash from baseUrl", () => {
    const ctx = createMockCtx({
      config: defineDocs({ baseUrl: "https://example.com/", sitemap: true }),
      pages: [makePage({ slug: "/page" })],
    });

    generateSitemap(ctx);

    expect(ctx.sitemapEntries[0]!.url).toBe("https://example.com/page");
  });

  it("sets higher priority for guides category", () => {
    const ctx = createMockCtx({
      config: defineDocs({ sitemap: true }),
      pages: [makePage({ category: "guides" }), makePage({ category: "api" })],
    });

    generateSitemap(ctx);

    expect(ctx.sitemapEntries[0]!.priority).toBe(0.8);
    expect(ctx.sitemapEntries[1]!.priority).toBe(0.6);
  });

  it("does nothing when sitemap is disabled", () => {
    const ctx = createMockCtx({
      config: defineDocs({ sitemap: false }),
      pages: [makePage()],
    });

    generateSitemap(ctx);

    expect(ctx.sitemapEntries).toHaveLength(0);
  });
});

describe("writeSitemap", () => {
  it("writes valid XML file", async () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      config: defineDocs({ baseUrl: "https://example.com", sitemap: true }),
      outputDir,
      pages: [makePage({ slug: "/page", lastModified: new Date("2024-06-15") })],
    });

    generateSitemap(ctx);
    await writeSitemap(ctx);

    const content = readFileSync(join(outputDir, "sitemap.xml"), "utf-8");
    expect(content).toContain("<loc>https://example.com/page</loc>");
    expect(content).toContain("<changefreq>weekly</changefreq>");
  });

  it("does nothing when sitemap is disabled", async () => {
    const ctx = createMockCtx({
      config: defineDocs({ sitemap: false }),
      outputDir: join(tmpDir, "output"),
      pages: [makePage()],
    });

    await writeSitemap(ctx);

    expect(() => readFileSync(join(tmpDir, "output", "sitemap.xml"))).toThrow();
  });

  it("does nothing when no entries", async () => {
    const ctx = createMockCtx({
      config: defineDocs({ sitemap: true }),
      outputDir: join(tmpDir, "output"),
      pages: [],
    });

    await writeSitemap(ctx);

    expect(() => readFileSync(join(tmpDir, "output", "sitemap.xml"))).toThrow();
  });
});

describe("writeRobotsTxt", () => {
  it("writes valid robots.txt with sitemap URL", () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      config: defineDocs({ baseUrl: "https://example.com/", robots: true }),
      outputDir,
    });

    writeRobotsTxt(ctx);

    const content = readFileSync(join(outputDir, "robots.txt"), "utf-8");
    expect(content).toContain("User-agent: *");
    expect(content).toContain("Allow: /");
    expect(content).toContain("Sitemap: https://example.com/sitemap.xml");
  });

  it("does nothing when robots is disabled", () => {
    const ctx = createMockCtx({
      config: defineDocs({ robots: false }),
      outputDir: join(tmpDir, "output"),
    });

    writeRobotsTxt(ctx);

    expect(() => readFileSync(join(tmpDir, "output", "robots.txt"))).toThrow();
  });
});
