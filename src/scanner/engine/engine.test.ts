import { describe, expect, it } from "vitest";
import { createScannerEngine, scanProject } from "./engine.js";
import { MemoryProvider } from "../providers/memory.js";
import type { ProjectModel } from "../models/project.js";
import type { ScannerPlugin } from "../classifiers/types.js";

const BASIC_FILES: Record<string, string> = {
  "package.json":
    '{"name":"demo","version":"1.0.0","scripts":{"build":"tsup"},"dependencies":{"next":"^14"}}',
  "src/index.ts": "export const x = 1;\n",
  "src/util.ts": "export const y = 2;\n",
  "src/index.test.ts": "import { x } from './index';\n",
  "README.md": "# demo\n",
  "tsconfig.json": '{"compilerOptions":{}}',
  "public/logo.png": "",
  "assets/font.woff2": "",
};

describe("scanProject", () => {
  it("scans a project into a unified index", async () => {
    const provider = new MemoryProvider("/root", { files: BASIC_FILES });
    const index = await scanProject("/root", { provider, collectMetadata: true });

    expect(index.rootPath).toBe("/root");
    expect(index.name).toBe("demo");
    expect(index.projectType).toBe("application");
    expect(index.packageManager).toBe("npm");
    expect(index.source).toBe("full");
    expect(index.providerName).toBe("memory");

    const paths = index.files.map((f) => f.relativePath).sort();
    expect(paths).toEqual([
      "README.md",
      "assets/font.woff2",
      "package.json",
      "public/logo.png",
      "src/index.test.ts",
      "src/index.ts",
      "src/util.ts",
      "tsconfig.json",
    ]);

    const srcFile = index.files.find((f) => f.relativePath === "src/index.ts");
    expect(srcFile).toMatchObject({
      category: "source",
      language: "typescript",
      extension: ".ts",
      dir: "src",
    });
    expect(typeof srcFile?.hash).toBe("string");

    const testFile = index.files.find((f) => f.relativePath === "src/index.test.ts");
    expect(testFile?.category).toBe("test");

    const configs = index.configurations.map((c) => c.tool);
    expect(configs).toContain("typescript");
    expect(configs).toContain("package-manager");

    const assetTypes = index.assets.map((a) => [a.file.relativePath, a.type]);
    expect(assetTypes).toContainEqual(["assets/font.woff2", "font"]);

    expect(index.packages).toHaveLength(1);
    expect(index.packages[0]).toMatchObject({ relativePath: ".", name: "demo" });

    const stats = index.stats;
    expect(stats.totalFiles).toBe(8);
    expect(stats.maxDepth).toBe(1);
    expect(stats.filesByCategory.source).toBe(2);
    expect(stats.filesByExtension[".ts"]).toBe(3);

    expect(index.directories.some((d) => d.relativePath === "src")).toBe(true);
    expect(index.relationships.length).toBeGreaterThan(0);
    expect(index.scanDurationMs).toBeGreaterThanOrEqual(0);
    expect(index.scannedAt).toBeGreaterThan(0);
  });

  it("respects ignore files, including negation re-includes", async () => {
    const provider = new MemoryProvider("/root", {
      files: {
        ...BASIC_FILES,
        ".gitignore": "dist\n!dist/keep.txt\n*.log\n",
        "dist/bundle.js": "ignored",
        "dist/keep.txt": "kept",
        "debug.log": "ignored",
        "src/note.log": "ignored",
      },
    });
    const index = await scanProject("/root", { provider, collectMetadata: true });
    const paths = index.files.map((f) => f.relativePath);
    expect(paths).not.toContain("dist/bundle.js");
    expect(paths).not.toContain("debug.log");
    expect(paths).not.toContain("src/note.log");
    expect(paths).toContain("dist/keep.txt");
    expect(index.ignoredCount).toBeGreaterThan(0);
  });

  it("prunes ignored directories that cannot be re-included", async () => {
    const provider = new MemoryProvider("/root", {
      files: {
        ...BASIC_FILES,
        "node_modules/lodash/index.js": "x",
        "node_modules/lodash/package.json": "{}",
      },
    });
    const index = await scanProject("/root", { provider });
    expect(index.files.some((f) => f.relativePath.startsWith("node_modules/"))).toBe(false);
  });

  it("detects workspaces and packages", async () => {
    const provider = new MemoryProvider("/root", {
      files: {
        "package.json": '{"name":"mono","private":true,"workspaces":["packages/*"]}',
        "packages/a/package.json": '{"name":"@mono/a"}',
        "packages/b/package.json": '{"name":"@mono/b"}',
        "packages/a/src/index.ts": "export const a = 1;",
        "packages/b/src/index.ts": "export const b = 1;",
      },
    });
    const index = await scanProject("/root", { provider });
    expect(index.projectType).toBe("monorepo");
    expect(index.packages.map((p) => p.relativePath).sort()).toEqual([
      ".",
      "packages/a",
      "packages/b",
    ]);
    expect(index.workspaces).toHaveLength(1);
    expect(index.workspaces[0]).toMatchObject({
      kind: "npm",
      packageCount: 3,
      patterns: ["packages/*"],
    });
    expect(index.classification).toContain("monorepo");
    const rel = index.relationships.find(
      (r) => r.from === "packages/a/src/index.ts" && r.type === "package",
    );
    expect(rel?.to).toBe("packages/a");
  });

  it("supports include/exclude/maxDepth filters", async () => {
    const provider = new MemoryProvider("/root", { files: BASIC_FILES });
    const includeOnly = await scanProject("/root", { provider, include: ["src/**"] });
    expect(includeOnly.files.map((f) => f.relativePath).sort()).toEqual([
      "src/index.test.ts",
      "src/index.ts",
      "src/util.ts",
    ]);

    const excludeTests = await scanProject("/root", { provider, exclude: ["**/*.test.ts"] });
    expect(excludeTests.files.some((f) => f.relativePath.endsWith(".test.ts"))).toBe(false);

    const shallow = await scanProject("/root", { provider, maxDepth: 1 });
    expect(shallow.stats.maxDepth).toBe(1);
    expect(
      shallow.files.some((f) => f.relativePath.includes("/") && !f.relativePath.startsWith("src/")),
    ).toBe(false);
  });

  it("collects only requested resource kinds", async () => {
    const provider = new MemoryProvider("/root", { files: BASIC_FILES });
    const index = await scanProject("/root", { provider, resourceKinds: ["directory"] });
    expect(index.files).toHaveLength(0);
    expect(index.configurations).toHaveLength(0);
    expect(index.assets).toHaveLength(0);
    expect(index.directories.length).toBeGreaterThan(0);
    expect(index.stats.totalFiles).toBe(0);
  });

  it("reports invalid manifests as diagnostics", async () => {
    const provider = new MemoryProvider("/root", {
      files: { "package.json": "not json", "src/a.ts": "x" },
    });
    const index = await scanProject("/root", { provider });
    expect(index.diagnostics.some((d) => d.category === "invalid-manifest")).toBe(true);
  });

  it("emits duplicate diagnostics when metadata is collected", async () => {
    const provider = new MemoryProvider("/root", {
      files: { "a.txt": "same", "b.txt": "same", "c.txt": "different" },
    });
    const index = await scanProject("/root", { provider, collectMetadata: true });
    const duplicates = index.diagnostics.filter((d) => d.category === "duplicate");
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]?.related).toEqual(["b.txt"]);
  });
});

