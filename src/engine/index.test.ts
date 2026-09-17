import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { createDocsEngine } from "./index.js";
import { createLoggerSync } from "../logger/index.js";
import { createBuildContext } from "../pipeline/context.js";
import { defineDocs } from "../config/define.js";

const require = createRequire(import.meta.url);
const VITEST_BIN = join(require.resolve("vitest/package.json"), "..", "vitest.mjs");

const TEMP_DIR = join(tmpdir(), "docs-engine-test");

function createTestProject(): string {
  const dir = join(TEMP_DIR, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });

  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify(
      {
        name: "engine-test",
        version: "1.0.0",
        description: "Engine test project",
        scripts: { test: "vitest" },
        devDependencies: { typescript: "^5.0.0" },
      },
      null,
      2,
    ),
  );

  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "src", "index.ts"), 'export function hello() { return "world"; }');

  return dir;
}

describe("createDocsEngine", () => {
  let dir: string;

  beforeEach(() => {
    dir = createTestProject();
  });

  afterEach(() => {
    rmSync(TEMP_DIR, { recursive: true, force: true });
  });

  it("exposes a service container with all engine services registered", () => {
    const engine = createDocsEngine({ rootDir: dir, logger: createLoggerSync() });

    const names = engine.services.names();
    for (const expected of [
      "logger",
      "project",
      "config",
      "cache",
      "plugin",
      "theme",
      "discovery",
      "output",
    ]) {
      expect(names).toContain(expected);
    }
  });

  it("uses the provided logger when given", () => {
    const logger = createLoggerSync();
    const engine = createDocsEngine({ rootDir: dir, logger });

    expect(engine.services.resolve("logger").logger).toBe(logger);
  });

  it("initialize() loads config and project detection", async () => {
    const engine = createDocsEngine({ rootDir: dir, logger: createLoggerSync() });

    const result = await engine.initialize();
    expect(result.config.title).toBe("Documentation");
    expect(result.detection.packageManager).toBeDefined();
    expect(result.cacheEnabled).toBe(result.config.cache);

    await engine.dispose();
  });

  it("initialize() is idempotent until dispose()", async () => {
    const engine = createDocsEngine({ rootDir: dir, logger: createLoggerSync() });

    const first = await engine.initialize();
    const second = await engine.initialize();
    expect(second.config).toBe(first.config);
    expect(second.detection).toBe(first.detection);

    await engine.dispose();
    const third = await engine.initialize();
    expect(third.config).not.toBe(first.config);
    expect(third.detection).not.toBe(first.detection);

    await engine.dispose();
  });

  it("build() generates documentation output using engine rootDir", async () => {
    const srcDir = join(dir, "src");
    const outDir = join(dir, "out");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "index.md"), "# Welcome\n\nHello.\n");
    writeFileSync(
      join(dir, "docs.config.mjs"),
      `export default { source: ${JSON.stringify(srcDir)}, output: ${JSON.stringify(outDir)} };`,
    );

    const engine = createDocsEngine({ rootDir: dir, logger: createLoggerSync() });
    await engine.build();

    expect(existsSync(join(outDir, "index.html"))).toBe(true);

    await engine.dispose();
  }, 90_000);

  it("build() honours an explicit rootDir override", async () => {
    const srcDir = join(dir, "src");
    const outDir = join(dir, "out");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "index.md"), "# Welcome\n\nHello.\n");
    writeFileSync(
      join(dir, "docs.config.mjs"),
      `export default { source: ${JSON.stringify(srcDir)}, output: ${JSON.stringify(outDir)} };`,
    );

    const engine = createDocsEngine({ logger: createLoggerSync() });
    await engine.build({ rootDir: dir, logger: createLoggerSync() });

    expect(existsSync(join(outDir, "index.html"))).toBe(true);

    await engine.dispose();
  }, 90_000);

  it("runAnalyzer() returns project analysis", async () => {
    const engine = createDocsEngine({ rootDir: dir, logger: createLoggerSync() });

    const analysis = engine.runAnalyzer(dir);
    expect(analysis.projectType).toBeDefined();
    expect(analysis.sourceFiles.length).toBeGreaterThanOrEqual(1);
    expect(analysis.publicExports.length).toBeGreaterThanOrEqual(1);
  });

  it("runScanner() produces a unified project index", async () => {
    const engine = createDocsEngine({ rootDir: dir, logger: createLoggerSync() });

    const index = await engine.runScanner(dir);
    expect(index.rootPath).toBe(dir);
    expect(index.packages.length).toBeGreaterThanOrEqual(1);
    expect(index.files.some((f) => f.relativePath === "src/index.ts")).toBe(true);
    expect(index.providerName).toBe("local");

    await engine.dispose();
  });

  it("exposes the language subsystem and detects languages from a scan", async () => {
    const engine = createDocsEngine({ rootDir: dir, logger: createLoggerSync() });

    expect(engine.languages.size()).toBe(2);
    expect(engine.languages.has("typescript")).toBe(true);
    expect(engine.languages.has("javascript")).toBe(true);
    expect(engine.languages.resolve("ts")?.displayName).toBe("TypeScript");

    const index = await engine.runScanner(dir);
    const detected = engine.languages.detectLanguage({
      files: index.files.map((file) => file.relativePath),
      dependencies: { typescript: "^5.0.0" },
    });
    expect(detected?.languageId).toBe("typescript");

    await engine.dispose();
    expect(engine.languages.size()).toBe(2);
  });

  it("runGenerator() generates documentation pages", async () => {
    const engine = createDocsEngine({ rootDir: dir, logger: createLoggerSync() });

    const result = await engine.runGenerator({
      rootDir: dir,
      logger: createLoggerSync(),
    });

    expect(result.pages.length).toBeGreaterThan(0);
    expect(result.stats.totalPages).toBe(result.pages.length);
  });

  it("runPipeline() runs the pipeline against a provided context", async () => {
    const srcDir = join(dir, "docs");
    const outDir = join(dir, "docs-site");
    const config = defineDocs({
      source: srcDir,
      output: outDir,
      sitemap: false,
      rss: false,
      og: false,
      search: { enabled: false },
    });
    const detection = {
      projectType: "library" as const,
      packageManager: "npm" as const,
      workspaceInfo: undefined,
      packages: [],
    };
    const ctx = createBuildContext(config, dir, detection);

    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "index.md"), "# Welcome\n\nHello.\n");
    (ctx as { sourceFiles: typeof ctx.sourceFiles }).sourceFiles = [
      {
        path: join(srcDir, "index.md"),
        relativePath: "docs/index.md",
        content: "# Welcome\n\nHello.",
      },
    ];

    const engine = createDocsEngine({ rootDir: dir, logger: createLoggerSync() });
    await engine.runPipeline(ctx);

    expect(ctx.pages.length).toBeGreaterThan(0);
    expect(existsSync(join(outDir, "index.html"))).toBe(true);

    await engine.dispose();
  });

  it("exposes the compiler subsystem with the built-in compilers", async () => {
    const engine = createDocsEngine({ rootDir: dir, logger: createLoggerSync() });

    expect(engine.compiler.size()).toBe(2);
    expect(engine.compiler.has("typescript")).toBe(true);
    expect(engine.compiler.has("javascript")).toBe(true);

    const result = await engine.compiler.compile({
      rootDir: dir,
      files: ["src/index.ts"],
      contents: { "src/index.ts": "export const answer: number = 42;" },
    });
    expect(result.ok).toBe(true);
    expect(result.units[0]!.compilerId).toBe("typescript");
    expect(result.units[0]!.status).toBe("ok");
    expect(result.units[0]!.syntaxTree?.nodeCount).toBeGreaterThan(0);

    await engine.dispose();
  });

  it("dispose() releases the compiler subsystem", async () => {
    const engine = createDocsEngine({ rootDir: dir, logger: createLoggerSync() });
    const compiler = engine.compiler;
    await engine.compiler.compile({
      rootDir: dir,
      files: ["src/index.ts"],
      contents: { "src/index.ts": "export const x: number = 1;" },
    });

    await engine.dispose();
    expect(compiler.isReady).toBe(false);
  });

  it("dispose() releases services and allows re-initialization", async () => {
    const engine = createDocsEngine({ rootDir: dir, logger: createLoggerSync() });

    await engine.initialize();
    expect(engine.services.isInitialized("logger")).toBe(true);

    await engine.dispose();
    expect(engine.services.isInitialized("logger")).toBe(false);

    await engine.initialize();
    expect(engine.services.isInitialized("logger")).toBe(true);

    await engine.dispose();
  });

  it("falls back to process.cwd() when no rootDir is provided", () => {
    const { execPath } = process;
    const result = execFileSync(execPath, [VITEST_BIN, "run", "--config", "vitest.cwd.config.ts"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const clean = result.replace(/\p{C}/gu, "");
    expect(clean).toContain("1 passed");
  }, 60_000);
});
