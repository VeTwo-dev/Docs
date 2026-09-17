import { describe, it, expect } from "vitest";
import { createSymbol, type SymbolInput } from "../models/symbol.js";
import {
  detectDuplicateSymbols,
  detectSymbolDiagnostics,
  detectUnnamedSymbols,
  hasErrorDiagnostics,
  type SymbolDiagnosticsSettings,
} from "./detections.js";
import { createSymbolDiagnostic } from "../models/index.js";

function symbol(overrides: Partial<SymbolInput> = {}): ReturnType<typeof createSymbol> {
  return createSymbol({
    kind: "function",
    identifier: "area",
    qualifiedName: "demo.area",
    file: "src/index.ts",
    languageId: "typescript",
    compiler: { compilerId: "typescript", format: "typescript" },
    id: `id-${overrides.identifier ?? "area"}`,
    hash: "h",
    ...overrides,
  });
}

const settings: SymbolDiagnosticsSettings = {
  languageId: "typescript",
  extractorId: "typescript",
  file: "src/index.ts",
};

describe("detectSymbolDiagnostics", () => {
  it("flags duplicate names in the same scope", () => {
    const diagnostics = detectSymbolDiagnostics(
      [symbol({ identifier: "f", id: "id-1" }), symbol({ identifier: "f", id: "id-2" })],
      settings,
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.code).toBe("duplicate-symbol");
    expect(diagnostics[0]!.severity).toBe("warning");
    expect(diagnostics[0]!.symbolName).toBe("f");
  });

  it("does not flag duplicates in different scopes", () => {
    const diagnostics = detectSymbolDiagnostics(
      [
        symbol({ identifier: "f", id: "id-1", parentId: "a" }),
        symbol({ identifier: "f", id: "id-2", parentId: "b" }),
      ],
      settings,
    );
    expect(diagnostics).toHaveLength(0);
  });

  it("flags anonymous symbols", () => {
    const diagnostics = detectSymbolDiagnostics(
      [symbol({ identifier: "", id: "id-anon" })],
      settings,
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.code).toBe("unnamed-symbol");
    expect(diagnostics[0]!.message).toContain("anonymous");
  });
});

describe("detectDuplicateSymbols", () => {
  it("flags duplicates at module top level", () => {
    const diagnostics = detectDuplicateSymbols(
      [
        symbol({ identifier: "f", id: "id-1", parentId: "module" }),
        symbol({ identifier: "f", id: "id-2", parentId: "module" }),
      ],
      settings,
    );
    expect(diagnostics).toHaveLength(1);
  });
});

describe("detectUnnamedSymbols", () => {
  it("flags only anonymous symbols", () => {
    const diagnostics = detectUnnamedSymbols(
      [symbol({ identifier: "", id: "id-1" }), symbol({ identifier: "named", id: "id-2" })],
      settings,
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.symbolId).toBe("id-1");
  });
});

describe("hasErrorDiagnostics", () => {
  it("detects error-severity diagnostics", () => {
    const error = createSymbolDiagnostic({
      code: "extractor-failure",
      severity: "error",
      message: "boom",
      languageId: "typescript",
    });
    const info = createSymbolDiagnostic({
      code: "unsupported-construct",
      severity: "info",
      message: "skip",
      languageId: "typescript",
    });
    expect(hasErrorDiagnostics([info])).toBe(false);
    expect(hasErrorDiagnostics([info, error])).toBe(true);
  });
});
