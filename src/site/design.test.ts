/**
 * Design system tests: persistent sources, create-missing-only
 * initialization, and renderer consumption.
 *
 * Disk-touching assertions run against a throwaway fixture corpus in a
 * temporary directory — never against the repository's own `design/`
 * sources. In-memory assertions reuse the canonical pipeline (discovery →
 * site model → IR) exactly like the self-hosting regression tests.
 *
 * Contract under test:
 * - the design directory is the persistent source of truth,
 * - initialization creates the missing files only, never overwrites,
 * - every build re-composes the emitted CSS from the sources,
 * - `theme` config values are an explicit override layer on top.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { defineDocs } from "../config/define.js";
import { materializeDocumentation } from "../engine/docs-materialize.js";
import type { Logger } from "../types/internal.js";
import {
  DESIGN_SOURCE_TEMPLATES,
  composeDesignCss,
  defaultDesignCss,
  ensureDesignSources,
  readDesignSources,
  themeOverrideCss,
} from "../renderers/design/sources.js";
import { renderStaticSite } from "../renderers/static/renderer.js";
import { renderFumadocsSite } from "../renderers/fumadocs/renderer.js";
import { discoverContentDocuments } from "./discovery.js";
import { buildSiteModel } from "./model.js";
import { siteModelToIR } from "./adapters.js";
import type { CanonicalDocument, DocumentationSite } from "./types.js";
import type { DocumentationIR } from "../documentation/compiler/ir.js";

const silentLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
  success: () => undefined,
  spin: () => ({ text: () => undefined, stop: () => undefined, succeed: () => undefined }) as never,
  progress: () => undefined,
  box: () => undefined,
  table: () => undefined,
};

const rootDir = process.cwd();
const sourceDir = resolve(rootDir, "md");

let ir: DocumentationIR;

beforeAll(async () => {
  const documents: readonly CanonicalDocument[] = await discoverContentDocuments({
    rootDir,
    sourceDir,
  });
  const site: DocumentationSite = buildSiteModel(documents, {
    siteName: "@vetwo/docs",
    title: "@vetwo/docs — Documentation Engine",
    description: "Self-hosted documentation.",
  });
  ir = siteModelToIR(site);
}, 60_000);

describe("design sources", () => {
  it("exposes a canonical kit of four source files", () => {
    expect(DESIGN_SOURCE_TEMPLATES.map((t) => t.path)).toEqual([
      "design/tokens.css",
      "design/base.css",
      "design/components.css",
      "design/README.md",
    ]);
    for (const template of DESIGN_SOURCE_TEMPLATES) {
      expect(template.contents.length).toBeGreaterThan(0);
    }
  });

  it("composes CSS in tokens → base → components order under a generated banner", () => {
    const sources = readDesignSources(rootDir);
    const css = composeDesignCss(sources);
    const tokens = css.indexOf(sources[0]!.contents.trim());
    // The composed artifact embeds the exact source text for each file.
    for (const source of sources) {
      expect(css).toContain(source.contents.trim());
    }
    const base = css.indexOf(sources[1]!.contents.trim());
    const components = css.indexOf(sources[2]!.contents.trim());
    expect(tokens).toBeGreaterThanOrEqual(0);
    expect(base).toBeGreaterThan(tokens);
    expect(components).toBeGreaterThan(base);
    expect(css.startsWith("/* VeTwo site design")).toBe(true);
  });
});

describe("create-missing-only initialization", () => {
  let root: string;
  let designDir: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "vetwo-design-init-"));
    designDir = join(root, "design");
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("creates the full kit when the design directory is absent", () => {
    const result = ensureDesignSources(root);
    expect(result.created).toEqual(DESIGN_SOURCE_TEMPLATES.map((t) => t.path));
    expect(result.existing).toEqual([]);
    for (const [path, contents] of DESIGN_SOURCE_TEMPLATES.map((t) => [t.path, t.contents])) {
      expect(readFileSync(join(root, path), "utf8")).toBe(contents);
    }
  });

  it("never overwrites existing (customized) sources; only creates the missing", () => {
    const custom = "/* customized */\n:root { --vetwo-accent: #00ff00; }\n";
    writeFileSync(join(designDir, "tokens.css"), custom, "utf8");

    const result = ensureDesignSources(root);
    expect(result.created).toEqual([]);
    expect(result.existing).toEqual(DESIGN_SOURCE_TEMPLATES.map((t) => t.path));
    expect(readFileSync(join(designDir, "tokens.css"), "utf8")).toBe(custom);

    const kappa = ensureDesignSources(root);
    expect(kappa.created).toEqual([]);
  });

  it("builds do not modify design sources in place", async () => {
    const before = DESIGN_SOURCE_TEMPLATES.map((t) => [
      t.path,
      readFileSync(join(root, t.path), "utf8"),
    ]);
    mkdirSync(join(root, "md"), { recursive: true });
    writeFileSync(
      join(root, "md", "index.md"),
      "# Fixture Home\n\nMinimal corpus for the design fixture.\n",
      "utf8",
    );
    await materializeDocumentation(
      root,
      defineDocs({
        title: "Design Fixture",
        description: "Design fixture.",
        source: "./md",
        content: { pipeline: "canonical" },
        output: {
          directory: "./out",
          layout: { next: false, markdown: false, static: true, site: false },
        },
        api: { enabled: false },
        markdown: { extension: ".md" },
      }),
      silentLogger,
    );
    for (const [path, contents] of before) {
      expect(readFileSync(join(root, path), "utf8"), path).toBe(contents);
    }
  });

  it("falls back to embedded defaults only for missing files", async () => {
    const administered = readDesignSources(root);
    expect(administered.map((s) => s.defaulted).every((d) => !d)).toBe(true);

    rmSync(join(designDir, "base.css"), { force: true });
    const mixed = readDesignSources(root);
    const missing = mixed.find((s) => s.path === "design/base.css");
    expect(missing?.defaulted).toBe(true);
    expect(missing?.contents).toBe(DESIGN_SOURCE_TEMPLATES[1]!.contents);

    const css = composeDesignCss(mixed);
    expect(css).toContain("VeTwo Base Styles");
  });

  it("materializes the emitted CSS from customized design sources", async () => {
    // The previous test removed base.css; both tokens.css (custom) and the
    // base.css default flow into the generated artifact.
    const css = readFileSync(join(root, "out", "static", "assets", "css", "globals.css"), "utf8");
    expect(css).toContain("--vetwo-accent: #00ff00;");
    expect(css).toContain("VeTwo Base Styles");
    expect(css).toContain("VeTwo Component Styles");
    expect(css).toContain("GENERATED FILE");
    expect(css).toContain("Source of truth: <root>/design/tokens.css");
  });
});

