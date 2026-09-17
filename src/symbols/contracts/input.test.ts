import { describe, it, expect } from "vitest";
import type { SymbolExtractionInput, SymbolExtractionOptions } from "./input.js";

const unit = {
  file: "src/a.ts",
  languageId: "typescript",
  compilerId: "typescript",
  status: "ok",
  diagnostics: [],
  hash: "h",
};

function input(overrides: Partial<SymbolExtractionInput> = {}): SymbolExtractionInput {
  return {
    rootDir: "/root",
    requestId: "r1",
    languageId: "typescript",
    extractorId: "typescript",
    projectName: "demo",
    units: [unit],
    fileToPackage: { "src/a.ts": "demo" },
    ...overrides,
  };
}

describe("SymbolExtractionInput", () => {
  it("carries project context plus pre-grouped units", () => {
    const value = input();
    expect(value.rootDir).toBe("/root");
    expect(value.requestId).toBe("r1");
    expect(value.languageId).toBe("typescript");
    expect(value.extractorId).toBe("typescript");
    expect(value.projectName).toBe("demo");
    expect(value.units).toHaveLength(1);
    expect(value.fileToPackage["src/a.ts"]).toBe("demo");
    expect(value.options).toBeUndefined();
  });

  it("is optional-free about units and package mapping", () => {
    const value = input({ units: [], fileToPackage: {} });
    expect(value.units).toEqual([]);
    expect(Object.keys(value.fileToPackage)).toEqual([]);
  });

  it("accepts extraction options", () => {
    const options: SymbolExtractionOptions = { skipCache: true, maxSymbols: 50 };
    expect(input({ options }).options).toEqual(options);
  });
});
