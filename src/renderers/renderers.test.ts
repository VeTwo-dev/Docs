import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { compileDocumentation } from "../documentation/compiler/index.js";
import type { CompilerProjectInput } from "../documentation/compiler/types.js";
import {
  createNextJsRenderer,
  renderNextJsSite,
  buildRouteManifest,
  normalizeBasePath,
  serializeBlock,
  serializeBlocks,
  serializeFrontmatter,
  serializePage,
  writeRenderedSite,
} from "./index.js";
import type { DocumentationIR } from "../documentation/compiler/ir.js";

// ─── Fixtures ────────────────────────────────────────────────────────────

function projectInput(): CompilerProjectInput {
  return {
    rootDir: "/tmp/lib",
    name: "widget-lib",
    description: "A widget library",
    signals: {
      exportsCount: 3,
      configKeys: ["theme", "output"],
    },
    apis: [
      { name: "createWidget", kind: "function" },
      { name: "destroyWidget", kind: "function" },
      { name: "listWidgets", kind: "function" },
    ],
    concepts: [{ name: "widgets", kind: "concept" }],
  };
}

function compiledIR(): DocumentationIR {
  const { ir } = compileDocumentation(projectInput());
  return ir;
}

// ─── MDX serializer ──────────────────────────────────────────────────────

describe("renderers mdx serializer", () => {
  it("serializes every IR block kind to Markdown", () => {
    const md = serializeBlocks([
      { kind: "heading", level: 2, text: "Usage" },
      { kind: "paragraph", text: "Call the API." },
      { kind: "code", language: "ts", code: "foo()" },
      { kind: "list", ordered: true, items: ["one", "two"] },
      { kind: "callout", tone: "warning", text: "Careful." },
      { kind: "table", headers: ["a"], rows: [["1"]] },
    ]);

    expect(md).toContain("## Usage");
    expect(md).toContain("Call the API.");
    expect(md).toContain("```ts\nfoo()\n```");
    expect(md).toContain("1. one");
    expect(md).toContain("> **Warning:** Careful.");
    expect(md).toContain("| a |\n| --- |\n| 1 |");
  });

  it("emits frontmatter with quoted strings", () => {
    const fm = serializeFrontmatter({ title: 'The "Best" Guide', tags: ["a", "b"] });
    expect(fm).toContain('title: "The \\"Best\\" Guide"');
    expect(fm).toContain('tags: ["a", "b"]');
    expect(fm.startsWith("---\n")).toBe(true);
  });

  it("serializes an IR page end-to-end", () => {
    const ir = compiledIR();
    const firstPage = ir.pages[0];
    expect(firstPage).toBeDefined();
    const mdx = serializePage(ir, firstPage!.slug);
    expect(mdx).toBeDefined();
    expect(mdx).toContain(`title: ${JSON.stringify(firstPage!.title)}`);
    expect(mdx).toContain("# ");
    expect(serializePage(ir, "missing-page")).toBeUndefined();
  });

  it("serializes single blocks", () => {
    expect(serializeBlock({ kind: "paragraph", text: "hi" })).toBe("hi");
  });
});

// ─── Route manifest ──────────────────────────────────────────────────────

describe("renderers nextjs manifest", () => {
  it("maps slugs to routes under the base path", () => {
    const routes = buildRouteManifest(compiledIR(), { docsBasePath: "/docs" });
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      expect(route.route.startsWith("/docs/")).toBe(true);
      expect(route.sectionTitle.length).toBeGreaterThan(0);
    }
  });

  it("normalizes base paths", () => {
    expect(normalizeBasePath(undefined)).toBe("/docs");
    expect(normalizeBasePath("/")).toBe("");
    expect(normalizeBasePath("guide/")).toBe("/guide");
  });
});

// ─── Next.js renderer adapter ────────────────────────────────────────────

