import { describe, it, expect } from "vitest";
import { SymbolCache, symbolToInput } from "./cache.js";
import { buildSymbols, createSymbol, type SymbolInput } from "../models/symbol.js";

function moduleInput(overrides: Partial<SymbolInput> = {}): SymbolInput {
  return {
    kind: "module",
    identifier: "src.index",
    qualifiedName: "demo.src.index",
    file: "src/index.ts",
    languageId: "typescript",
    compiler: { compilerId: "typescript", format: "typescript" },
    id: "module:ts:src/index.ts:src.index",
    hash: "hash-m",
    ...overrides,
  };
}

describe("SymbolCache", () => {
  it("starts empty", () => {
    const cache = new SymbolCache();
    expect(cache.size).toBe(0);
    expect(cache.files()).toEqual([]);
    expect(cache.moduleIds()).toEqual([]);
  });

  it("stores and retrieves entries by file hash", () => {
    const cache = new SymbolCache();
    const module = createSymbol(moduleInput({ hash: "hash-m" }));
    cache.put("src/index.ts", "hash-m", [module]);
    expect(cache.has("src/index.ts", "hash-m")).toBe(true);
    expect(cache.has("src/index.ts", "hash-other")).toBe(false);
    const rebuilt = cache.get("src/index.ts", "hash-m");
    expect(rebuilt).toHaveLength(1);
    expect(rebuilt![0]!.name).toBe("src.index");
    expect(cache.size).toBe(1);
    expect(cache.files()).toEqual(["src/index.ts"]);
    expect(cache.moduleIds()).toEqual(["module:ts:src/index.ts:src.index"]);
  });

  it("returns undefined on hash mismatch", () => {
    const cache = new SymbolCache();
    cache.put("src/index.ts", "hash-a", [createSymbol(moduleInput())]);
    expect(cache.get("src/index.ts", "hash-b")).toBeUndefined();
  });

  it("peek rebuilds regardless of hash", () => {
    const cache = new SymbolCache();
    cache.put("src/index.ts", "hash-a", [createSymbol(moduleInput())]);
    expect(cache.peek("src/index.ts")).toHaveLength(1);
    expect(cache.peek("missing.ts")).toBeUndefined();
  });

  it("rebuilds symbols with their store and children", () => {
    const cache = new SymbolCache();
    const module = createSymbol(
      moduleInput({
        childrenIds: ["id-area"],
      }),
    );
    const area = createSymbol(
      moduleInput({
        kind: "function",
        identifier: "area",
        qualifiedName: "demo.src.index.area",
        id: "id-area",
        parentId: "module:ts:src/index.ts:src.index",
      }),
    );
    cache.put("src/index.ts", "hash-m", [module, area]);
    const rebuilt = cache.get("src/index.ts", "hash-m")!;
    expect(rebuilt[0]!.symbols.get("id-area")?.name).toBe("area");
  });

  it("deletes and clears entries", () => {
    const cache = new SymbolCache();
    cache.put("a.ts", "h1", [createSymbol(moduleInput({ file: "a.ts" }))]);
    cache.put("b.ts", "h2", [createSymbol(moduleInput({ file: "b.ts" }))]);
    expect(cache.delete("a.ts")).toBe(true);
    expect(cache.delete("a.ts")).toBe(false);
    expect(cache.files()).toEqual(["b.ts"]);
    cache.clear();
    expect(cache.size).toBe(0);
  });
});

describe("symbolToInput", () => {
  it("round-trips a symbol with payloads", () => {
    const { symbols } = buildSymbols([
      moduleInput({
        kind: "class",
        identifier: "Circle",
        qualifiedName: "demo.src.index.Circle",
        id: "id-circle",
        heritage: ["Point"],
        parameterCount: 1,
      }),
    ]);
    const input = symbolToInput(symbols[0]!);
    expect(input.identifier).toBe("Circle");
    expect(input.heritage).toEqual(["Point"]);
    expect(input.parameterCount).toBe(1);
    expect(input.id).toBe("id-circle");
  });
});
