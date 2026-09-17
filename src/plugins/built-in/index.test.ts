import { describe, it, expect, vi } from "vitest";
import type { HookContext } from "../../types/internal.js";
import { openApi, mermaid } from "./index.js";

describe("openApi", () => {
  it("returns plugin with correct name", () => {
    const plugin = openApi();
    expect(plugin.name).toBe("@vetwo/docs/openapi");
    expect(plugin.version).toBe("0.1.0");
  });

  it("has a load hook", () => {
    const plugin = openApi();
    expect(plugin.hooks.load).toBeDefined();
    expect(typeof plugin.hooks.load).toBe("function");
  });

  it("calls log.info when load hook is invoked", async () => {
    const plugin = openApi({ spec: "./openapi.yaml" });
    const mockLog = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      success: vi.fn(),
      spin: vi.fn(),
      progress: vi.fn(),
      box: vi.fn(),
      table: vi.fn(),
    };
    const hookCtx = {
      ctx: {} as HookContext["ctx"],
      config: {} as HookContext["config"],
      log: mockLog,
    };

    await plugin.hooks.load!(hookCtx);

    expect(mockLog.info).toHaveBeenCalledWith("OpenAPI plugin: loading specification");
    expect(mockLog.debug).toHaveBeenCalledWith("OpenAPI spec: ./openapi.yaml");
  });

  it("works without options", async () => {
    const plugin = openApi();
    const mockLog = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      success: vi.fn(),
      spin: vi.fn(),
      progress: vi.fn(),
      box: vi.fn(),
      table: vi.fn(),
    };
    const hookCtx = {
      ctx: {} as HookContext["ctx"],
      config: {} as HookContext["config"],
      log: mockLog,
    };

    await plugin.hooks.load!(hookCtx);

    expect(mockLog.info).toHaveBeenCalled();
    expect(mockLog.debug).not.toHaveBeenCalled();
  });
});

describe("mermaid", () => {
  it("returns plugin with correct name", () => {
    const plugin = mermaid();
    expect(plugin.name).toBe("@vetwo/docs/mermaid");
    expect(plugin.version).toBe("0.1.0");
  });

  it("has a transform hook", () => {
    const plugin = mermaid();
    expect(plugin.hooks.transform).toBeDefined();
    expect(typeof plugin.hooks.transform).toBe("function");
  });

  it("calls log.debug when transform hook is invoked", async () => {
    const plugin = mermaid();
    const mockLog = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      success: vi.fn(),
      spin: vi.fn(),
      progress: vi.fn(),
      box: vi.fn(),
      table: vi.fn(),
    };
    const hookCtx = {
      ctx: {} as HookContext["ctx"],
      config: {} as HookContext["config"],
      log: mockLog,
    };

    await plugin.hooks.transform!(hookCtx);

    expect(mockLog.debug).toHaveBeenCalledWith("Mermaid plugin: transforming diagrams");
  });
});