describe("renderer consumption", () => {
  const custom = "/* custom design css */\n:root { --vetwo-mark: 1; }\n";

  it("static target emits the composed design CSS into assets/css/globals.css", () => {
    const rendered = renderStaticSite(ir, { designCss: custom });
    const css = rendered.files.find((f) => f.path === "assets/css/globals.css");
    expect(css?.contents).toContain(custom);
  });

  it("static pinning via theme colors lands after the design sources", () => {
    const overlay = themeOverrideCss({ colors: { accent: "#123456" } });
    expect(overlay).toContain("--vetwo-accent: #123456;");
    expect(overlay).toContain(":root:not(.dark) {");

    const rendered = renderStaticSite(ir, {
      designCss: `${custom}\n${overlay}`,
    });
    const css = rendered.files.find((f) => f.path === "assets/css/globals.css")!.contents;
    expect(css.indexOf("custom design css")).toBeLessThan(css.indexOf("#123456"));
  });

  it("falls back to the embedded default kit when no design CSS is configured", () => {
    const rendered = renderStaticSite(ir, {});
    const css = rendered.files.find((f) => f.path === "assets/css/globals.css")!.contents;
    expect(css).toContain(defaultDesignCss());
  });

  it("static templates carry the accessibility chrome the design styles", () => {
    const rendered = renderStaticSite(ir, { designCss: custom });
    const html = rendered.files.find((f) => f.path === "index.html")!.contents;
    expect(html).toContain('class="vetwo-skip-link"');
    expect(html).toContain('id="vetwo-main"');
    expect(html).toContain('content="light dark"');
    expect(html).toMatch(/aria-current="page"/);
  });

  it("fumadocs globals embed the design CSS, fd adapter, and theme overrides", () => {
    const rendered = renderFumadocsSite(ir, {
      designCss: custom,
      theme: { colors: { accent: "#123456" } },
    });
    const css = rendered.files.find((f) => f.path === "app/globals.css")!.contents;
    expect(css).toContain('@import "tailwindcss"');
    expect(css).toContain('@import "fumadocs-ui/css/preset.css"');
    expect(css).toContain(custom);
    expect(css).toContain("--color-fd-primary: var(--vetwo-accent);");
    expect(css).toContain("--color-fd-background: var(--vetwo-bg);");
    expect(css).toContain("--vetwo-accent: #123456;");
  });

  it("fumadocs falls back to default design CSS when none is given", () => {
    const rendered = renderFumadocsSite(ir, {});
    const css = rendered.files.find((f) => f.path === "app/globals.css")!.contents;
    expect(css).toContain(defaultDesignCss());
  });
});

