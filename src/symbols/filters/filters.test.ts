import { describe, it, expect } from "vitest";
import { createSymbol, type SymbolInput } from "../models/symbol.js";
import {
  acceptAll,
  and,
  composeFilter,
  deprecated,
  exported,
  inFile,
  inPackage,
  matches,
  ofKind,
  or,
  symbolMatchesFilter,
} from "./filters.js";

function makeSymbol(overrides: Partial<SymbolInput> = {}): ReturnType<typeof createSymbol> {
  return createSymbol({
    kind: "function",
    identifier: "area",
    qualifiedName: "demo.src.index.area",
    file: "src/index.ts",
    languageId: "typescript",
    packageName: "demo",
    moduleName: "src.index",
    compiler: { compilerId: "typescript", format: "typescript" },
    id: "ts:src/index.ts:demo.area",
    hash: "h",
    ...overrides,
  });
}

describe("symbolMatchesFilter", () => {
  it("matches on kinds, flags and names", () => {
    const symbol = makeSymbol({ exported: true, deprecated: true, internal: true });
    expect(symbolMatchesFilter(symbol, { kinds: ["function"] })).toBe(true);
    expect(symbolMatchesFilter(symbol, { kinds: ["class"] })).toBe(false);
    expect(symbolMatchesFilter(symbol, { exported: true })).toBe(true);
    expect(symbolMatchesFilter(symbol, { exported: false })).toBe(false);
    expect(symbolMatchesFilter(symbol, { deprecated: true })).toBe(true);
    expect(symbolMatchesFilter(symbol, { internal: true })).toBe(true);
    expect(symbolMatchesFilter(symbol, { name: "area" })).toBe(true);
    expect(symbolMatchesFilter(symbol, { name: "Circle" })).toBe(false);
  });

  it("matches qualified names against a pattern", () => {
    const symbol = makeSymbol();
    expect(symbolMatchesFilter(symbol, { namePattern: /^demo\./ })).toBe(true);
    expect(symbolMatchesFilter(symbol, { namePattern: /^other\./ })).toBe(false);
  });

  it("passes when no predicate fields are set", () => {
    expect(symbolMatchesFilter(makeSymbol(), {})).toBe(true);
  });
});

describe("filter combinators", () => {
  const publicFn = makeSymbol({ exported: true, visibility: "public" });
  const privateFn = makeSymbol({ visibility: "private" });

  it("and requires every filter to pass", () => {
    const filter = and(exported, ofKind("function"));
    expect(filter(publicFn)).toBe(true);
    expect(filter(privateFn)).toBe(false);
  });

  it("or passes when any filter passes", () => {
    const filter = or(exported, ofKind("class"));
    expect(filter(privateFn)).toBe(false);
    expect(filter(publicFn)).toBe(true);
  });

  it("acceptAll passes everything", () => {
    expect(acceptAll(privateFn)).toBe(true);
  });

  it("ofKind filters by kind set", () => {
    expect(ofKind("function", "class")(publicFn)).toBe(true);
    expect(ofKind("property")(publicFn)).toBe(false);
  });

  it("inFile and inPackage filter by location", () => {
    expect(inFile("src/index.ts")(publicFn)).toBe(true);
    expect(inFile("src/other.ts")(publicFn)).toBe(false);
    expect(inPackage("demo")(publicFn)).toBe(true);
    expect(inPackage("core")(publicFn)).toBe(false);
  });

  it("matches and composeFilter wrap a predicate description", () => {
    const symbol = makeSymbol({ deprecated: true });
    expect(matches({ deprecated: true })(symbol)).toBe(true);
    expect(composeFilter({ deprecated: true })(symbol)).toBe(true);
    expect(composeFilter({ deprecated: false })(symbol)).toBe(false);
  });

  it("deprecated filters deprecated symbols", () => {
    const marked = makeSymbol({ deprecated: true });
    expect(deprecated(marked)).toBe(true);
    expect(deprecated(publicFn)).toBe(false);
  });
});
