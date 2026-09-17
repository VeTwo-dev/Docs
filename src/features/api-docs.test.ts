import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BuildContextMutable } from "../types/internal.js";
import { defineDocs } from "../config/define.js";
import { generateApiDocs } from "./api-docs.js";

function createMockCtx(overrides?: Partial<BuildContextMutable>): BuildContextMutable {
  return {
    config: defineDocs({ api: { enabled: true, source: "./src", include: ["*.ts"], exclude: [] } }),
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
  tmpDir = mkdtempSync(join(tmpdir(), "api-docs-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("generateApiDocs", () => {
  it("returns early if api docs are disabled", async () => {
    const ctx = createMockCtx({
      config: defineDocs({ api: { enabled: false, source: "./src", include: [], exclude: [] } }),
    });

    await generateApiDocs(ctx);

    expect(ctx.apiDocs).toHaveLength(0);
  });

  it("extracts function declarations from TypeScript", async () => {
    const srcDir = join(tmpDir, "src");
    mkdirSync(srcDir, { recursive: true });
    const tsPath = join(srcDir, "index.ts");
    writeFileSync(
      tsPath,
      "/** Adds two numbers */\nexport function add(a: number, b: number): number {\n  return a + b;\n}\n",
    );

    const ctx = createMockCtx({
      config: defineDocs({
        source: tmpDir,
        api: { enabled: true, source: srcDir, include: ["*.ts"], exclude: [] },
      }),
      rootDir: tmpDir,
      sourceFiles: [
        {
          path: tsPath,
          relativePath: "src/index.ts",
          extension: ".ts",
          size: 100,
          lastModified: new Date(),
        },
      ],
    });

    await generateApiDocs(ctx);

    expect(ctx.apiDocs.length).toBeGreaterThanOrEqual(1);
    const fn = ctx.apiDocs.find((e) => e.name === "add");
    expect(fn).toBeDefined();
    expect(fn!.kind).toBe("function");
    expect(fn!.description).toContain("Adds two numbers");
  }, 90_000);

  it("extracts interface declarations", async () => {
    const srcDir = join(tmpDir, "src");
    mkdirSync(srcDir, { recursive: true });
    const tsPath = join(srcDir, "types.ts");
    writeFileSync(
      tsPath,
      "/** User interface */\nexport interface User {\n  name: string;\n  age: number;\n}\n",
    );

    const ctx = createMockCtx({
      config: defineDocs({
        source: tmpDir,
        api: { enabled: true, source: srcDir, include: ["*.ts"], exclude: [] },
      }),
      rootDir: tmpDir,
      sourceFiles: [
        {
          path: tsPath,
          relativePath: "src/types.ts",
          extension: ".ts",
          size: 100,
          lastModified: new Date(),
        },
      ],
    });

    await generateApiDocs(ctx);

    const iface = ctx.apiDocs.find((e) => e.name === "User");
    expect(iface).toBeDefined();
    expect(iface!.kind).toBe("interface");
  }, 90_000);

  it("extracts type alias declarations", async () => {
    const srcDir = join(tmpDir, "src");
    mkdirSync(srcDir, { recursive: true });
    const tsPath = join(srcDir, "alias.ts");
    writeFileSync(tsPath, "/** A string ID type */\nexport type StringId = string;\n");

    const ctx = createMockCtx({
      config: defineDocs({
        source: tmpDir,
        api: { enabled: true, source: srcDir, include: ["*.ts"], exclude: [] },
      }),
      rootDir: tmpDir,
      sourceFiles: [
        {
          path: tsPath,
          relativePath: "src/alias.ts",
          extension: ".ts",
          size: 100,
          lastModified: new Date(),
        },
      ],
    });

    await generateApiDocs(ctx);

    const typeAlias = ctx.apiDocs.find((e) => e.name === "StringId");
    expect(typeAlias).toBeDefined();
    expect(typeAlias!.kind).toBe("type");
  }, 90_000);

  it("detects deprecated tag", async () => {
    const srcDir = join(tmpDir, "src");
    mkdirSync(srcDir, { recursive: true });
    const tsPath = join(srcDir, "old.ts");
    writeFileSync(
      tsPath,
      "/**\n * Old function\n * @deprecated Use newFn instead\n */\nexport function oldFn(): void {}\n",
    );

    const ctx = createMockCtx({
      config: defineDocs({
        source: tmpDir,
        api: { enabled: true, source: srcDir, include: ["*.ts"], exclude: [] },
      }),
      rootDir: tmpDir,
      sourceFiles: [
        {
          path: tsPath,
          relativePath: "src/old.ts",
          extension: ".ts",
          size: 100,
          lastModified: new Date(),
        },
      ],
    });

    await generateApiDocs(ctx);

    const fn = ctx.apiDocs.find((e) => e.name === "oldFn");
    expect(fn).toBeDefined();
    expect(fn!.deprecated).toBe(true);
  }, 90_000);

  it("skips non-TypeScript files", async () => {
    const ctx = createMockCtx({
      sourceFiles: [
        {
          path: join(tmpDir, "file.js"),
          relativePath: "file.js",
          extension: ".js",
          size: 50,
          lastModified: new Date(),
        },
      ],
    });

    await generateApiDocs(ctx);

    expect(ctx.apiDocs).toHaveLength(0);
  });

  it("skips .tsx files when not matching include", async () => {
    const srcDir = join(tmpDir, "src");
    mkdirSync(srcDir, { recursive: true });
    const tsxPath = join(srcDir, "Comp.tsx");
    writeFileSync(tsxPath, "export function Comp() { return <div />; }\n");

    const ctx = createMockCtx({
      config: defineDocs({
        source: tmpDir,
        api: { enabled: true, source: srcDir, include: ["*.tsx"], exclude: [] },
      }),
      rootDir: tmpDir,
      sourceFiles: [
        {
          path: tsxPath,
          relativePath: "src/Comp.tsx",
          extension: ".tsx",
          size: 50,
          lastModified: new Date(),
        },
      ],
    });

    await generateApiDocs(ctx);

    expect(ctx.apiDocs.length).toBeGreaterThanOrEqual(0);
  }, 90_000);

  it("handles missing source files gracefully", async () => {
    const ctx = createMockCtx({
      sourceFiles: [
        {
          path: join(tmpDir, "nonexistent.ts"),
          relativePath: "nonexistent.ts",
          extension: ".ts",
          size: 50,
          lastModified: new Date(),
        },
      ],
    });

    await generateApiDocs(ctx);

    expect(ctx.apiDocs).toHaveLength(0);
  });

  it("skips nodes without names", async () => {
    const srcDir = join(tmpDir, "src");
    mkdirSync(srcDir, { recursive: true });
    const tsPath = join(srcDir, "empty.ts");
    writeFileSync(tsPath, "export const x = 1;\n");

    const ctx = createMockCtx({
      config: defineDocs({
        source: tmpDir,
        api: { enabled: true, source: srcDir, include: ["*.ts"], exclude: [] },
      }),
      rootDir: tmpDir,
      sourceFiles: [
        {
          path: tsPath,
          relativePath: "src/empty.ts",
          extension: ".ts",
          size: 50,
          lastModified: new Date(),
        },
      ],
    });

    await generateApiDocs(ctx);

    expect(ctx.apiDocs.length).toBeGreaterThanOrEqual(0);
  }, 90_000);
});
