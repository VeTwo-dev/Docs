import { describe, it, expect } from "vitest";
import { compileDocumentation } from "./orchestrator.js";
import { validateIRPages, validateBreadcrumbs } from "./validator.js";
import type { CompilerProjectInput, ComposedExample } from "./types.js";

function fixtureInput(): CompilerProjectInput {
  return {
    rootDir: "/tmp/fixture-lib",
    name: "fixture-lib",
    description: "A tiny fixture library.",
    version: "1.0.0",
    signals: {
      hasBin: false,
      isMonorepo: false,
      configKeys: ["title", "baseUrl"],
      commands: [],
      examples: ["examples/basic.ts"],
    },
    apis: [
      { name: "add", kind: "function", signature: "number", description: "Adds two numbers.", sourceFile: "src/index.ts", boundary: "public" },
      { name: "greet", kind: "function", signature: "string", description: "Greets.", sourceFile: "src/index.ts", boundary: "public" },
    ],
    apiSymbols: [
      {
        id: "1",
        name: "add",
        qualifiedName: "add",
        kind: "function",
        returnType: "number",
        parameters: [
          { name: "a", type: "number", description: "first", required: true, rest: false },
          { name: "b", type: "number", description: "second", required: true, rest: false },
        ],
        documentation: {
          summary: "Adds two numbers.",
          params: [{ name: "a", description: "first" }],
          examples: [{ code: "const total = add(2, 3);", language: "ts" }],
          throws: [],
          see: [],
        },
        sourceFile: "src/index.ts",
        line: 1,
        column: 1,
        exported: true,
        deprecated: false,
        boundary: "public",
      },
    ],
    concepts: [{ name: "Addition", kind: "concept", relatedApis: ["add"] }],
  };
}

function fixtureExamples(): ComposedExample[] {
  return [
    {
      id: "jsdoc:add:0",
      title: "add example",
      code: "const total = add(2, 3);",
      language: "ts",
      source: "JSDoc @example of `add`",
      owner: "add",
      purpose: "Adds two numbers.",
    },
  ];
}

