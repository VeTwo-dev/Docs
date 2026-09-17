import { describe, it, expect } from "vitest";
import {
  EMPTY_SYMBOL_STORE,
  buildSymbols,
  createSymbol,
  isCallableSymbol,
  isModuleSymbol,
  type SymbolInput,
} from "./symbol.js";
import { isSymbolKind } from "./kind.js";

function moduleInput(overrides: Partial<SymbolInput> = {}): SymbolInput {
  return {
    kind: "module",
    identifier: "src.index",
    qualifiedName: "demo.src.index",
    file: "src/index.ts",
    languageId: "typescript",
    compiler: { compilerId: "typescript", format: "typescript" },
    id: "module:ts:src/index.ts:src.index",
    hash: "h",
    ...overrides,
  };
}

describe("createSymbol", () => {
  it("builds an immutable symbol with mirrors of metadata", () => {
    const symbol = createSymbol(
      moduleInput({ exported: true, exports: ["Circle"], imports: ["./util"] }),
    );
    expect(symbol.kind).toBe("module");
    expect(symbol.name).toBe("src.index");
    expect(symbol.id).toBe(symbol.metadata.id);
    expect(symbol.exports).toEqual(["Circle"]);
    expect(symbol.imports).toEqual(["./util"]);
    expect(Object.isFrozen(symbol)).toBe(true);
  });

  it("defaults to an empty symbol store", () => {
    const symbol = createSymbol(moduleInput());
    expect(symbol.symbols).toBe(EMPTY_SYMBOL_STORE);
    expect(symbol.childrenIds).toEqual([]);
  });

  it("exposes kind-specific payloads", () => {
    const symbol = createSymbol(
      moduleInput({
        kind: "class",
        identifier: "Circle",
        heritage: ["Point"],
        childrenIds: [],
      }),
    );
    expect(symbol.heritage).toEqual(["Point"]);
  });
});

describe("buildSymbols", () => {
  it("resolves ownership edges through a shared store", () => {
    const module = moduleInput({
      id: "id-module",
      childrenIds: ["id-circle"],
    });
    const circle = {
      ...moduleInput({
        kind: "class",
        identifier: "Circle",
        qualifiedName: "demo.src.index.Circle",
        id: "id-circle",
        parentId: "id-module",
      }),
    };
    const { store, symbols } = buildSymbols([module, circle]);
    expect(store.size).toBe(2);
    expect(symbols[0]!.childrenIds).toEqual(["id-circle"]);
    expect(symbols[0]!.symbols.get("id-circle")?.name).toBe("Circle");
    expect(symbols[1]!.parentId).toBe("id-module");
    expect(symbols[1]!.symbols.get("id-module")?.name).toBe("src.index");
  });

  it("freezes the result collections", () => {
    const collection = buildSymbols([moduleInput()]);
    expect(Object.isFrozen(collection)).toBe(true);
    expect(Object.isFrozen(collection.symbols)).toBe(true);
  });
});

describe("kind guards", () => {
  const module = createSymbol(moduleInput());
  const fn = createSymbol(
    moduleInput({ kind: "function", identifier: "area", qualifiedName: "demo.f" }),
  );

  it("identifies module and callable symbols", () => {
    expect(isModuleSymbol(module)).toBe(true);
    expect(isModuleSymbol(fn)).toBe(false);
    expect(isCallableSymbol(fn)).toBe(true);
    expect(isCallableSymbol(module)).toBe(false);
  });

  it("guards symbol kinds", () => {
    expect(isSymbolKind(fn.kind)).toBe(true);
  });
});
