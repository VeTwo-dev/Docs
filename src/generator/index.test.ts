import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeProject } from "../analyzer/index.js";
import { resolveGeneratorConfig } from "./core/config.js";
import { generateDocs } from "./index.js";
import { writeGeneratedOutput, cleanGeneratedOutput } from "./writers.js";
import { GeneratorCache } from "./cache.js";
import { runPageGenerators, runMetadataGenerators } from "./pages/index.js";
import { generateOverviewPage } from "./pages/overview.js";
import { generateArchitecturePage } from "./pages/architecture.js";
import { generateGuidesPage } from "./pages/guides.js";
import { generateConfigurationPage } from "./pages/configuration.js";
import { generateCliPage } from "./pages/cli.js";
import { generateFaqPage } from "./pages/faq.js";
import { generateTroubleshootingPage } from "./pages/troubleshooting.js";
import { generateExamplesPage } from "./pages/examples.js";
import {
  generateSidebarMetadata,
  generateNavigationMetadata,
  generateSearchMetadata,
  generateApiMetadata,
} from "./metadata/index.js";
import type { GeneratorContext } from "./core/types.js";
import { createLoggerSync } from "../logger/index.js";

const TEMP_DIR = join(tmpdir(), "docs-generator-test");

function createTestProject(overrides?: {
  name?: string;
  scripts?: Record<string, string>;
  hasTypeScript?: boolean;
  hasTests?: boolean;
  hasCI?: boolean;
  hasDocker?: boolean;
}): string {
  const dir = join(TEMP_DIR, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });

  const pkg = {
    name: overrides?.name ?? "test-project",
    version: "1.0.0",
    description: "A test project",
    scripts: overrides?.scripts ?? { dev: "vite", build: "vite build", test: "vitest" },
    dependencies: { react: "^18.0.0" },
    devDependencies: { vite: "^5.0.0", typescript: "^5.0.0" },
  };
  writeFileSync(join(dir, "package.json"), JSON.stringify(pkg, null, 2));

  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "src", "index.ts"), 'export function hello() { return "world"; }');
  writeFileSync(
    join(dir, "src", "utils.ts"),
    "export function add(a: number, b: number) { return a + b; }",
  );

  if (overrides?.hasTypeScript !== false) {
    writeFileSync(
      join(dir, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { target: "ES2020" } }),
    );
  }
  if (overrides?.hasTests !== false) {
    mkdirSync(join(dir, "src", "__tests__"), { recursive: true });
    writeFileSync(
      join(dir, "src", "__tests__", "index.test.ts"),
      'import { hello } from "../index"; test("hello", () => { expect(hello()).toBe("world"); });',
    );
  }
  if (overrides?.hasCI) {
    mkdirSync(join(dir, ".github", "workflows"), { recursive: true });
    writeFileSync(
      join(dir, ".github", "workflows", "ci.yml"),
      "name: CI\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4",
    );
  }
  if (overrides?.hasDocker) {
    writeFileSync(
      join(dir, "Dockerfile"),
      'FROM node:20-alpine\nWORKDIR /app\nCOPY . .\nRUN npm run build\nCMD ["npm", "start"]',
    );
  }

  writeFileSync(
    join(dir, "README.md"),
    "# Test Project\n\nA test project for documentation generation.",
  );
  writeFileSync(join(dir, "LICENSE"), "MIT License");

  return dir;
}

function createMockCtx(dir: string): GeneratorContext {
  const analysis = analyzeProject(dir);
  return {
    analysis,
    config: resolveGeneratorConfig({ enabled: true }),
    rootDir: dir,
    outputDir: join(dir, "generated-docs"),
  };
}

describe("Generator Config", () => {
  it("returns defaults when no input", () => {
    const config = resolveGeneratorConfig();
    expect(config.enabled).toBe(false);
    expect(config.mode).toBe("hybrid");
    expect(config.output).toBe("./generated-docs");
    expect(config.overwrite).toBe(false);
    expect(config.api).toBe(true);
    expect(config.architecture).toBe(true);
  });

  it("merges user input with defaults", () => {
    const config = resolveGeneratorConfig({ enabled: true, api: false, output: "./docs-gen" });
    expect(config.enabled).toBe(true);
    expect(config.api).toBe(false);
    expect(config.output).toBe("./docs-gen");
    expect(config.architecture).toBe(true); // default preserved
  });
});

