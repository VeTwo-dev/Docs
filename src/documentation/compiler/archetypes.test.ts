import { describe, it, expect } from "vitest";
import { compileArchitecture, compileDocumentation } from "./orchestrator.js";
import type { CompilerProjectInput } from "./types.js";

function base(overrides: Partial<CompilerProjectInput> = {}): CompilerProjectInput {
  return {
    rootDir: "/tmp/fixture",
    name: "fixture",
    description: "Fixture project.",
    signals: {},
    ...overrides,
  };
}

const api = (name: string) => ({
  name,
  kind: "function",
  signature: "void",
  description: `${name} does things.`,
  sourceFile: "src/index.ts",
  boundary: "public" as const,
});

describe("project-type information architecture", () => {
  it("library with API gets introduction, install, quick-start and api reference", () => {
    const arch = compileArchitecture(
      base({
        signals: { exportsCount: 12 },
        apis: Array.from({ length: 12 }, (_, i) => api(`fn${i}`)),
        concepts: [{ name: "Widget", kind: "concept" }],
      }),
    );
    const slugs = arch.pages.map((p) => p.slug);
    expect(slugs).toContain("introduction");
    expect(slugs).toContain("installation");
    expect(slugs).toContain("quick-start");
    expect(slugs.some((s) => s === "api" || s.startsWith("api/"))).toBe(true);
    expect(arch.sections.some((s) => s.id === "api-reference")).toBe(true);
  });

  it("cli project gets per-command pages and no api reference without apis", () => {
    const arch = compileArchitecture(
      base({
        signals: {
          hasBin: true,
          hasCli: true,
          commands: [
            { name: "docs build", description: "Build" },
            { name: "docs dev", description: "Dev" },
          ],
        },
      }),
    );
    expect(arch.project.archetypes).toContain("cli");
    const slugs = arch.pages.map((p) => p.slug);
    expect(slugs).toContain("commands/docs-build");
    expect(slugs).toContain("commands/docs-dev");
    expect(slugs.some((s) => s === "api" || s.startsWith("api/"))).toBe(false);
  });

  it("monorepo with discovered packages gets a packages page", () => {
    const arch = compileArchitecture(
      base({
        signals: {
          isMonorepo: true,
          packages: ["@scope/a", "@scope/b"],
          scripts: ["build", "test", "release"],
        },
        apis: [api("a"), api("b")],
      }),
    );
    expect(arch.project.archetypes).toContain("monorepo");
    expect(arch.sections.some((s) => s.id === "packages")).toBe(true);
    expect(arch.pages.some((p) => p.slug === "packages")).toBe(true);
    expect(arch.pages.some((p) => p.slug === "publishing")).toBe(true);
    // Workspace API surface aggregates instead of vanishing.
    expect(arch.sections.some((s) => s.id === "api-reference")).toBe(true);
    expect(arch.pages.some((p) => p.slug === "api" || p.slug.startsWith("api/"))).toBe(true);
    // Architecture section is always a candidate for monorepos; its pages are
    // evidence-gated downstream (empty ones drop with diagnostics).
    expect(arch.sections.some((s) => s.id === "architecture")).toBe(true);
  });

  it("backend service gets operations page from env evidence", () => {
    const arch = compileArchitecture(
      base({
        signals: {
          hasServer: true,
          dependencies: ["express"],
          configKeys: ["env:DATABASE_URL", "port"],
        },
        concepts: [{ name: "User", kind: "model" }],
      }),
    );
    expect(arch.project.archetypes.some((a) => a === "backend" || a === "service")).toBe(true);
    expect(arch.sections.some((s) => s.id === "operations")).toBe(true);
    expect(arch.pages.some((p) => p.slug === "operations")).toBe(true);
    expect(arch.sections.some((s) => s.id === "data-model")).toBe(true);
  });

  it("framework with plugins gets a plugins page", () => {
    const arch = compileArchitecture(
      base({
        signals: { peerDependencies: ["react"], exportsCount: 5, plugins: ["my-plugin"] },
        apis: Array.from({ length: 5 }, (_, i) => api(`f${i}`)),
      }),
    );
    expect(arch.project.archetypes).toContain("framework");
    expect(arch.sections.some((s) => s.id === "plugins")).toBe(true);
    expect(arch.pages.some((p) => p.slug === "plugins")).toBe(true);
  });

  it("development pages render real scripts, never invented commands", () => {
    const { ir } = compileDocumentation(base({ signals: { scripts: ["build", "test", "lint"] } }));
    const dev = ir.pages.find((p) => p.slug === "development");
    expect(dev).toBeDefined();
    const text = JSON.stringify(dev!.blocks);
    expect(text).toContain("npm run build");
    expect(text).toContain("npm run test");
    expect(text).not.toContain("pnpm dev");
  });

  it("minimal project yields no empty sections", () => {
    const arch = compileArchitecture(base({}));
    for (const section of arch.sections) {
      expect(section.pages.length).toBeGreaterThan(0);
    }
  });

  it("planning is deterministic for identical input", () => {
    const input = base({
      signals: { exportsCount: 8, commands: [{ name: "x", description: "y" }] },
      apis: Array.from({ length: 8 }, (_, i) => api(`g${i}`)),
    });
    const a = compileArchitecture(input);
    const b = compileArchitecture(structuredClone(input));
    expect(JSON.stringify(a.sections)).toBe(JSON.stringify(b.sections));
    expect(JSON.stringify(a.pages)).toBe(JSON.stringify(b.pages));
  });

  it("user overrides can disable sections", () => {
    const arch = compileArchitecture(
      base({
        signals: { exportsCount: 10 },
        apis: Array.from({ length: 10 }, (_, i) => api(`h${i}`)),
      }),
      { sections: { troubleshooting: { enabled: false } } },
    );
    expect(arch.sections.some((s) => s.id === "troubleshooting")).toBe(false);
  });
});
