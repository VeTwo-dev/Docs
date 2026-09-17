import { describe, it, expect } from "vitest";
import type { DocPage } from "../types/public.js";
import { defineDocs } from "../config/define.js";
import { createDefaultTemplate } from "./template.js";

function makePage(overrides: Partial<DocPage> = {}): DocPage {
  return {
    id: "test-page",
    title: "Test Page",
    description: "A test page description",
    slug: "/test-page",
    filePath: "/tmp/test/page.md",
    relativePath: "page.md",
    category: "guides",
    order: 0,
    content: "<p>Hello world</p>",
    frontmatter: {},
    headings: [],
    links: [],
    wordCount: 10,
    readingTimeMinutes: 1,
    lastModified: new Date(),
    ...overrides,
  };
}

describe("createDefaultTemplate", () => {
  it("has correct name", () => {
    const template = createDefaultTemplate();
    expect(template.name).toBe("default");
  });

  it("render produces valid HTML with title", () => {
    const template = createDefaultTemplate();
    const config = defineDocs({ title: "My Docs", baseUrl: "https://example.com" });

    const html = template.render({
      page: makePage({ title: "Getting Started" }),
      config,
      navItems: [],
      sidebarGroups: [],
    });

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<title>Getting Started - My Docs</title>");
  });

  it("render includes page content", () => {
    const template = createDefaultTemplate();
    const config = defineDocs({ title: "My Docs" });

    const html = template.render({
      page: makePage({ content: "<p>Custom content</p>" }),
      config,
      navItems: [],
      sidebarGroups: [],
    });

    expect(html).toContain("<p>Custom content</p>");
  });

  it("render includes nav items", () => {
    const template = createDefaultTemplate();
    const config = defineDocs({ title: "My Docs" });

    const html = template.render({
      page: makePage(),
      config,
      navItems: [
        { label: "Home", href: "/" },
        { label: "Docs", href: "/docs" },
      ],
      sidebarGroups: [],
    });

    expect(html).toContain('href="/"');
    expect(html).toContain("Home");
    expect(html).toContain('href="/docs"');
    expect(html).toContain("Docs");
  });

  it("render includes sidebar groups", () => {
    const template = createDefaultTemplate();
    const config = defineDocs({ title: "My Docs" });

    const html = template.render({
      page: makePage(),
      config,
      navItems: [],
      sidebarGroups: [
        {
          title: "Getting Started",
          items: [{ label: "Installation", href: "/install" }],
        },
      ],
    });

    expect(html).toContain("Getting Started");
    expect(html).toContain("Installation");
    expect(html).toContain('href="/install"');
  });

  it("render includes meta description", () => {
    const template = createDefaultTemplate();
    const config = defineDocs({ title: "My Docs" });

    const html = template.render({
      page: makePage({ description: "Page description here" }),
      config,
      navItems: [],
      sidebarGroups: [],
    });

    expect(html).toContain('<meta name="description" content="Page description here"');
  });

  it("escapes HTML in title", () => {
    const template = createDefaultTemplate();
    const config = defineDocs({ title: "My Docs" });

    const html = template.render({
      page: makePage({ title: 'Title with "quotes" & <tags>' }),
      config,
      navItems: [],
      sidebarGroups: [],
    });

    expect(html).toContain("&amp;");
    expect(html).toContain("&lt;");
    expect(html).toContain("&quot;");
  });
});