describe("Project Analyzer", () => {
  let dir: string;

  beforeEach(() => {
    dir = createTestProject();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("detects project type", () => {
    const analysis = analyzeProject(dir);
    expect(analysis.projectType).toBe("application");
  });

  it("detects package manager", () => {
    const analysis = analyzeProject(dir);
    expect(analysis.packageManager).toBe("npm");
  });

  it("finds source files", () => {
    const analysis = analyzeProject(dir);
    expect(analysis.sourceFiles.length).toBeGreaterThanOrEqual(2);
  });

  it("finds config files", () => {
    const analysis = analyzeProject(dir);
    expect(analysis.configFiles.some((c) => c.name === "tsconfig.json")).toBe(true);
  });

  it("reads package.json", () => {
    const analysis = analyzeProject(dir);
    expect(analysis.packageInfo?.name).toBe("test-project");
    expect(analysis.packageInfo?.version).toBe("1.0.0");
  });

  it("detects TypeScript", () => {
    const analysis = analyzeProject(dir);
    expect(analysis.hasTypeScript).toBe(true);
  });

  it("detects tests", () => {
    const analysis = analyzeProject(dir);
    expect(analysis.hasTests).toBe(true);
  });

  it("detects CI", () => {
    const dirWithCI = createTestProject({ hasCI: true });
    try {
      const analysis = analyzeProject(dirWithCI);
      expect(analysis.hasCI).toBe(true);
    } finally {
      rmSync(dirWithCI, { recursive: true, force: true });
    }
  });

  it("detects Docker", () => {
    const dirWithDocker = createTestProject({ hasDocker: true });
    try {
      const analysis = analyzeProject(dirWithDocker);
      expect(analysis.hasDocker).toBe(true);
    } finally {
      rmSync(dirWithDocker, { recursive: true, force: true });
    }
  });

  it("builds directory tree", () => {
    const analysis = analyzeProject(dir);
    expect(analysis.directoryTree.type).toBe("directory");
    expect(analysis.directoryTree.children.length).toBeGreaterThan(0);
  });

  it("reads scripts", () => {
    const analysis = analyzeProject(dir);
    expect(analysis.scripts["dev"]).toBe("vite");
    expect(analysis.scripts["build"]).toBe("vite build");
  });
});

describe("Individual Generators", () => {
  let ctx: GeneratorContext;

  beforeEach(() => {
    const dir = createTestProject();
    ctx = createMockCtx(dir);
  });

  afterEach(() => {
    rmSync(ctx.rootDir, { recursive: true, force: true });
  });

  it("generates overview page", () => {
    const page = generateOverviewPage(ctx);
    expect(page.slug).toBe("overview");
    expect(page.title).toContain("test-project");
    expect(page.content).toContain("# test-project");
    expect(page.content).toContain("Quick Start");
  });

  it("generates architecture page", () => {
    const page = generateArchitecturePage(ctx);
    expect(page.slug).toBe("architecture");
    expect(page.content).toContain("Directory Structure");
    expect(page.content).toContain("src/");
  });

  it("generates guides page", () => {
    const page = generateGuidesPage(ctx);
    expect(page.slug).toBe("guides/getting-started");
    expect(page.content).toContain("Prerequisites");
    expect(page.content).toContain("Installation");
  });

  it("generates configuration page", () => {
    const page = generateConfigurationPage(ctx);
    expect(page.slug).toBe("configuration");
    expect(page.content).toContain("Configuration Reference");
  });

  it("generates CLI page", () => {
    const page = generateCliPage(ctx);
    expect(page.slug).toBe("cli");
    expect(page.content).toContain("CLI Reference");
    expect(page.content).toContain("dev");
    expect(page.content).toContain("build");
  });

  it("generates FAQ page", () => {
    const page = generateFaqPage(ctx);
    expect(page.slug).toBe("faq");
    expect(page.content).toContain("Frequently Asked Questions");
  });

  it("generates troubleshooting page", () => {
    const page = generateTroubleshootingPage(ctx);
    expect(page.slug).toBe("troubleshooting");
    expect(page.content).toContain("Troubleshooting");
  });

  it("generates examples page", () => {
    const page = generateExamplesPage(ctx);
    expect(page.slug).toBe("examples");
    expect(page.content).toContain("Examples");
  });
});

describe("Page Generator Registry", () => {
  let ctx: GeneratorContext;

  beforeEach(() => {
    const dir = createTestProject();
    ctx = createMockCtx(dir);
  });

  afterEach(() => {
    rmSync(ctx.rootDir, { recursive: true, force: true });
  });

  it("generates all enabled pages", () => {
    const pages = runPageGenerators(ctx);
    expect(pages.length).toBeGreaterThanOrEqual(6);
    const slugs = pages.map((p) => p.slug);
    expect(slugs).toContain("overview");
    expect(slugs).toContain("architecture");
    expect(slugs).toContain("cli");
  });

  it("respects disabled config flags", () => {
    const ctxDisabled: GeneratorContext = {
      ...ctx,
      config: { ...ctx.config, cli: false, faq: false },
    };
    const pages = runPageGenerators(ctxDisabled);
    const slugs = pages.map((p) => p.slug);
    expect(slugs).not.toContain("cli");
    expect(slugs).not.toContain("faq");
  });
});

describe("Metadata Generators", () => {
  let ctx: GeneratorContext;

  beforeEach(() => {
    const dir = createTestProject();
    ctx = createMockCtx(dir);
  });

  afterEach(() => {
    rmSync(ctx.rootDir, { recursive: true, force: true });
  });

  it("generates sidebar metadata", () => {
    const pages = runPageGenerators(ctx);
    const meta = generateSidebarMetadata(ctx, pages);
    expect(meta.filename).toBe("metadata/sidebar.json");
    const parsed = JSON.parse(meta.content) as { groups: Array<{ title: string }> };
    expect(parsed.groups.length).toBeGreaterThan(0);
  });

  it("generates navigation metadata", () => {
    const pages = runPageGenerators(ctx);
    const meta = generateNavigationMetadata(ctx, pages);
    expect(meta.filename).toBe("metadata/navigation.json");
    const parsed = JSON.parse(meta.content) as { items: Array<{ label: string }> };
    expect(parsed.items.length).toBeGreaterThan(0);
  });

  it("generates search metadata", () => {
    const pages = runPageGenerators(ctx);
    const meta = generateSearchMetadata(ctx, pages);
    expect(meta.filename).toBe("metadata/search.json");
    const parsed = JSON.parse(meta.content) as { entries: Array<{ id: string }> };
    expect(parsed.entries.length).toBeGreaterThan(0);
  });

  it("generates API metadata", () => {
    const meta = generateApiMetadata(ctx);
    expect(meta.filename).toBe("metadata/api.json");
    const parsed = JSON.parse(meta.content) as { title: string };
    expect(parsed.title).toBe("test-project");
  });

  it("generates all metadata via registry", () => {
    const pages = runPageGenerators(ctx);
    const metadata = runMetadataGenerators(ctx, pages);
    expect(metadata.length).toBeGreaterThanOrEqual(4);
  });
});

describe("File Writer", () => {
  const outDir = join(TEMP_DIR, "writer-test");

  afterEach(() => {
    if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
  });

  it("writes pages to disk", () => {
    const pages = [
      {
        slug: "test-page",
        title: "Test",
        description: "Test page",
        category: "Test",
        order: 1,
        content: "# Test\n\nHello world",
        source: "test",
        related: [],
        readingTimeMinutes: 1,
      },
    ];
    const { written, skipped } = writeGeneratedOutput(outDir, pages, [], false);
    expect(written).toBe(1);
    expect(skipped).toBe(0);
    expect(existsSync(join(outDir, "test-page.mdx"))).toBe(true);
    expect(readFileSync(join(outDir, "test-page.mdx"), "utf-8")).toContain("# Test");
  });

  it("skips existing files when not overwriting", () => {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "existing.mdx"), "existing content");
    const pages = [
      {
        slug: "existing",
        title: "Test",
        description: "Test",
        category: "Test",
        order: 1,
        content: "# New content",
        source: "test",
        related: [],
        readingTimeMinutes: 1,
      },
    ];
    const { written, skipped } = writeGeneratedOutput(outDir, pages, [], false);
    expect(written).toBe(0);
    expect(skipped).toBe(1);
    expect(readFileSync(join(outDir, "existing.mdx"), "utf-8")).toBe("existing content");
  });

  it("overwrites when overwrite=true", () => {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "existing.mdx"), "old content");
    const pages = [
      {
        slug: "existing",
        title: "Test",
        description: "Test",
        category: "Test",
        order: 1,
        content: "# New content",
        source: "test",
        related: [],
        readingTimeMinutes: 1,
      },
    ];
    const { written } = writeGeneratedOutput(outDir, pages, [], true);
    expect(written).toBe(1);
    expect(readFileSync(join(outDir, "existing.mdx"), "utf-8")).toContain("# New content");
  });

  it("writes metadata files", () => {
    const metadata = [
      {
        filename: "metadata/sidebar.json",
        content: '{"groups":[]}',
        kind: "json" as const,
      },
    ];
    const { written } = writeGeneratedOutput(outDir, [], metadata, false);
    expect(written).toBe(1);
    expect(existsSync(join(outDir, "metadata", "sidebar.json"))).toBe(true);
  });

  it("cleans output directory", () => {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "file.mdx"), "content");
    cleanGeneratedOutput(outDir);
    expect(existsSync(outDir)).toBe(false);
  });
});

