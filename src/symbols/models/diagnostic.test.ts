import { describe, it, expect } from "vitest";
import {
  SYMBOL_DIAGNOSTIC_CODES,
  createSymbolDiagnostic,
  isErrorDiagnostic,
  type SymbolDiagnostic,
} from "./diagnostic.js";

describe("createSymbolDiagnostic", () => {
  it("builds a frozen normalized diagnostic", () => {
    const diagnostic = createSymbolDiagnostic({
      code: "duplicate-symbol",
      severity: "warning",
      message: "Duplicate symbol.",
      languageId: "typescript",
      extractorId: "typescript",
      file: "src/index.ts",
      symbolId: "id-1",
      symbolName: "Circle",
    });
    expect(diagnostic.code).toBe("duplicate-symbol");
    expect(diagnostic.severity).toBe("warning");
    expect(diagnostic.extractorId).toBe("typescript");
    expect(diagnostic.symbolName).toBe("Circle");
    expect(Object.isFrozen(diagnostic)).toBe(true);
  });

  it("omits optional fields when absent", () => {
    const diagnostic = createSymbolDiagnostic({
      code: "missing-extractor",
      severity: "info",
      message: "No extractor.",
      languageId: "unknown",
    });
    expect(diagnostic.file).toBeUndefined();
    expect(diagnostic.extractorId).toBeUndefined();
  });
});

describe("isErrorDiagnostic", () => {
  const error = createSymbolDiagnostic({
    code: "extractor-failure",
    severity: "error",
    message: "boom",
    languageId: "typescript",
  });
  const warning = createSymbolDiagnostic({
    code: "unnamed-symbol",
    severity: "warning",
    message: "anonymous",
    languageId: "typescript",
  });

  it("flags error-severity diagnostics", () => {
    expect(isErrorDiagnostic(error)).toBe(true);
    expect(isErrorDiagnostic(warning)).toBe(false);
  });
});

describe("SYMBOL_DIAGNOSTIC_CODES", () => {
  it("includes every supported code", () => {
    const codes: SymbolDiagnostic["code"][] = [...SYMBOL_DIAGNOSTIC_CODES];
    expect(codes).toContain("duplicate-symbol");
    expect(codes).toContain("broken-compiler-metadata");
    expect(codes).toContain("unsupported-construct");
    expect(codes).toContain("missing-extractor");
  });
});
