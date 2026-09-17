import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BuildContextMutable } from "../types/internal.js";
import type { DocPage } from "../types/public.js";
import { defineDocs } from "../config/define.js";
import {
  generateSearchIndex,
  writeSearchIndex,
  stripHtml,
  truncate,
  createSearchEngine,
} from "./search.js";

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
    content: "<h1>Test Page</h1><p>Some content here.</p>",
    frontmatter: {},
    headings: [],
    links: [],
    wordCount: 10,
    readingTimeMinutes: 1,
    lastModified: new Date(),
    ...overrides,
  };
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "search-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("stripHtml", () => {
  it("removes HTML tags from a string", () => {
    expect(stripHtml("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });

  it("normalizes whitespace", () => {
    expect(stripHtml("<p>hello  \n  world</p>")).toBe("hello world");
  });

  it("returns plain text unchanged", () => {
    expect(stripHtml("just plain text")).toBe("just plain text");
  });

  it("handles nested tags", () => {
    expect(stripHtml("<div><span><a href='#'>link</a></span></div>")).toBe("link");
  });

  it("returns empty string for empty input", () => {
    expect(stripHtml("")).toBe("");
  });
});

describe("truncate", () => {
  it("returns text unchanged if under max length", () => {
    expect(truncate("short", 100)).toBe("short");
  });

  it("truncates at word boundary", () => {
    const result = truncate("Hello world this is long text", 15);
    expect(result.length).toBeLessThanOrEqual(15);
    expect(result.endsWith(" ")).toBe(false);
    expect(result.split(" ").length).toBeLessThanOrEqual(3);
  });

  it("handles text with no spaces", () => {
    const result = truncate("supercalifragilisticexpialidocious", 10);
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it("returns empty string for zero max length", () => {
    expect(truncate("hello", 0)).toBe("");
  });
});

describe("createSearchEngine", () => {
  it("creates a MiniSearch instance", () => {
    const engine = createSearchEngine();
    expect(engine).toBeDefined();
    expect(typeof engine.add).toBe("function");
    expect(typeof engine.search).toBe("function");
  });

  it("supports adding and searching documents", () => {
    const engine = createSearchEngine();
    engine.add({
      id: "1",
      title: "Getting Started",
      content: "Welcome to the guide",
      category: "guides",
      url: "/start",
    });

    const results = engine.search("welcome");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.id).toBe("1");
  });

  it("supports fuzzy search", () => {
    const engine = createSearchEngine();
    engine.add({
      id: "1",
      title: "Configuration",
      content: "How to configure the project",
      category: "guides",
      url: "/config",
    });

    const results = engine.search("configur");
    expect(results.length).toBeGreaterThan(0);
  });
});

describe("generateSearchIndex", () => {
  it("creates entries from pages", async () => {
    const ctx = createMockCtx({
      pages: [
        makePage({ id: "page-1", title: "First Page", slug: "/first", category: "guides" }),
        makePage({ id: "page-2", title: "Second Page", slug: "/second", category: "api" }),
      ],
    });

    await generateSearchIndex(ctx);

    expect(ctx.searchIndex).toBeDefined();
    expect(ctx.searchIndex!.entries).toHaveLength(2);
  });

  it("strips HTML from content in entries", async () => {
    const ctx = createMockCtx({
      pages: [makePage({ content: "<h1>Title</h1><p>Hello <strong>world</strong></p>" })],
    });

    await generateSearchIndex(ctx);

    const entry = ctx.searchIndex!.entries[0]!;
    expect(entry.content).not.toContain("<h1>");
    expect(entry.content).not.toContain("<strong>");
    expect(entry.content).toContain("Hello world");
  });

  it("truncates content to 500 characters", async () => {
    const longContent = "A".repeat(1000);
    const ctx = createMockCtx({
      pages: [makePage({ content: longContent })],
    });

    await generateSearchIndex(ctx);

    expect(ctx.searchIndex!.entries[0]!.content.length).toBeLessThanOrEqual(500);
  });

  it("includes id, title, url, and category", async () => {
    const ctx = createMockCtx({
      pages: [makePage({ id: "my-id", title: "My Title", slug: "/my-slug", category: "guides" })],
    });

    await generateSearchIndex(ctx);

    const entry = ctx.searchIndex!.entries[0]!;
    expect(entry.id).toBe("my-id");
    expect(entry.title).toBe("My Title");
    expect(entry.url).toBe("/my-slug");
    expect(entry.category).toBe("guides");
  });

  it("sets generatedAt to a valid ISO string", async () => {
    const ctx = createMockCtx({ pages: [makePage()] });

    await generateSearchIndex(ctx);

    expect(ctx.searchIndex!.generatedAt).toBeDefined();
    expect(new Date(ctx.searchIndex!.generatedAt).toISOString()).toBe(ctx.searchIndex!.generatedAt);
  });

  it("returns empty entries for empty pages", async () => {
    const ctx = createMockCtx({ pages: [] });

    await generateSearchIndex(ctx);

    expect(ctx.searchIndex!.entries).toHaveLength(0);
  });
});

describe("writeSearchIndex", () => {
  it("writes JSON file to output directory", async () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      outputDir,
      pages: [makePage({ id: "p1", title: "Page One", slug: "/one", category: "guides" })],
    });

    await generateSearchIndex(ctx);
    writeSearchIndex(ctx);

    const filePath = join(outputDir, "search-index.json");
    const content = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(content);

    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0].title).toBe("Page One");
  });

  it("does nothing if searchIndex is undefined", () => {
    const ctx = createMockCtx({ outputDir: join(tmpDir, "output") });

    writeSearchIndex(ctx);

    expect(() => readFileSync(join(tmpDir, "output", "search-index.json"))).toThrow();
  });
});
