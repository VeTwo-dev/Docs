import { describe, it, expect, vi } from "vitest";
import { createHookRegistry } from "./index.js";
import type { HookContext } from "./index.js";
import type { DocsConfig } from "../config/types.js";
import type { Logger } from "../types/internal.js";

function createMockContext(): HookContext {
  return {
    ctx: {
      config: {} as DocsConfig,
      rootDir: "/test",
      sourceDir: "./src",
      outputDir: "./docs",
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
    },
    config: {} as DocsConfig,
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      success: vi.fn(),
      spin: vi.fn(),
      progress: vi.fn(),
      box: vi.fn(),
      table: vi.fn(),
    } as unknown as Logger,
  };
}

describe("hooks/index", () => {
  describe("createHookRegistry", () => {
    it("returns a registry with register, execute, getAll, clear", () => {
      const registry = createHookRegistry();
      expect(typeof registry.register).toBe("function");
      expect(typeof registry.execute).toBe("function");
      expect(typeof registry.getAll).toBe("function");
      expect(typeof registry.clear).toBe("function");
    });

    it("register adds handler to hook", () => {
      const registry = createHookRegistry();
      const handler = vi.fn();
      registry.register("init", handler);
      expect(registry.getAll("init")).toHaveLength(1);
      expect(registry.getAll("init")[0]).toBe(handler);
    });

    it("register multiple handlers for same hook", () => {
      const registry = createHookRegistry();
      const h1 = vi.fn();
      const h2 = vi.fn();
      registry.register("init", h1);
      registry.register("init", h2);
      expect(registry.getAll("init")).toHaveLength(2);
    });

    it("getAll returns empty array for unregistered hook", () => {
      const registry = createHookRegistry();
      expect(registry.getAll("init")).toEqual([]);
    });

    it("execute calls registered handlers", async () => {
      const registry = createHookRegistry();
      const handler = vi.fn();
      registry.register("init", handler);
      const ctx = createMockContext();
      await registry.execute("init", ctx);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(ctx);
    });

    it("execute calls multiple handlers in order", async () => {
      const registry = createHookRegistry();
      const order: number[] = [];
      registry.register("init", async () => {
        order.push(1);
      });
      registry.register("init", async () => {
        order.push(2);
      });
      await registry.execute("init", createMockContext());
      expect(order).toEqual([1, 2]);
    });

    it("execute does nothing for unregistered hook", async () => {
      const registry = createHookRegistry();
      await expect(registry.execute("init", createMockContext())).resolves.toBeUndefined();
    });

    it("clear removes all handlers", () => {
      const registry = createHookRegistry();
      registry.register("init", vi.fn());
      registry.register("discover", vi.fn());
      registry.clear();
      expect(registry.getAll("init")).toEqual([]);
      expect(registry.getAll("discover")).toEqual([]);
    });

    it("registers handlers for different hooks independently", () => {
      const registry = createHookRegistry();
      const h1 = vi.fn();
      const h2 = vi.fn();
      registry.register("init", h1);
      registry.register("discover", h2);
      expect(registry.getAll("init")).toHaveLength(1);
      expect(registry.getAll("discover")).toHaveLength(1);
      expect(registry.getAll("output")).toHaveLength(0);
    });

    it("execute handles async handlers", async () => {
      const registry = createHookRegistry();
      const results: string[] = [];
      registry.register("load", async () => {
        await new Promise((r) => setTimeout(r, 5));
        results.push("a");
      });
      registry.register("load", async () => {
        results.push("b");
      });
      await registry.execute("load", createMockContext());
      expect(results).toEqual(["a", "b"]);
    });
  });
});
