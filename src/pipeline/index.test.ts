import { describe, it, expect, vi } from "vitest";
import { createPipeline } from "./index.js";
import type { BuildContextMutable, Logger } from "../types/internal.js";
import { defineDocs } from "../config/define.js";

function createMockLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    success: vi.fn(),
    spin: vi.fn(() => ({
      succeed: vi.fn(),
      fail: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      stop: vi.fn(),
      text: "",
    })),
    progress: vi.fn(),
    box: vi.fn(),
    table: vi.fn(),
  };
}

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

describe("createPipeline", () => {
  it("creates a pipeline with run method", () => {
    const logger = createMockLogger();
    const pipeline = createPipeline({ logger, plugins: [] });
    expect(typeof pipeline.run).toBe("function");
  });

  it("runs all lifecycle stages in order", async () => {
    const logger = createMockLogger();
    const pipeline = createPipeline({ logger, plugins: [] });
    const ctx = createMockCtx();

    await pipeline.run(ctx);

    expect(logger.info).toHaveBeenCalled();
    expect(logger.success).toHaveBeenCalled();
  }, 30_000);

  it("registers plugin hooks", async () => {
    const logger = createMockLogger();
    const hookCalls: string[] = [];

    const pipeline = createPipeline({
      logger,
      plugins: [
        {
          name: "test-plugin",
          version: "1.0.0",
          hooks: {
            init: (ctx) => {
              hookCalls.push("init");
              ctx.log.info("plugin init");
            },
            done: (ctx) => {
              hookCalls.push("done");
              ctx.log.info("plugin done");
            },
          },
        },
      ],
    });

    const ctx = createMockCtx();
    await pipeline.run(ctx);

    expect(hookCalls).toContain("init");
    expect(hookCalls).toContain("done");
  });

  it("reports warnings count when warnings exist", async () => {
    const logger = createMockLogger();
    const pipeline = createPipeline({ logger, plugins: [] });
    const ctx = createMockCtx({
      warnings: [{ code: "TEST_WARN", message: "test warning" }],
    });

    await pipeline.run(ctx);

    expect(logger.warn).toHaveBeenCalledWith("1 warning(s)");
  });

  it("reports error count when errors exist", async () => {
    const logger = createMockLogger();
    const pipeline = createPipeline({ logger, plugins: [] });
    const ctx = createMockCtx({
      errors: [{ code: "TEST_ERR", message: "test error" }],
    });

    await pipeline.run(ctx);

    expect(logger.error).toHaveBeenCalledWith("1 error(s)");
  });

  it("runs sitemap feature when config.sitemap is true", async () => {
    const logger = createMockLogger();
    const pipeline = createPipeline({ logger, plugins: [] });
    const ctx = createMockCtx({
      config: defineDocs({ sitemap: true }),
    });

    await pipeline.run(ctx);

    expect(logger.debug).toHaveBeenCalled();
  });

  it("runs rss feature when config.rss is true", async () => {
    const logger = createMockLogger();
    const pipeline = createPipeline({ logger, plugins: [] });
    const ctx = createMockCtx({
      config: defineDocs({ rss: true }),
    });

    await pipeline.run(ctx);

    expect(logger.debug).toHaveBeenCalled();
  });

  it("skips search feature when config.search.enabled is false", async () => {
    const logger = createMockLogger();
    const pipeline = createPipeline({ logger, plugins: [] });
    const ctx = createMockCtx({
      config: defineDocs({ search: { enabled: false } }),
    });

    await pipeline.run(ctx);

    expect(ctx.searchIndex).toBeUndefined();
  });

  it("runs plugin generate hooks", async () => {
    const logger = createMockLogger();
    let generateCalled = false;

    const pipeline = createPipeline({
      logger,
      plugins: [
        {
          name: "gen-plugin",
          version: "1.0.0",
          hooks: {
            generate: () => {
              generateCalled = true;
            },
          },
        },
      ],
    });

    const ctx = createMockCtx();
    await pipeline.run(ctx);

    expect(generateCalled).toBe(true);
  });
});
