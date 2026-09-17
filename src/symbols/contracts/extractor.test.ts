import { describe, it, expect, vi } from "vitest";
import {
  createSymbolExtractor,
  type SymbolExtractionInput,
  type SymbolExtractionOutput,
  type SymbolExtractor,
} from "./extractor.js";

function makeExtractor(overrides: Partial<SymbolExtractor> = {}): SymbolExtractor {
  return createSymbolExtractor({
    metadata: {
      id: "ts",
      languageId: "typescript",
      displayName: "TS",
      version: "1.0.0",
      priority: 0,
      source: "builtin",
    },
    capabilities: { documents: "tsdoc" },
    extract: () => ({
      languageId: "typescript",
      extractorId: "ts",
      modules: [],
      symbols: [],
      relationships: [],
      diagnostics: [],
      extractedFiles: [],
      statistics: {
        files: 0,
        extractedFiles: 0,
        cachedFiles: 0,
        symbolCount: 0,
        moduleCount: 0,
        diagnosticsCount: 0,
        extractTimeMs: 0,
      },
    }),
    ...overrides,
  });
}

describe("createSymbolExtractor", () => {
  it("freezes the extractor and its metadata", () => {
    const extractor = makeExtractor();
    expect(Object.isFrozen(extractor)).toBe(true);
    expect(Object.isFrozen(extractor.metadata)).toBe(true);
    expect(extractor.metadata.id).toBe("ts");
    expect(extractor.capabilities.documents).toBe("tsdoc");
  });

  it("preserves hooks and minimumApiVersion", () => {
    const onDispose = vi.fn();
    const extractor = makeExtractor({ hooks: { onDispose }, minimumApiVersion: "1" });
    expect(extractor.minimumApiVersion).toBe("1");
    expect(extractor.hooks?.onDispose).toBe(onDispose);
  });

  it("delegates extract calls", () => {
    const output: SymbolExtractionOutput = {
      languageId: "typescript",
      extractorId: "ts",
      modules: [],
      symbols: [],
      relationships: [],
      diagnostics: [],
      extractedFiles: [],
      statistics: {
        files: 0,
        extractedFiles: 0,
        cachedFiles: 0,
        symbolCount: 0,
        moduleCount: 0,
        diagnosticsCount: 0,
        extractTimeMs: 0,
      },
    };
    const extract = vi.fn(() => output);
    const extractor = makeExtractor({
      extract: extract as SymbolExtractor["extract"],
    });
    const input = {} as SymbolExtractionInput;
    expect(extractor.extract(input)).toBe(output);
    expect(extract).toHaveBeenCalledWith(input);
  });
});