describe("page composition", () => {
  it("never emits H1 title blocks (title lives in metadata)", () => {
    const { ir } = compileDocumentation(fixtureInput(), {}, { examples: fixtureExamples() });
    expect(ir.pages.length).toBeGreaterThan(0);
    for (const page of ir.pages) {
      expect(
        page.blocks.filter((b) => b.kind === "heading" && (b as { level?: number }).level === 1),
        `page ${page.slug} has H1 block`,
      ).toEqual([]);
    }
    expect(validateIRPages(ir.pages).filter((d) => d.code === "DOC_DUPLICATE_TITLE")).toEqual([]);
  });

  it("never repeats the summary paragraph as a body block", () => {
    const { ir } = compileDocumentation(fixtureInput(), {}, { examples: fixtureExamples() });
    for (const page of ir.pages) {
      if (page.description === undefined || page.description.length === 0) continue;
      const dupes = page.blocks.filter((b) => b.kind === "paragraph" && (b as { text?: string }).text === page.description);
      expect(dupes, `page ${page.slug} repeats summary`).toEqual([]);
    }
  });

  it("breadcrumbs have no adjacent duplicates and no self link", () => {
    const { ir } = compileDocumentation(fixtureInput(), {}, { examples: fixtureExamples() });
    expect(validateBreadcrumbs(ir.navigation.breadcrumbs)).toEqual([]);
    const examplesTrail = ir.navigation.breadcrumbs["examples"];
    if (examplesTrail !== undefined) {
      const labels = examplesTrail.map((c) => c.label);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  it("examples page materializes real code, not discovery prose", () => {
    const { ir } = compileDocumentation(fixtureInput(), {}, { examples: fixtureExamples() });
    const page = ir.pages.find((p) => p.slug === "examples");
    expect(page).toBeDefined();
    const code = page!.blocks.filter((b) => b.kind === "code");
    expect(code.length).toBeGreaterThan(0);
    expect(JSON.stringify(page!.blocks)).toContain("const total = add(2, 3);");
    expect(JSON.stringify(page!.blocks)).not.toContain("Examples are discovered from");
  });

  it("installation page contains real package-manager commands", () => {
    const { ir } = compileDocumentation(fixtureInput(), {}, { examples: fixtureExamples() });
    const page = ir.pages.find((p) => p.slug === "installation");
    expect(page).toBeDefined();
    expect(JSON.stringify(page!.blocks)).toContain("npm install fixture-lib");
  });

  it("quick start prefers a validated example over invented calls", () => {
    const { ir } = compileDocumentation(fixtureInput(), {}, { examples: fixtureExamples() });
    const page = ir.pages.find((p) => p.slug === "quick-start");
    expect(page).toBeDefined();
    const text = JSON.stringify(page!.blocks);
    expect(text).toContain("const total = add(2, 3);");
    expect(text).not.toContain("createClient");
  });

  it("api pages carry semantic signatures, not bare name lists", () => {
    const { architecture, ir } = compileDocumentation(fixtureInput(), {}, { examples: fixtureExamples() });
    const apiDef = architecture.pages.find((p) => p.kinds.includes("api"));
    expect(apiDef).toBeDefined();
    const apiPage = ir.pages.find((p) => p.slug === apiDef!.slug);
    expect(apiPage).toBeDefined();
    const custom = apiPage!.blocks.filter((b) => b.kind === "custom");
    expect(custom.length).toBeGreaterThan(0);
    expect(JSON.stringify(custom)).toContain("ApiSignature");
  });

  it("related content is evidence-based (no automatic example-for link)", () => {
    const { ir } = compileDocumentation(fixtureInput(), {}, { examples: fixtureExamples() });
    const examplesRefs = ir.pages
      .find((p) => p.slug === "examples")
      ?.references.map((r) => r.targetSlug);
    // No blind link to getting-started without shared symbols.
    expect(examplesRefs ?? []).not.toContain("getting-started");
  });
});

describe("manifest materialization integrity", () => {
  it("manifest lists exactly the materialized IR pages", async () => {
    const { buildManifest } = await import("./manifest.js");
    const { architecture, ir } = compileDocumentation(fixtureInput(), {}, { examples: fixtureExamples() });
    const manifest = buildManifest(architecture, ir, []);
    expect(manifest.pages.map((p) => p.slug).sort()).toEqual(ir.pages.map((p) => p.slug).sort());
    expect(manifest.routes.map((r) => r.slug).sort()).toEqual(ir.pages.map((p) => p.slug).sort());
    for (const rel of manifest.relationships) {
      expect(ir.pages.some((p) => p.slug === rel.from)).toBe(true);
      expect(ir.pages.some((p) => p.slug === rel.to)).toBe(true);
    }
  });

  it("concept pages list members and related APIs instead of shipping empty", () => {
    const { ir } = compileDocumentation(fixtureInput(), {}, { examples: fixtureExamples() });
    const text = ir.pages.map((p) => JSON.stringify(p.blocks)).join("\n");
    // Fixture concept "Addition" relates to API "add" — must surface, not drop.
    expect(text).toContain("`add`");
  });
});

describe("evidence-driven architecture", () => {
  function archInput(): CompilerProjectInput {
    return {
      ...fixtureInput(),
      concepts: [
        { name: "src/math", kind: "module", description: "Exports add" },
        { name: "src/greet", kind: "module", description: "Exports greet" },
        { name: "src/extra", kind: "module", description: "Exports hello" },
      ],
    };
  }

  it("architecture page lists discovered modules, never hardcoded ones", () => {
    const { ir } = compileDocumentation(archInput(), {}, { examples: fixtureExamples() });
    const page = ir.pages.find((p) => p.slug === "architecture");
    expect(page).toBeDefined();
    const text = JSON.stringify(page!.blocks);
    expect(text).toContain("src/math");
    expect(text).toContain("Exports add");
    expect(text).not.toContain("Runtime orchestration");
    expect(text).not.toContain("A[Core]");
  });

  it("concept pages render evidence descriptions", () => {
    const { ir } = compileDocumentation(archInput(), {}, { examples: fixtureExamples() });
    const text = ir.pages.map((p) => JSON.stringify(p.blocks)).join("\n");
    expect(text).toContain("Exports add");
  });
});

describe("introduction and navigation integrity", () => {
  it("introduction composes audience and journey from architecture scope", () => {
    const { ir } = compileDocumentation(fixtureInput(), {}, { examples: fixtureExamples() });
    const page = ir.pages.find((p) => p.slug === "introduction");
    expect(page).toBeDefined();
    const text = JSON.stringify(page!.blocks);
    expect(text).toContain("Who is it for");
    expect(text).toContain("Where to go next");
  });

  it("getting-started never shares the installation page title", () => {
    const { architecture } = compileDocumentation(fixtureInput(), {}, { examples: fixtureExamples() });
    const titles = architecture.pages.map((p) => p.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("concept pages exclude case-insensitive self-references", () => {
    const { ir } = compileDocumentation(fixtureInput(), {}, { examples: fixtureExamples() });
    for (const page of ir.pages) {
      for (const block of page.blocks) {
        if (block.kind !== "list") continue;
        const items = (block as { items?: readonly string[] }).items ?? [];
        for (const item of items) {
          expect(item.toLowerCase()).not.toContain(`\`${page.title.toLowerCase()}\``);
        }
      }
    }
  });
});

describe("composition validator", () => {
  it("flags H1 blocks as DOC_DUPLICATE_TITLE", () => {
    type Block = { kind: string; text?: string; level?: number };
    const h1: Block = { kind: "heading", level: 1, text: "Y" };
    const diags = validateIRPages([{ slug: "y", title: "Y", blocks: [h1] }]);
    expect(diags.some((d) => d.code === "DOC_DUPLICATE_TITLE")).toBe(true);
  });

  it("flags adjacent duplicate breadcrumb labels", () => {
    const diags = validateBreadcrumbs({
      examples: [{ label: "Documentation" }, { label: "Examples" }, { label: "Examples", slug: "examples" }],
    });
    expect(diags.some((d) => d.code === "DOC_DUPLICATE_BREADCRUMB")).toBe(true);
  });
});