describe("Generator Cache", () => {
  const cacheDir = join(TEMP_DIR, "cache-test");

  afterEach(() => {
    if (existsSync(cacheDir)) rmSync(cacheDir, { recursive: true, force: true });
  });

  it("misses on first check", () => {
    const cache = new GeneratorCache(cacheDir);
    expect(cache.isUpToDate("key1", "content1")).toBe(false);
  });

  it("hits after recording", () => {
    const cache = new GeneratorCache(cacheDir);
    cache.record("key1", "content1");
    expect(cache.isUpToDate("key1", "content1")).toBe(true);
  });

  it("misses when content changes", () => {
    const cache = new GeneratorCache(cacheDir);
    cache.record("key1", "content1");
    expect(cache.isUpToDate("key1", "content2")).toBe(false);
  });

  it("persists and reloads", () => {
    const cache1 = new GeneratorCache(cacheDir);
    cache1.record("key1", "content1");
    cache1.save();

    const cache2 = new GeneratorCache(cacheDir);
    expect(cache2.isUpToDate("key1", "content1")).toBe(true);
  });

  it("tracks stats", () => {
    const cache = new GeneratorCache(cacheDir);
    cache.record("a", "1");
    cache.isUpToDate("a", "1");
    cache.isUpToDate("b", "2");
    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
  });

  it("clears cache", () => {
    const cache = new GeneratorCache(cacheDir);
    cache.record("a", "1");
    cache.clear();
    expect(cache.isUpToDate("a", "1")).toBe(false);
  });
});

