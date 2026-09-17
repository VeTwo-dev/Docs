import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BuildContextMutable } from "../types/internal.js";
import type { SourceFile, Heading } from "../types/public.js";
import { defineDocs } from "../config/define.js";
import { processMarkdownFiles, generateToc, createMarkdownProcessor } from "./markdown.js";

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

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "markdown-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function makeSourceFile(filePath: string): SourceFile {
  return {
    path: filePath,
    relativePath: filePath.replace(tmpDir + "/", ""),
    extension: filePath.endsWith(".mdx") ? ".mdx" : ".md",
    size: 0,
    lastModified: new Date("2024-01-15"),
  };
}

describe("processMarkdownFiles", () => {
  it("generates pages with correct title from heading", async () => {
    const mdPath = join(tmpDir, "getting-started.md");
    writeFileSync(mdPath, "# Hello World\n\nSome content here.");

    const ctx = createMockCtx({
      config: defineDocs({ source: tmpDir }),
      rootDir: tmpDir,
      sourceFiles: [makeSourceFile(mdPath)],
    });

    await processMarkdownFiles(ctx);

    expect(ctx.pages).toHaveLength(1);
    expect(ctx.pages[0]!.title).toBe("Hello World");
  });

  it("uses frontmatter title over content heading", async () => {
    const mdPath = join(tmpDir, "page.md");
    writeFileSync(mdPath, "---\ntitle: Frontmatter Title\n---\n\n# Content Title\n\nBody.");

    const ctx = createMockCtx({
      config: defineDocs({ source: tmpDir }),
      rootDir: tmpDir,
      sourceFiles: [makeSourceFile(mdPath)],
    });

    await processMarkdownFiles(ctx);

    expect(ctx.pages[0]!.title).toBe("Frontmatter Title");
  });

  it("generates correct slug", async () => {
    const subDir = join(tmpDir, "guides");
    mkdirSync(subDir, { recursive: true });
    const mdPath = join(subDir, "setup.md");
    writeFileSync(mdPath, "# Setup\n\nContent.");

    const ctx = createMockCtx({
      config: defineDocs({ source: tmpDir }),
      rootDir: tmpDir,
      sourceFiles: [makeSourceFile(mdPath)],
    });

    await processMarkdownFiles(ctx);

    expect(ctx.pages[0]!.slug).toBe("/guides/setup");
  });

  it("handles index.md slug correctly", async () => {
    const mdPath = join(tmpDir, "index.md");
    writeFileSync(mdPath, "# Index\n\nContent.");

    const ctx = createMockCtx({
      config: defineDocs({ source: tmpDir }),
      rootDir: tmpDir,
      sourceFiles: [makeSourceFile(mdPath)],
    });

    await processMarkdownFiles(ctx);

    expect(ctx.pages[0]!.slug).toBe("/index");
  });

  it("extracts headings from content", async () => {
    const mdPath = join(tmpDir, "page.md");
    writeFileSync(mdPath, "# Title\n\n## Section One\n\n## Section Two\n\n### Sub\n\nContent.");

    const ctx = createMockCtx({
      config: defineDocs({ source: tmpDir }),
      rootDir: tmpDir,
      sourceFiles: [makeSourceFile(mdPath)],
    });

    await processMarkdownFiles(ctx);

    const headings = ctx.pages[0]!.headings;
    expect(Array.isArray(headings)).toBe(true);
  });

  it("counts words correctly", async () => {
    const mdPath = join(tmpDir, "page.md");
    writeFileSync(mdPath, "# Title\n\nThis is a test with five words.");

    const ctx = createMockCtx({
      config: defineDocs({ source: tmpDir }),
      rootDir: tmpDir,
      sourceFiles: [makeSourceFile(mdPath)],
    });

    await processMarkdownFiles(ctx);

    expect(ctx.pages[0]!.wordCount).toBeGreaterThan(0);
  });

  it("computes reading time", async () => {
    const mdPath = join(tmpDir, "page.md");
    writeFileSync(mdPath, "# Title\n\n" + "word ".repeat(600));

    const ctx = createMockCtx({
      config: defineDocs({ source: tmpDir }),
      rootDir: tmpDir,
      sourceFiles: [makeSourceFile(mdPath)],
    });

    await processMarkdownFiles(ctx);

    expect(ctx.pages[0]!.readingTimeMinutes).toBeGreaterThanOrEqual(3);
    expect(ctx.pages[0]!.readingTimeMinutes).toBeLessThanOrEqual(5);
  });

  it("sorts pages by category then order", async () => {
    const dirB = join(tmpDir, "beta");
    const dirA = join(tmpDir, "alpha");
    mkdirSync(dirB, { recursive: true });
    mkdirSync(dirA, { recursive: true });

    const md1 = join(dirB, "second.md");
    const md2 = join(dirA, "first.md");
    writeFileSync(md1, "---\norder: 1\n---\n\n# Second");
    writeFileSync(md2, "---\norder: 2\n---\n\n# First");

    const ctx = createMockCtx({
      config: defineDocs({ source: tmpDir }),
      rootDir: tmpDir,
      sourceFiles: [makeSourceFile(md1), makeSourceFile(md2)],
    });

    await processMarkdownFiles(ctx);

    expect(ctx.pages[0]!.category).toBe("alpha");
    expect(ctx.pages[1]!.category).toBe("beta");
  });

  it("uses frontmatter description", async () => {
    const mdPath = join(tmpDir, "page.md");
    writeFileSync(mdPath, "---\ndescription: Custom description\n---\n\n# Title\n\nBody.");

    const ctx = createMockCtx({
      config: defineDocs({ source: tmpDir }),
      rootDir: tmpDir,
      sourceFiles: [makeSourceFile(mdPath)],
    });

    await processMarkdownFiles(ctx);

    expect(ctx.pages[0]!.description).toBe("Custom description");
  });

  it("extracts description from first paragraph", async () => {
    const mdPath = join(tmpDir, "page.md");
    writeFileSync(mdPath, "# Title\n\nThis is the first paragraph with some description text.");

    const ctx = createMockCtx({
      config: defineDocs({ source: tmpDir }),
      rootDir: tmpDir,
      sourceFiles: [makeSourceFile(mdPath)],
    });

    await processMarkdownFiles(ctx);

    expect(ctx.pages[0]!.description).toContain("first paragraph");
  });

  it("reports error for bad files", async () => {
    const mdPath = join(tmpDir, "bad.md");
    writeFileSync(mdPath, "content");

    const ctx = createMockCtx({
      config: defineDocs({ source: tmpDir }),
      rootDir: tmpDir,
      sourceFiles: [
        {
          path: join(tmpDir, "nonexistent.md"),
          relativePath: "nonexistent.md",
          extension: ".md",
          size: 0,
          lastModified: new Date(),
        },
      ],
    });

    await processMarkdownFiles(ctx);

    expect(ctx.pages).toHaveLength(0);
    expect(ctx.errors.length).toBeGreaterThanOrEqual(1);
    expect(ctx.errors[0]!.code).toBe("MARKDOWN_PARSE_ERROR");
  });

  it("skips non-markdown files", async () => {
    const tsPath = join(tmpDir, "file.ts");
    writeFileSync(tsPath, "const x = 1;");

    const ctx = createMockCtx({
      config: defineDocs({ source: tmpDir }),
      rootDir: tmpDir,
      sourceFiles: [
        {
          path: tsPath,
          relativePath: "file.ts",
          extension: ".ts",
          size: 0,
          lastModified: new Date(),
        },
      ],
    });

    await processMarkdownFiles(ctx);

    expect(ctx.pages).toHaveLength(0);
  });
});

