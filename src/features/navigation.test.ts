import { describe, it, expect } from "vitest";
import type { BuildContextMutable } from "../types/internal.js";
import type { DocPage } from "../types/public.js";
import { defineDocs } from "../config/define.js";
import { generateNavigation, generateSidebar } from "./navigation.js";

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
    lastModified: new Date(),
    ...overrides,
  };
}

describe("generateNavigation", () => {
  it("auto-generates nav items from page categories", () => {
    const ctx = createMockCtx({
      pages: [
        makePage({ category: "guides", slug: "/guides/getting-started" }),
        makePage({ category: "api", slug: "/api/overview" }),
        makePage({ category: "guides", slug: "/guides/advanced" }),
      ],
    });

    generateNavigation(ctx);

    expect(ctx.navItems.length).toBe(2);
    const labels = ctx.navItems.map((n) => n.label);
    expect(labels).toContain("Api");
    expect(labels).toContain("Guides");
  });

  it("capitalizes category labels", () => {
    const ctx = createMockCtx({
      pages: [makePage({ category: "getting-started" })],
    });

    generateNavigation(ctx);

    expect(ctx.navItems[0]!.label).toBe("Getting Started");
    expect(ctx.navItems[0]!.href).toBe("/getting-started");
  });

  it("uses config.nav items when provided", () => {
    const ctx = createMockCtx({
      config: defineDocs({
        nav: {
          items: [
            { label: "Home", href: "/" },
            { label: "Docs", href: "/docs" },
          ],
        },
      }),
      pages: [makePage({ category: "guides" })],
    });

    generateNavigation(ctx);

    expect(ctx.navItems).toHaveLength(2);
    expect(ctx.navItems[0]!.label).toBe("Home");
    expect(ctx.navItems[1]!.label).toBe("Docs");
  });

  it("returns empty navItems when no pages and no config", () => {
    const ctx = createMockCtx({ pages: [] });

    generateNavigation(ctx);

    expect(ctx.navItems).toHaveLength(0);
  });
});

describe("generateSidebar", () => {
  it("auto-generates sidebar groups from page categories", () => {
    const ctx = createMockCtx({
      pages: [
        makePage({ category: "guides", title: "Getting Started", slug: "/guides/getting-started" }),
        makePage({ category: "guides", title: "Advanced", slug: "/guides/advanced" }),
        makePage({ category: "api", title: "Overview", slug: "/api/overview" }),
      ],
    });

    generateSidebar(ctx);

    expect(ctx.sidebarGroups.length).toBe(2);
    const titles = ctx.sidebarGroups.map((g) => g.title);
    expect(titles).toContain("Guides");
    expect(titles).toContain("Api");
  });

  it("creates items with correct label and href", () => {
    const ctx = createMockCtx({
      pages: [makePage({ category: "guides", title: "My Page", slug: "/guides/my-page" })],
    });

    generateSidebar(ctx);

    const group = ctx.sidebarGroups.find((g) => g.title === "Guides")!;
    expect(group.items).toHaveLength(1);
    expect(group.items[0]!.label).toBe("My Page");
    expect(group.items[0]!.href).toBe("/guides/my-page");
  });

  it("uses config.sidebar.groups when provided", () => {
    const ctx = createMockCtx({
      config: defineDocs({
        sidebar: {
          groups: [{ title: "Manual Group", items: ["page-one", "page-two"] }],
        },
      }),
      pages: [makePage({ category: "guides" })],
    });

    generateSidebar(ctx);

    expect(ctx.sidebarGroups).toHaveLength(1);
    expect(ctx.sidebarGroups[0]!.title).toBe("Manual Group");
    expect(ctx.sidebarGroups[0]!.items).toHaveLength(2);
    expect(ctx.sidebarGroups[0]!.items[0]!.label).toBe("Page One");
    expect(ctx.sidebarGroups[0]!.items[0]!.href).toBe("/page-one");
  });

  it("returns empty sidebar when no pages and no config", () => {
    const ctx = createMockCtx({ pages: [] });

    generateSidebar(ctx);

    expect(ctx.sidebarGroups).toHaveLength(0);
  });
});
