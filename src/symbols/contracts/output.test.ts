import { describe, it, expect } from "vitest";
import type { SymbolExtractionOutput, SymbolExtractionStatistics } from "./output.js";

const statistics: SymbolExtractionStatistics = {
  files: 2,
  extractedFiles: 2,
  cachedFiles: 0,
  symbolCount: 5,
  moduleCount: 2,
  diagnosticsCount: 0,
  extractTimeMs: 12,
};

const output: SymbolExtractionOutput = {
  languageId: "typescript",
  extractorId: "typescript",
  modules: [],
  symbols: [],
  relationships: [],
  diagnostics: [],
  extractedFiles: ["src/a.ts", "src/b.ts"],
  statistics,
};

describe("SymbolExtractionOutput", () => {
  it("identifies the extractor that produced it", () => {
    expect(output.languageId).toBe("typescript");
    expect(output.extractorId).toBe("typescript");
    expect(output.extractedFiles).toEqual(["src/a.ts", "src/b.ts"]);
  });

  it("carries aggregate counters", () => {
    expect(output.statistics).toEqual(statistics);
    expect(output.statistics.symbolCount).toBe(5);
    expect(output.statistics.moduleCount).toBe(2);
    expect(output.statistics.diagnosticsCount).toBe(0);
    expect(output.statistics.extractTimeMs).toBeTypeOf("number");
  });

  it("collects empty module and symbol lists", () => {
    expect(output.modules).toEqual([]);
    expect(output.symbols).toEqual([]);
    expect(output.relationships).toEqual([]);
    expect(output.diagnostics).toEqual([]);
  });
});
