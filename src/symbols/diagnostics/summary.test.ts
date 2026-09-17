import { describe, it, expect } from "vitest";
import { summarizeSymbolDiagnostics } from "./summary.js";
import { createSymbolDiagnostic } from "../models/index.js";

describe("summarizeSymbolDiagnostics", () => {
  it("tallies by severity and code", () => {
    const diagnostics = [
      createSymbolDiagnostic({
        code: "duplicate-symbol",
        severity: "warning",
        message: "a",
        languageId: "typescript",
      }),
      createSymbolDiagnostic({
        code: "duplicate-symbol",
        severity: "warning",
        message: "b",
        languageId: "typescript",
      }),
      createSymbolDiagnostic({
        code: "missing-extractor",
        severity: "info",
        message: "c",
        languageId: "typescript",
      }),
      createSymbolDiagnostic({
        code: "extractor-failure",
        severity: "error",
        message: "d",
        languageId: "typescript",
      }),
    ];
    const summary = summarizeSymbolDiagnostics(diagnostics);
    expect(summary.total).toBe(4);
    expect(summary.errors).toBe(1);
    expect(summary.warnings).toBe(2);
    expect(summary.infos).toBe(1);
    expect(summary.byCode).toEqual({
      "duplicate-symbol": 2,
      "missing-extractor": 1,
      "extractor-failure": 1,
    });
  });

  it("returns zeroed counters for an empty list", () => {
    const summary = summarizeSymbolDiagnostics([]);
    expect(summary).toEqual({ total: 0, errors: 0, warnings: 0, infos: 0, byCode: {} });
  });

  it("freezes the summary", () => {
    const summary = summarizeSymbolDiagnostics([]);
    expect(Object.isFrozen(summary)).toBe(true);
    expect(Object.isFrozen(summary.byCode)).toBe(true);
  });
});