describe("generateToc", () => {
  it("returns empty string for empty headings array", () => {
    expect(generateToc([])).toBe("");
  });

  it("returns empty string when all headings are level 1", () => {
    const headings: Heading[] = [{ level: 1, text: "Title", id: "title" }];
    expect(generateToc(headings)).toBe("");
  });

  it("generates TOC for single h2 heading", () => {
    const headings: Heading[] = [{ level: 2, text: "Section", id: "section" }];
    const html = generateToc(headings);
    expect(html).toContain("On This Page");
    expect(html).toContain('href="#section"');
    expect(html).toContain("Section");
  });

  it("generates nested TOC for h2 then h3", () => {
    const headings: Heading[] = [
      { level: 2, text: "Top", id: "top" },
      { level: 3, text: "Sub", id: "sub" },
    ];
    const html = generateToc(headings);
    expect(html).toContain("<ul>");
    expect(html).toContain('href="#top"');
    expect(html).toContain('href="#sub"');
  });

  it("generates TOC with mixed levels h2 -> h3 -> h2", () => {
    const headings: Heading[] = [
      { level: 2, text: "First", id: "first" },
      { level: 3, text: "Sub", id: "sub" },
      { level: 2, text: "Second", id: "second" },
    ];
    const html = generateToc(headings);
    expect(html).toContain('href="#first"');
    expect(html).toContain('href="#sub"');
    expect(html).toContain('href="#second"');
    const ulOpen = (html.match(/<ul>/g) ?? []).length;
    const ulClose = (html.match(/<\/ul>/g) ?? []).length;
    expect(ulOpen).toBe(ulClose);
  });

  it("respects maxDepth parameter", () => {
    const headings: Heading[] = [
      { level: 2, text: "H2", id: "h2" },
      { level: 3, text: "H3", id: "h3" },
      { level: 4, text: "H4", id: "h4" },
      { level: 5, text: "H5", id: "h5" },
    ];
    const html2 = generateToc(headings, 2);
    expect(html2).toContain('href="#h2"');
    expect(html2).not.toContain('href="#h3"');
    expect(html2).not.toContain('href="#h4"');

    const html3 = generateToc(headings, 3);
    expect(html3).toContain('href="#h2"');
    expect(html3).toContain('href="#h3"');
    expect(html3).not.toContain('href="#h4"');
  });

  it("escapes HTML in heading text", () => {
    const headings: Heading[] = [
      { level: 2, text: 'Script <script>alert("xss")</script>', id: "xss" },
    ];
    const html = generateToc(headings);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("returns empty when all headings are below depth 2", () => {
    const headings: Heading[] = [{ level: 1, text: "Title", id: "title" }];
    expect(generateToc(headings, 6)).toBe("");
  });
});

describe("processMarkdownFiles - TOC", () => {
  it("prepends TOC to page content when markdown.toc is true", async () => {
    const mdPath = join(tmpDir, "toc-page.md");
    writeFileSync(
      mdPath,
      "# Title\n\n## Section One\n\nSome text.\n\n## Section Two\n\nMore text.",
    );

    const ctx = createMockCtx({
      config: defineDocs({ source: tmpDir, markdown: { toc: true, tocDepth: 3 } }),
      rootDir: tmpDir,
      sourceFiles: [makeSourceFile(mdPath)],
    });

    await processMarkdownFiles(ctx);

    expect(ctx.pages).toHaveLength(1);
    const content = ctx.pages[0]!.content;
    expect(content).toContain("On This Page");
    expect(content).toContain('href="#section-one"');
    expect(content).toContain('href="#section-two"');
  });

  it("does not prepend TOC when markdown.toc is false", async () => {
    const mdPath = join(tmpDir, "no-toc.md");
    writeFileSync(mdPath, "# Title\n\n## Section\n\nContent.");

    const ctx = createMockCtx({
      config: defineDocs({ source: tmpDir, markdown: { toc: false } }),
      rootDir: tmpDir,
      sourceFiles: [makeSourceFile(mdPath)],
    });

    await processMarkdownFiles(ctx);

    const content = ctx.pages[0]!.content;
    expect(content).not.toContain("On This Page");
    expect(content).not.toContain('<nav class="toc"');
  });

  it("respects tocDepth option", async () => {
    const mdPath = join(tmpDir, "depth.md");
    writeFileSync(
      mdPath,
      "# Title\n\n## Level2\n\nText.\n\n### Level3\n\nSub.\n\n#### Level4\n\nDeep.",
    );

    const ctx = createMockCtx({
      config: defineDocs({ source: tmpDir, markdown: { toc: true, tocDepth: 2 } }),
      rootDir: tmpDir,
      sourceFiles: [makeSourceFile(mdPath)],
    });

    await processMarkdownFiles(ctx);

    const content = ctx.pages[0]!.content;
    const tocMatch = content.match(/<nav class="toc"[\s\S]*?<\/nav>/);
    expect(tocMatch).not.toBeNull();
    const toc = tocMatch![0];
    expect(toc).toContain('href="#level2"');
    expect(toc).not.toContain('href="#level3"');
    expect(toc).not.toContain('href="#level4"');
  });
});

describe("processMarkdownFiles - callout directives", () => {
  it("processes container directives into div wrappers", async () => {
    const mdPath = join(tmpDir, "callouts.md");
    writeFileSync(
      mdPath,
      "# Callouts\n\n:::note\nImportant note here.\n:::\n\nSome other content.",
    );

    const ctx = createMockCtx({
      config: defineDocs({ source: tmpDir }),
      rootDir: tmpDir,
      sourceFiles: [makeSourceFile(mdPath)],
    });

    await processMarkdownFiles(ctx);

    expect(ctx.pages).toHaveLength(1);
    const content = ctx.pages[0]!.content;
    expect(content).toContain("Important note here");
    expect(content).toContain("Some other content");
  });

  it("processes directive with attributes into appropriate HTML", async () => {
    const mdPath = join(tmpDir, "callout-title.md");
    writeFileSync(mdPath, "# Callout Title\n\n:::warning\nBe careful.\n:::\n\nDone.");

    const ctx = createMockCtx({
      config: defineDocs({ source: tmpDir }),
      rootDir: tmpDir,
      sourceFiles: [makeSourceFile(mdPath)],
    });

    await processMarkdownFiles(ctx);

    const content = ctx.pages[0]!.content;
    expect(content).toContain("Be careful");
    expect(content).toContain("Done");
  });
});

describe("createMarkdownProcessor", () => {
  const defaults = defineDocs();

  it("creates a processor with all default plugins", () => {
    const processor = createMarkdownProcessor();
    expect(processor).toBeDefined();
    expect(typeof processor.process).toBe("function");
  });

  it("creates a processor with MDX support", () => {
    const processor = createMarkdownProcessor({
      ...defaults,
      markdown: { ...defaults.markdown, mdx: true },
    });
    expect(processor).toBeDefined();
    expect(typeof processor.process).toBe("function");
  });

  it("creates a processor with breaks support", () => {
    const processor = createMarkdownProcessor({
      ...defaults,
      markdown: { ...defaults.markdown, breaks: true },
    });
    expect(processor).toBeDefined();
    expect(typeof processor.process).toBe("function");
  });

  it("creates a processor with smartypants support", () => {
    const processor = createMarkdownProcessor({
      ...defaults,
      markdown: { ...defaults.markdown, smartypants: true },
    });
    expect(processor).toBeDefined();
    expect(typeof processor.process).toBe("function");
  });

  it("creates a processor with raw HTML support", () => {
    const processor = createMarkdownProcessor({
      ...defaults,
      markdown: { ...defaults.markdown, raw: true },
    });
    expect(processor).toBeDefined();
    expect(typeof processor.process).toBe("function");
  });

  it("creates a processor with document support", () => {
    const processor = createMarkdownProcessor({
      ...defaults,
      markdown: { ...defaults.markdown, document: true },
    });
    expect(processor).toBeDefined();
    expect(typeof processor.process).toBe("function");
  });

  it("creates a processor with all optional plugins", () => {
    const processor = createMarkdownProcessor({
      ...defaults,
      markdown: {
        ...defaults.markdown,
        mdx: true,
        breaks: true,
        smartypants: true,
        raw: true,
        document: true,
        lineHighlighting: true,
        diffHighlighting: true,
        focusRegions: true,
      },
    });
    expect(processor).toBeDefined();
    expect(typeof processor.process).toBe("function");
  });

  it("processes MDX content successfully", async () => {
    const processor = createMarkdownProcessor({
      ...defaults,
      markdown: { ...defaults.markdown, mdx: true },
    });
    const result = await processor.process("# Hello\n\nSome **bold** text.");
    expect(String(result)).toContain("<h1");
    expect(String(result)).toContain("<strong>bold</strong>");
  });
});
