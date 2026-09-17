import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateScaffold } from "./nextjs/scaffold.js";
import { renderStaticSite } from "./static/renderer.js";
import type { DocumentationIR } from "../documentation/compiler/ir.js";

const here = dirname(fileURLToPath(import.meta.url));

function cssText(): string {
  const scaffold = generateScaffold({ siteName: "T", routes: [], sidebar: [] });
  return scaffold.find((f) => f.path === "app/globals.css")!.contents;
}

function sampleIR(): DocumentationIR {
  const blocks = [
    { kind: "heading", level: 1, text: "T" },
    { kind: "heading", level: 2, text: "H2" },
    { kind: "paragraph", text: "p" },
    { kind: "code", language: "ts", code: "x", title: "t" },
    { kind: "list", ordered: false, items: ["`a`"] },
    { kind: "callout", tone: "warning", text: "w" },
    { kind: "callout", tone: "deprecated", text: "d" },
    { kind: "table", headers: ["H"], rows: [["c"]] },
    { kind: "image", src: "i.png", alt: "a" },
    { kind: "horizontal-rule" },
    { kind: "custom", component: "ApiSignature", props: { name: "f", kind: "function", signature: "f()" } },
    { kind: "custom", component: "ParameterTable", props: { parameters: [{ name: "x", type: "string", description: "d", required: true, rest: false }] } },
    { kind: "custom", component: "TypeDisplay", props: { label: "R", type: "void" } },
    { kind: "custom", component: "TypeParameterTable", props: { typeParameters: [{ name: "T" }] } },
    { kind: "custom", component: "HeritageDisplay", props: { extends: "B" } },
    { kind: "custom", component: "ApiMemberList", props: { members: [{ name: "m", kind: "method", signature: "m()", description: "d", required: true, static: false, readonly: false, access: "private", deprecated: false }] } },
  ] as const;
  return {
    schemaVersion: 1,
    generatedAt: "2026-01-01",
    sections: [{ id: "s", title: "S", pageSlugs: ["a", "b/c"] }],
    pages: [
      { slug: "a", title: "A", sectionId: "s", blocks: [...blocks], examples: [], claims: [], references: [], fingerprint: "a", provenance: "compiler" },
      { slug: "b/c", title: "B", sectionId: "s", blocks: [...blocks], examples: [], claims: [], references: [], fingerprint: "b", provenance: "compiler" },
    ],
    navigation: {
      sidebar: [{ label: "S", children: [{ label: "A", slug: "a" }, { label: "B", slug: "b/c" }] }],
      breadcrumbs: {},
    },
  } as unknown as DocumentationIR;
}

describe("central design system coverage", () => {
  it("defines every vetwo-* class emitted by static HTML, layout and block renderer", () => {
    const css = cssText();
    const site = renderStaticSite(sampleIR(), { siteName: "T" });
    const html = site.files.map((f) => f.contents).join("\n");

    // Class names embedded in the scaffold + static renderer sources.
    const sources = ["nextjs/scaffold.ts", "static/renderer.ts"].map((p) =>
      readFileSync(join(here, p), "utf8"),
    );
    const fromSources = new Set<string>();
    for (const src of [...sources, html]) {
      for (const m of src.matchAll(/vetwo-[a-z]+(?:-[a-z]+)*/g)) fromSources.add(m[0]);
    }

    const missing: string[] = [];
    for (const cls of fromSources) {
      // CSS custom properties (--vetwo-*) are variables, not classes.
      if (css.includes(`--${cls}`)) continue;
      if (css.includes(`.${cls}`)) continue;
      // Dynamic variants (vetwo-callout-warning, vetwo-api-badge-class) resolve via base rule.
      const parts = cls.split("-");
      const base = parts.slice(0, 3).join("-");
      if (parts.length > 3 && css.includes(`.${base}`)) continue;
      if (parts.length > 2 && css.includes(`.${parts.slice(0, 2).join("-")}`)) continue;
      missing.push(cls);
    }
    expect(missing).toEqual([]);
  });

  it("ships responsive, dark-mode and focus rules", () => {
    const css = cssText();
    expect(css).toContain("@media (max-width:");
    expect(css).toContain("prefers-color-scheme: dark");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).toContain(":focus-visible");
    expect(css).toContain(".vetwo-layout");
    expect(css).toContain(".vetwo-sidebar");
    expect(css).toContain(".vetwo-main");
    expect(css).toContain(".vetwo-nav");
  });
});
