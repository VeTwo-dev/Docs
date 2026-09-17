import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BuildContextMutable } from "../types/internal.js";
import type { DocPage } from "../types/public.js";
import { defineDocs } from "../config/define.js";
import { writePages } from "./output.js";

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
    content: "<p>Hello content</p>",
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
  tmpDir = mkdtempSync(join(tmpdir(), "output-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("writePages", () => {
  it("writes HTML files for each page", () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      config: defineDocs({ title: "My Docs" }),
      outputDir,
      pages: [
        makePage({ slug: "/page-a", title: "Page A" }),
        makePage({ slug: "/page-b", title: "Page B" }),
      ],
    });

    writePages(ctx);

    expect(readFileSync(join(outputDir, "page-a.html"), "utf-8")).toBeDefined();
    expect(readFileSync(join(outputDir, "page-b.html"), "utf-8")).toBeDefined();
  });

  it("HTML contains page title", () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      config: defineDocs({ title: "My Docs" }),
      outputDir,
      pages: [makePage({ slug: "/my-page", title: "My Page" })],
    });

    writePages(ctx);

    const html = readFileSync(join(outputDir, "my-page.html"), "utf-8");
    expect(html).toContain("<title>My Page - My Docs</title>");
    expect(html).toContain("<h1>My Page</h1>");
  });

  it("HTML contains page content", () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      config: defineDocs({ title: "My Docs" }),
      outputDir,
      pages: [makePage({ slug: "/page", content: "<p>Custom content here</p>" })],
    });

    writePages(ctx);

    const html = readFileSync(join(outputDir, "page.html"), "utf-8");
    expect(html).toContain("<p>Custom content here</p>");
  });

  it("HTML contains nav items", () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      config: defineDocs({ title: "My Docs" }),
      outputDir,
      navItems: [{ label: "Home", href: "/" }],
      pages: [makePage({ slug: "/page" })],
    });

    writePages(ctx);

    const html = readFileSync(join(outputDir, "page.html"), "utf-8");
    expect(html).toContain('href="/"');
    expect(html).toContain("Home");
  });

  it("escapes HTML in title", () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      config: defineDocs({ title: "My Docs" }),
      outputDir,
      pages: [makePage({ slug: "/page", title: 'Page with "quotes" & <special>' })],
    });

    writePages(ctx);

    const html = readFileSync(join(outputDir, "page.html"), "utf-8");
    expect(html).toContain("&amp;");
    expect(html).toContain("&lt;");
    expect(html).toContain("&quot;");
  });

  it("does nothing when no pages", () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({ outputDir, pages: [] });

    writePages(ctx);

    expect(() => readFileSync(join(outputDir, "page.html"))).toThrow();
  });

  it("generates styles.css with theme variables", () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      outputDir,
      pages: [makePage()],
    });

    writePages(ctx);

    const css = readFileSync(join(outputDir, "styles.css"), "utf-8");
    expect(css).toContain("--light-primary:");
    expect(css).toContain("--dark-primary:");
    expect(css).toContain("data-theme");
  });

  it("includes dark mode toggle script", () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      outputDir,
      pages: [makePage()],
    });

    writePages(ctx);

    const html = readFileSync(join(outputDir, "test-page.html"), "utf-8");
    expect(html).toContain("theme-toggle");
    expect(html).toContain("data-theme");
    expect(html).toContain("localStorage");
  });

  it("links to styles.css", () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      outputDir,
      pages: [makePage()],
    });

    writePages(ctx);

    const html = readFileSync(join(outputDir, "test-page.html"), "utf-8");
    expect(html).toContain('href="/styles.css"');
  });

  it("includes OG meta tags", () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      outputDir,
      pages: [makePage({ title: "OG Test", description: "OG description" })],
    });

    writePages(ctx);

    const html = readFileSync(join(outputDir, "test-page.html"), "utf-8");
    expect(html).toContain('property="og:title"');
    expect(html).toContain('property="og:description"');
  });

  it("writes prev/next navigation for multiple pages", () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      config: defineDocs({ title: "Nav Test" }),
      outputDir,
      pages: [
        makePage({ slug: "/first", title: "First" }),
        makePage({ slug: "/second", title: "Second" }),
        makePage({ slug: "/third", title: "Third" }),
      ],
    });

    writePages(ctx);

    const firstHtml = readFileSync(join(outputDir, "first.html"), "utf-8");
    expect(firstHtml).toContain("prev-next-nav");
    expect(firstHtml).toContain("Second");
    expect(firstHtml).not.toContain("First &rarr;");

    const midHtml = readFileSync(join(outputDir, "second.html"), "utf-8");
    expect(midHtml).toContain("First");
    expect(midHtml).toContain("Third");

    const lastHtml = readFileSync(join(outputDir, "third.html"), "utf-8");
    expect(lastHtml).toContain("Second");
  });

  it("writes API doc pages with parameters", () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      config: defineDocs({ title: "API Test" }),
      outputDir,
      pages: [],
      apiDocs: [
        {
          name: "My Function",
          kind: "function",
          description: "Does something",
          signature: "function myFn(): void",
          parameters: [
            {
              name: "x",
              type: "number",
              description: "First arg",
              required: true,
              defaultValue: undefined,
            },
            {
              name: "y",
              type: "string",
              description: "Second arg",
              required: false,
              defaultValue: "'hello'",
            },
          ],
          returnType: "void",
          examples: [],
          sourceFile: "src/index.ts",
          since: undefined,
          deprecated: false,
          tags: ["utility"],
        },
      ],
    });

    writePages(ctx);

    const apiHtml = readFileSync(join(outputDir, "api/my-function.html"), "utf-8");
    expect(apiHtml).toContain("My Function");
    expect(apiHtml).toContain("Does something");
    expect(apiHtml).toContain("function myFn(): void");
    expect(apiHtml).toContain("Parameters");
    expect(apiHtml).toContain("First arg");
    expect(apiHtml).toContain("Second arg");
    expect(apiHtml).toContain("function");
    expect(apiHtml).toContain("utility");
  });

  it("handles theme as object with logo and favicon", () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      config: defineDocs({
        title: "Theme Obj",
        theme: { name: "midnight", logo: "/images/logo.svg", favicon: "/favicon.ico" },
      }),
      outputDir,
      pages: [makePage({ slug: "/page" })],
    });

    writePages(ctx);

    const html = readFileSync(join(outputDir, "page.html"), "utf-8");
    expect(html).toContain('src="/images/logo.svg"');
    expect(html).toContain('href="/favicon.ico"');
  });

  it("handles theme as string", () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      config: defineDocs({ title: "Theme Str", theme: "midnight" }),
      outputDir,
      pages: [makePage({ slug: "/page" })],
    });

    writePages(ctx);

    const html = readFileSync(join(outputDir, "page.html"), "utf-8");
    expect(html).not.toContain("header-logo");
  });

  it("includes RSS link when rss is enabled", () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      config: defineDocs({ title: "RSS Test", rss: true }),
      outputDir,
      pages: [makePage({ slug: "/page" })],
    });

    writePages(ctx);

    const html = readFileSync(join(outputDir, "page.html"), "utf-8");
    expect(html).toContain("application/rss+xml");
    expect(html).toContain("feed.xml");
  });

  it("omits RSS link when rss is disabled", () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      config: defineDocs({ title: "No RSS" }),
      outputDir,
      pages: [makePage({ slug: "/page" })],
    });

    writePages(ctx);

    const html = readFileSync(join(outputDir, "page.html"), "utf-8");
    expect(html).not.toContain("application/rss+xml");
  });

  it("omits OG image when og is false", () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      config: defineDocs({ title: "No OG", og: false }),
      outputDir,
      pages: [makePage({ slug: "/page" })],
    });

    writePages(ctx);

    const html = readFileSync(join(outputDir, "page.html"), "utf-8");
    expect(html).not.toContain("og:image");
  });

  it("includes search wrapper when search is enabled", () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      config: defineDocs({ title: "Search On", search: { enabled: true } }),
      outputDir,
      pages: [makePage({ slug: "/page" })],
    });

    writePages(ctx);

    const html = readFileSync(join(outputDir, "page.html"), "utf-8");
    expect(html).toContain("search-link");
    expect(html).toContain("search.html");
  });

  it("omits search wrapper when search is disabled", () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      config: defineDocs({ title: "Search Off", search: { enabled: false } }),
      outputDir,
      pages: [makePage({ slug: "/page" })],
    });

    writePages(ctx);

    const html = readFileSync(join(outputDir, "page.html"), "utf-8");
    expect(html).not.toContain("search-wrapper");
  });

  it("renders sidebar groups", () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      config: defineDocs({ title: "Sidebar Test" }),
      outputDir,
      pages: [makePage({ slug: "/page" })],
      sidebarGroups: [{ title: "Getting Started", items: [{ label: "Intro", href: "/intro" }] }],
    });

    writePages(ctx);

    const html = readFileSync(join(outputDir, "page.html"), "utf-8");
    expect(html).toContain("Getting Started");
    expect(html).toContain("Intro");
    expect(html).toContain('href="/intro"');
  });

  it("writes search.js and search.html files", () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      outputDir,
      pages: [makePage()],
    });

    writePages(ctx);

    const jsContent = readFileSync(join(outputDir, "search.js"), "utf-8");
    expect(jsContent).toContain("performSearch");
    expect(jsContent).toContain("loadSearchIndex");

    const htmlContent = readFileSync(join(outputDir, "search.html"), "utf-8");
    expect(htmlContent).toContain("search-input");
    expect(htmlContent).toContain("initSearch");
  });

  it("renders sidebar with collapsed group and items without href", () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      config: defineDocs({ title: "Collapsed" }),
      outputDir,
      pages: [makePage({ slug: "/page" })],
      sidebarGroups: [
        {
          title: "Group",
          items: [{ label: "Has Link", href: "/link" }, { label: "No Link" }],
        },
      ],
    });

    writePages(ctx);

    const html = readFileSync(join(outputDir, "page.html"), "utf-8");
    expect(html).toContain("Has Link");
    expect(html).toContain("No Link");
    expect(html).toContain('href="#"');
  });

  it("includes twitter card meta with seo.twitter", () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      config: defineDocs({ title: "Twitter", seo: { twitter: "@myhandle" } }),
      outputDir,
      pages: [makePage({ slug: "/page" })],
    });

    writePages(ctx);

    const html = readFileSync(join(outputDir, "page.html"), "utf-8");
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain("@myhandle");
  });

  it("handles empty nav items", () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      config: defineDocs({ title: "Empty Nav" }),
      outputDir,
      pages: [makePage({ slug: "/page" })],
      navItems: [],
    });

    writePages(ctx);

    const html = readFileSync(join(outputDir, "page.html"), "utf-8");
    expect(html).not.toContain("header-nav");
  });

  it("renders API page with return type and tags", () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      config: defineDocs({ title: "API Tags" }),
      outputDir,
      pages: [],
      apiDocs: [
        {
          name: "compute",
          kind: "function",
          description: "Compute value",
          signature: "compute(): number",
          parameters: [],
          returnType: "number",
          examples: [],
          sourceFile: "src/compute.ts",
          since: undefined,
          deprecated: true,
          tags: ["math", "core"],
        },
      ],
    });

    writePages(ctx);

    const apiHtml = readFileSync(join(outputDir, "api/compute.html"), "utf-8");
    expect(apiHtml).toContain("number");
    expect(apiHtml).toContain("math");
    expect(apiHtml).toContain("core");
    expect(apiHtml).not.toContain("Parameters");
  });

  it("strips trailing slash from baseUrl", () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      config: defineDocs({ title: "Slash", baseUrl: "https://example.com/" }),
      outputDir,
      pages: [makePage({ slug: "/page" })],
    });

    writePages(ctx);

    const html = readFileSync(join(outputDir, "page.html"), "utf-8");
    expect(html).toContain('href="https://example.com/page"');
    expect(html).not.toContain("example.com//page");
  });

  it("renders empty sidebar groups correctly", () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      config: defineDocs({ title: "Empty Sidebar" }),
      outputDir,
      pages: [makePage({ slug: "/page" })],
      sidebarGroups: [],
    });

    writePages(ctx);

    const html = readFileSync(join(outputDir, "page.html"), "utf-8");
    expect(html).not.toContain("sidebar");
  });

  it("renders theme as object without name (falls back to default)", () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      config: defineDocs({
        title: "No Name Theme",
        theme: { logo: "/logo.png" },
      }),
      outputDir,
      pages: [makePage({ slug: "/page" })],
    });

    writePages(ctx);

    const html = readFileSync(join(outputDir, "page.html"), "utf-8");
    expect(html).toContain('src="/logo.png"');
  });

  it("does not include prev/next nav for single page", () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      config: defineDocs({ title: "Single" }),
      outputDir,
      pages: [makePage({ slug: "/only", title: "Only" })],
    });

    writePages(ctx);

    const html = readFileSync(join(outputDir, "only.html"), "utf-8");
    expect(html).not.toContain("prev-next-nav");
  });

  it("renders multiple sidebar groups", () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      config: defineDocs({ title: "Multi Group" }),
      outputDir,
      pages: [makePage({ slug: "/page" })],
      sidebarGroups: [
        { title: "Group A", items: [{ label: "Item A", href: "/a" }] },
        { title: "Group B", items: [{ label: "Item B", href: "/b" }] },
      ],
    });

    writePages(ctx);

    const html = readFileSync(join(outputDir, "page.html"), "utf-8");
    expect(html).toContain("Group A");
    expect(html).toContain("Group B");
    expect(html).toContain("Item A");
    expect(html).toContain("Item B");
  });

  it("renders API page with no description", () => {
    const outputDir = join(tmpDir, "output");
    const ctx = createMockCtx({
      config: defineDocs({ title: "No Desc API" }),
      outputDir,
      pages: [],
      apiDocs: [
        {
          name: "bare",
          kind: "function",
          description: "",
          signature: "bare()",
          parameters: [],
          returnType: "void",
          examples: [],
          sourceFile: "src/bare.ts",
          since: undefined,
          deprecated: false,
          tags: [],
        },
      ],
    });

    writePages(ctx);

    const apiHtml = readFileSync(join(outputDir, "api/bare.html"), "utf-8");
    expect(apiHtml).toContain("bare");
    expect(apiHtml).toContain("api-badge");
    expect(apiHtml).not.toContain("api-description");
  });
});