describe("ScannerEngine", () => {
  it("exposes provider, rootDir, cache and lastIndex", async () => {
    const provider = new MemoryProvider("/root", { files: { "a.ts": "x" } });
    const engine = createScannerEngine({ provider, rootDir: "/root" });
    expect(engine.provider).toBe(provider);
    expect(engine.rootDir).toBe("/root");
    expect(engine.lastIndex).toBeUndefined();
    await engine.scan();
    expect(engine.lastIndex).toBeDefined();
  });

  it("handles symlink files and directories", async () => {
    const provider = new MemoryProvider("/root", {
      files: { "src/index.ts": "x", "target.txt": "hello" },
      symlinks: [
        { path: "alias.txt", target: "target.txt" },
        { path: "linked-src", target: "src" },
        { path: "broken", target: "missing.txt" },
      ],
    });
    const engine = createScannerEngine({ provider, rootDir: "/root" });
    const index = await engine.scan();
    const paths = index.files.map((f) => f.relativePath);
    expect(paths).toContain("alias.txt");
    expect(paths).toContain("target.txt");
    const alias = index.files.find((f) => f.relativePath === "alias.txt");
    expect(alias?.size).toBe(5);
    expect(index.directories.some((d) => d.relativePath === "linked-src")).toBe(false);
    expect(
      index.diagnostics.some((d) => d.category === "broken-symlink" && d.severity === "error"),
    ).toBe(true);
  });

  it("follows symlinked directories when enabled", async () => {
    const provider = new MemoryProvider("/root", {
      files: { "src/index.ts": "x", "pkg/shared.ts": "y" },
      symlinks: [{ path: "linked", target: "pkg" }],
    });
    const engine = createScannerEngine({ provider, rootDir: "/root" });
    const index = await engine.scan({ options: { followSymlinks: true } });
    const linkedDir = index.directories.find((d) => d.relativePath === "linked");
    expect(linkedDir?.metadata).toMatchObject({ symlink: true });
    expect(index.files.some((f) => f.relativePath === "linked/shared.ts")).toBe(true);
  });

  it("runs plugin hooks and classifiers", async () => {
    let started = 0;
    const plugin: ScannerPlugin = {
      name: "test-plugin",
      ignoreRules: [{ pattern: "secret/**", source: "plugin", dir: ".", negated: false, index: 0 }],
      fileClassifier: (input) =>
        input.extension === ".foo"
          ? { category: "source", language: "foo", generated: false }
          : null,
      projectClassifier: (input) => (input.name === "demo" ? ["framework", "library"] : null),
      metadataCollector: (input) => ({ picked: true, basename: input.name }),
      onScanStart: () => {
        started += 1;
      },
      onScanComplete: async (index) => ({ ...index, name: `${index.name}-patched` }),
    };
    const provider = new MemoryProvider("/root", {
      files: {
        ...BASIC_FILES,
        "src/thing.foo": "abc",
        "secret/key.env": "do-not-scan",
      },
    });
    const engine = createScannerEngine({ provider, rootDir: "/root", plugins: [plugin] });
    const index = await engine.scan({ options: { collectMetadata: true } });
    expect(started).toBe(1);
    expect(index.name).toBe("demo-patched");
    expect(index.files.some((f) => f.relativePath === "src/thing.foo")).toBe(true);
    expect(index.files.some((f) => f.relativePath === "secret/key.env")).toBe(false);
    const picked = index.files.find((f) => f.relativePath === "src/index.ts");
    expect(picked?.metadata).toMatchObject({ picked: true, basename: "index.ts" });
    expect(index.classification).toEqual(["framework", "library"]);
  });

  it("uses a previous index for incremental scans", async () => {
    const files: Record<string, string> = {
      "a.ts": "aaa",
      "b.ts": "bbb",
      "src/c.ts": "ccc",
    };
    const first = new MemoryProvider("/root", { files, mtimeMs: 1000 });
    const engine = createScannerEngine({ provider: first, rootDir: "/root", cache: true });
    const previous = await engine.scan({ options: { collectMetadata: true } });
    expect(engine.cache.size).toBeGreaterThan(0);

    const second = new MemoryProvider("/root", { files, mtimeMs: 1000 });
    const secondEngine = createScannerEngine({ provider: second, rootDir: "/root" });
    const current = await secondEngine.scan({ previous, options: { collectMetadata: true } });
    expect(current.source).toBe("incremental");

    const changed = new MemoryProvider("/root", {
      files: { ...files, "b.ts": "BBBBBB" },
      mtimeMs: 1000,
    });
    const changedEngine = createScannerEngine({ provider: changed, rootDir: "/root" });
    const changedIndex = await changedEngine.scan({ previous, options: { collectMetadata: true } });
    expect(changedIndex.source).toBe("incremental");
    const b = changedIndex.files.find((f) => f.relativePath === "b.ts");
    const previousB = previous.files.find((f) => f.relativePath === "b.ts");
    expect(b?.hash).toBeTruthy();
    expect(b?.hash).not.toBe(previousB?.hash);
  });

  it("persists and reloads the scanner cache", async () => {
    const provider = new MemoryProvider("/root", { files: { "a.ts": "content" } });
    const engine = createScannerEngine({ provider, rootDir: "/root", cache: true });
    await engine.scan({ options: { collectMetadata: true } });
    await engine.saveCache();
    expect(engine.cache.size).toBe(1);

    const reloaded = createScannerEngine({ provider, rootDir: "/root", cache: true });
    expect(reloaded.cache.size).toBe(0);
    await reloaded.loadCache();
    expect(reloaded.cache.size).toBe(1);
    const entry = reloaded.cache.get("/root/a.ts");
    expect(entry?.hash).toBeTruthy();
  });

  it("disables default ignore sources on request", async () => {
    const provider = new MemoryProvider("/root", {
      files: { "dist/bundle.js": "x", "src/a.ts": "y" },
    });
    const engine = createScannerEngine({ provider, rootDir: "/root" });
    const index = await engine.scan({ options: { disabledIgnoreSources: ["default"] } });
    expect(index.files.some((f) => f.relativePath === "dist/bundle.js")).toBe(true);
  });

  it("watch() builds a watcher from the last index", async () => {
    const provider = new MemoryProvider("/root", { files: { "a.ts": "x" } });
    const engine = createScannerEngine({ provider, rootDir: "/root" });
    await engine.scan();
    const watcher = engine.watch();
    expect(watcher.isClosed).toBe(false);
    watcher.close();
    expect(watcher.isClosed).toBe(true);
  });
});

describe("project model shape", () => {
  it("freezes models", async () => {
    const provider = new MemoryProvider("/root", { files: { "a.ts": "x" } });
    const index: ProjectModel = await scanProject("/root", { provider });
    expect(Object.isFrozen(index)).toBe(true);
    expect(Object.isFrozen(index.files[0])).toBe(true);
  });
});