describe("theme overrides", () => {
  it("map legacy theme fields onto design tokens", () => {
    const css = themeOverrideCss({
      colors: {
        background: "#010203",
        surface: "#040506",
        text: "#060708",
        muted: "#090a0b",
        primary: "#0c0d0e",
      },
      fonts: { code: "Important Mono, monospace" },
    });
    expect(css).toContain("--vetwo-bg: #010203;");
    expect(css).toContain("--vetwo-surface: #040506;");
    expect(css).toContain("--vetwo-fg: #060708;");
    expect(css).toContain("--vetwo-muted: #090a0b;");
    expect(css).toContain("--vetwo-accent: #0c0d0e;");
    expect(css).toContain("--vetwo-font-code: Important Mono, monospace;");
    // accent wins over primary when both are present.
    const both = themeOverrideCss({ colors: { primary: "#111111", accent: "#222222" } });
    expect(both).not.toContain("#111111");
    expect(both).toContain("--vetwo-accent: #222222;");
  });

  it("produce nothing for empty themes", () => {
    expect(themeOverrideCss(undefined)).toBe("");
    expect(themeOverrideCss({})).toBe("");
    expect(themeOverrideCss({ colors: {}, fonts: {} })).toBe("");
  });
});

describe("repository design kit parity", () => {
  it("embedded defaults mirror the repository design sources", () => {
    for (const template of DESIGN_SOURCE_TEMPLATES) {
      const repoFile = join(rootDir, template.path);
      if (!existsSync(repoFile)) continue;
      expect(readFileSync(repoFile, "utf8")).toBe(template.contents);
    }
  });
});

describe("static rendering quality (shared design consumption)", () => {
  let site: ReturnType<typeof renderStaticSite>;
  let html: string;
  let codePageHtml: string;

  beforeAll(() => {
    site = renderStaticSite(ir, { siteName: "@vetwo/docs" });
    html = site.files.find((f) => f.path === "index.html")!.contents;
    const codePage = site.files.find(
      (f) => f.path.endsWith("index.html") && f.contents.includes("data-language="),
    );
    expect(codePage).toBeDefined();
    codePageHtml = codePage!.contents;
  });

  it("renders inline Markdown spans as HTML (code, emphasis, links)", () => {
    expect(html).toContain("<code>docs.config.ts</code>");
    expect(html).toContain("<strong>Next.js + Fumadocs project</strong>");
    expect(html).not.toContain("**");
    expect(html).not.toContain("<code>`");
    expect(html).toContain("<a href=");
  });

  it("highlights fenced code with shared token classes on the ink panel", () => {
    expect(codePageHtml).toContain("<pre data-language=");
    expect(codePageHtml).toContain('class="vetwo-tok-keyword"');
    expect(codePageHtml).not.toMatch(/<code>[^<]*import registries/);
  });

  it("emits language-neutral page shells that consume the token CSS", () => {
    const css = site.files.find((f) => f.path === "assets/css/globals.css")!;
    expect(css.contents).toContain("--vetwo-code-panel");
    expect(css.contents).toContain(".vetwo-tok-keyword");
    expect(css.contents).toContain("--vetwo-header-h");
  });

  it("marks the current breadcrumb entry for assistive technology", () => {
    const apiPage = site.files.find((f) => f.path.startsWith("api/") && f.path.endsWith("index.html"));
    expect(apiPage).toBeDefined();
    expect(apiPage!.contents).toContain('aria-current="location"');
    expect(apiPage!.contents).toContain("vetwo-crumb-sep");
  });
});
