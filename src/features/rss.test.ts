import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BuildContextMutable } from "../types/internal.js";
import type { DocPage } from "../types/public.js";
import { defineDocs } from "../config/define.js";
import { generateRssFeed, writeRssFeed } from "./rss.js";

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
  tmpDir = mkdtempSync(join(tmpdir(), "rss-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("generateRssFeed", () => {
  it("generates entries from pages when rss is enabled", () => {
    const ctx = createMockCtx({
      config: defineDocs({ baseUrl: "https://example.com", rss: true }),
      pages: [
        makePage({ title: "Page One", slug: "/page-one", description: "First page" }),
        makePage({ title: "Page Two", slug: "/page-two", description: "Second page" }),
      ],
    });

    generateRssFeed(ctx);

    expect(ctx.rssEntries).toHaveLength(2);
    expect(ctx.rssEntries[0]!.title).toBe("Page One");
    expect(ctx.rssEntries[0]!.link).toBe("https://example.com/page-one");
    expect(ctx.rssEntries[0]!.description).toBe("First page");
    expect(ctx.rssEntries[0]!.guid).toBe("https://example.com/page-one");
  });

  it("does nothing when rss is disabled", () => {
    const ctx = createMockCtx({
      config: defineDocs({ rss: false }),
      pages: [makePage()],
    });

    generateRssFeed(ctx);

    expect(ctx.rssEntries).toHaveLength(0);
  });

  it("returns empty entries for empty pages", () => {
    const ctx = createMockCtx({
      config: defineDocs({ rss: true }),
      pages: [],
    });

    generateRssFeed(ctx);

    expect(ctx.rssEntries).toHaveLength(0);
  });
});

describe("writeRssFeed", () => {
  it("writes valid RSS XML file", async () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      config: defineDocs({
        title: "My Docs",
        description: "Documentation",
        baseUrl: "https://example.com/",
        rss: true,
      }),
      outputDir,
      pages: [makePage({ title: "Article", slug: "/article", description: "An article" })],
    });

    generateRssFeed(ctx);
    await writeRssFeed(ctx);

    const content = readFileSync(join(outputDir, "feed.xml"), "utf-8");
    expect(content).toContain("<title>My Docs</title>");
    expect(content).toContain("<link>https://example.com/</link>");
    expect(content).toContain("<description>Documentation</description>");
    expect(content).toContain("Article");
  });

  it("does nothing when rss is disabled", async () => {
    const ctx = createMockCtx({
      config: defineDocs({ rss: false }),
      outputDir: join(tmpDir, "output"),
      pages: [makePage()],
    });

    await writeRssFeed(ctx);

    expect(() => readFileSync(join(tmpDir, "output", "feed.xml"))).toThrow();
  });

  it("does nothing when no entries", async () => {
    const ctx = createMockCtx({
      config: defineDocs({ rss: true }),
      outputDir: join(tmpDir, "output"),
      pages: [],
    });

    await writeRssFeed(ctx);

    expect(() => readFileSync(join(tmpDir, "output", "feed.xml"))).toThrow();
  });
});
