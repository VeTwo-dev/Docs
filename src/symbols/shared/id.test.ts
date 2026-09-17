import { describe, it, expect } from "vitest";
import { moduleSymbolId, overloadId, packageSymbolId, projectSymbolId, symbolId } from "./id.js";

describe("symbol id helpers", () => {
  it("builds deterministic project and package ids", () => {
    expect(projectSymbolId("demo")).toBe("project:demo");
    expect(packageSymbolId("demo", "core")).toBe("package:demo:core");
  });

  it("builds module ids from language, file and module name", () => {
    expect(moduleSymbolId("typescript", "src/index.ts", "src.index")).toBe(
      "module:typescript:src/index.ts:src.index",
    );
  });

  it("builds declaration ids from the qualified name", () => {
    expect(symbolId("typescript", "src/index.ts", "demo.src.index.Circle")).toBe(
      "typescript:src/index.ts:demo.src.index.Circle",
    );
  });

  it("appends overload discriminators", () => {
    expect(overloadId("typescript:src/index.ts:demo.f", 0)).toBe(
      "typescript:src/index.ts:demo.f#0",
    );
    expect(overloadId("typescript:src/index.ts:demo.f", 1)).toBe(
      "typescript:src/index.ts:demo.f#1",
    );
  });
});