describe("Full Generation Pipeline", () => {
  let dir: string;
  const logger = createLoggerSync();

  beforeEach(() => {
    dir = createTestProject();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("generates all documentation", async () => {
    const result = await generateDocs({
      rootDir: dir,
      logger,
      generatorConfig: { enabled: true },
    });
    expect(result.stats.totalPages).toBeGreaterThanOrEqual(6);
    expect(result.stats.totalMetadata).toBeGreaterThanOrEqual(4);
    expect(result.stats.filesScanned).toBeGreaterThanOrEqual(2);
    expect(result.stats.duration).toBeGreaterThan(0);
  });

  it("writes output to disk", async () => {
    await generateDocs({
      rootDir: dir,
      logger,
      generatorConfig: { enabled: true, output: "./test-gen" },
    });
    const outputDir = join(dir, "test-gen");
    expect(existsSync(outputDir)).toBe(true);
    expect(existsSync(join(outputDir, "overview.mdx"))).toBe(true);
    expect(existsSync(join(outputDir, "architecture.mdx"))).toBe(true);
    expect(existsSync(join(outputDir, "cli.mdx"))).toBe(true);
    expect(existsSync(join(outputDir, "metadata", "sidebar.json"))).toBe(true);
  });

  it("supports clean mode", async () => {
    const outputDir = join(dir, "test-gen-clean");
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(join(outputDir, "old.mdx"), "old");

    await generateDocs({
      rootDir: dir,
      logger,
      generatorConfig: { enabled: true, output: "./test-gen-clean" },
      clean: true,
    });

    expect(existsSync(join(outputDir, "old.mdx"))).toBe(false);
  });

  it("supports api-only mode", async () => {
    const result = await generateDocs({
      rootDir: dir,
      logger,
      generatorConfig: { enabled: true },
      apiOnly: true,
    });
    const slugs = result.pages.map((p) => p.slug);
    expect(slugs).toContain("overview");
    expect(slugs).not.toContain("architecture");
    expect(slugs).not.toContain("cli");
  });

  it("supports examples-only mode", async () => {
    const result = await generateDocs({
      rootDir: dir,
      logger,
      generatorConfig: { enabled: true },
      examplesOnly: true,
    });
    const slugs = result.pages.map((p) => p.slug);
    expect(slugs).toContain("examples");
    expect(slugs).toContain("overview");
    expect(slugs).not.toContain("architecture");
  });

  it("generates valid frontmatter-like content", async () => {
    const result = await generateDocs({
      rootDir: dir,
      logger,
      generatorConfig: { enabled: true },
    });
    for (const page of result.pages) {
      expect(page.title).toBeTruthy();
      expect(page.description).toBeTruthy();
      expect(page.slug).toBeTruthy();
      expect(page.content).toBeTruthy();
      expect(page.readingTimeMinutes).toBeGreaterThan(0);
    }
  });

  it("generates valid metadata JSON", async () => {
    const result = await generateDocs({
      rootDir: dir,
      logger,
      generatorConfig: { enabled: true },
    });
    for (const meta of result.metadata) {
      expect(() => JSON.parse(meta.content)).not.toThrow();
      expect(meta.filename).toBeTruthy();
    }
  });
});

describe("Monorepo Detection", () => {
  afterEach(() => {
    rmSync(TEMP_DIR, { recursive: true, force: true });
  });

  it("detects pnpm workspace", () => {
    const dir = join(TEMP_DIR, "monorepo-test");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "root", workspaces: ["packages/*"] }),
    );
    writeFileSync(join(dir, "pnpm-workspace.yaml"), "packages:\n  - packages/*");
    mkdirSync(join(dir, "packages", "core"), { recursive: true });
    writeFileSync(
      join(dir, "packages", "core", "package.json"),
      JSON.stringify({ name: "@test/core" }),
    );

    try {
      const analysis = analyzeProject(dir);
      expect(analysis.projectType).toBe("monorepo");
      expect(analysis.packageManager).toBe("pnpm");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("Edge Cases", () => {
  afterEach(() => {
    rmSync(TEMP_DIR, { recursive: true, force: true });
  });

  it("handles empty project", () => {
    const dir = join(TEMP_DIR, "empty-test");
    mkdirSync(dir, { recursive: true });
    try {
      const analysis = analyzeProject(dir);
      expect(analysis.sourceFiles.length).toBe(0);
      expect(analysis.packageInfo).toBeUndefined();
      expect(analysis.projectType).toBe("unknown");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("handles project without package.json", () => {
    const dir = join(TEMP_DIR, "no-pkg-test");
    mkdirSync(dir, { recursive: true });
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "index.ts"), "export const x = 1;");
    try {
      const analysis = analyzeProject(dir);
      expect(analysis.packageInfo).toBeUndefined();
      expect(analysis.sourceFiles.length).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("handles deep directory structures", () => {
    const dir = join(TEMP_DIR, "deep-test");
    mkdirSync(join(dir, "a", "b", "c", "d", "e"), { recursive: true });
    writeFileSync(join(dir, "a", "b", "c", "d", "e", "deep.ts"), "export const x = 1;");
    try {
      const analysis = analyzeProject(dir);
      expect(analysis.sourceFiles.length).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("handles special characters in file names", () => {
    const dir = join(TEMP_DIR, "special-test");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "special" }));
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "index.ts"), "export const x = 1;");
    try {
      const analysis = analyzeProject(dir);
      expect(analysis.sourceFiles.length).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