describe("renderers nextjs adapter", () => {
  it("produces a complete site file set without touching the filesystem", () => {
    const site = renderNextJsSite(compiledIR(), {
      siteName: "Widget Docs",
      docsBasePath: "/docs",
    });

    const paths = site.files.map((f) => f.path);

    // Scaffold essentials (catch-all route supports nested slugs like api/overview)
    expect(paths).toContain("package.json");
    expect(paths).toContain("next.config.mjs");
    expect(paths).toContain("app/layout.tsx");
    expect(paths).toContain("app/page.tsx");
    expect(paths).toContain("app/docs/[[...slug]]/page.tsx");
    expect(paths).not.toContain("app/docs/[slug]/page.tsx");
    expect(paths).toContain("components/block-renderer.tsx");
    expect(paths).toContain("lib/pages.generated.ts");
    expect(paths).toContain("lib/generated-types.ts");
    expect(site.entrypoint).toBe("app/layout.tsx");

    // Renderer boundary: Markdown/MDX is owned by the Markdown renderer (md/),
    // never emitted inside the Next.js site.
    expect(paths.every((p) => !p.startsWith("content/") && !p.startsWith("md/") && !p.startsWith("static/"))).toBe(true);

    // One JSON payload per route (runtime data model, not MDX)
    for (const route of site.routes) {
      expect(paths).toContain(`data/pages/${encodeURIComponent(route.slug)}.json`);
    }

    // Generated pages module statically imports each page JSON.
    const pagesModule = site.files.find((f) => f.path === "lib/pages.generated.ts")!;
    for (const route of site.routes) {
      expect(pagesModule.contents).toContain(
        JSON.stringify(`../data/pages/${encodeURIComponent(route.slug)}.json`),
      );
    }

    // Layout consumes generated data modules, not compiler code, and imports globals.css.
    const layout = site.files.find((f) => f.path === "app/layout.tsx")!;
    expect(layout.contents).toContain("globals.css");
    expect(layout.contents).not.toContain("compiler");

    // Static export config.
    const config = site.files.find((f) => f.path === "next.config.mjs")!;
    expect(config.contents).toContain('output: "export"');
  });

  it("is deterministic for identical input", () => {
    const a = renderNextJsSite(compiledIR(), { siteName: "X" });
    const b = renderNextJsSite(compiledIR(), { siteName: "X" });
    expect(a.files.map((f) => [f.path, f.contents])).toEqual(
      b.files.map((f) => [f.path, f.contents]),
    );
  });

  it("exposes itself through the SiteRenderer contract", () => {
    const renderer = createNextJsRenderer();
    expect(renderer.target).toBe("nextjs");
    const site = renderer.render(compiledIR(), {});
    expect(site.routes.length).toBeGreaterThan(0);
  });
});

// ─── Writer ──────────────────────────────────────────────────────────────

describe("renderers writer", () => {
  let outDir: string;

  beforeEach(() => {
    outDir = join(mkdtempSync(join(tmpdir(), "vetwo-site-")), "site");
  });

  afterEach(() => {
    rmSync(outDir.split("site")[0]!, { recursive: true, force: true });
  });

  it("writes all files and creates directories", () => {
    const site = renderNextJsSite(compiledIR(), { siteName: "W" });
    const written = writeRenderedSite(site, outDir);

    expect(written.length).toBe(site.files.length);
    expect(existsSync(join(outDir, "app/layout.tsx"))).toBe(true);
    expect(existsSync(join(outDir, "components/block-renderer.tsx"))).toBe(true);

    const firstRoute = site.routes[0]!;
    const pageJson = JSON.parse(
      readFileSync(
        join(outDir, "data/pages", `${encodeURIComponent(firstRoute.slug)}.json`),
        "utf-8",
      ),
    ) as { slug: string; title: string };
    expect(pageJson.slug).toBe(firstRoute.slug);
    expect(Array.isArray(pageJson.blocks)).toBe(true);
  });

  it("refuses path traversal outside the output directory", () => {
    const hostile = {
      target: "nextjs" as const,
      entrypoint: "app/layout.tsx",
      files: [
        { path: "../evil.txt", contents: "nope" },
        { path: "ok.txt", contents: "yes" },
      ],
      routes: [],
    };
    expect(() => writeRenderedSite(hostile, outDir)).toThrow(/outside output directory/);
    expect(existsSync(join(outDir, "..", "evil.txt"))).toBe(false);
  });
});
