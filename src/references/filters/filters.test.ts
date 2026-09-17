import { describe, it, expect } from "vitest";
import {
  acceptAll,
  and,
  composeFilter,
  fromSymbol,
  inFile,
  matches,
  not,
  ofKind,
  or,
  referenceMatchesFilter,
  resolved,
  toSymbol,
  unresolved,
  type Reference,
  type ReferenceFilterContext,
} from "./index.js";

const M = { id: "m1", metadata: { location: { file: "src/a.ts" } } } as const;

const context: ReferenceFilterContext = {
  symbols: new Map([["m1", M as never]]),
};

const refs = {
  resolvedImport: {
    id: "r1",
    kind: "import",
    fromId: "m1",
    specifier: "./point",
    toId: "m2",
    resolved: true,
  } as Reference,
  unresolvedHeritage: {
    id: "r2",
    kind: "heritage",
    fromId: "m1",
    name: "Missing",
    resolved: false,
  } as Reference,
  toPoint: {
    id: "r3",
    kind: "import-name",
    fromId: "m1",
    name: "point",
    toId: "point-symbol",
    resolved: true,
  } as Reference,
};

describe("reference filters", () => {
  it("accepts and rejects by resolution state", () => {
    expect(acceptAll(refs.resolvedImport)).toBe(true);
    expect(resolved(refs.resolvedImport)).toBe(true);
    expect(resolved(refs.unresolvedHeritage)).toBe(false);
    expect(unresolved(refs.unresolvedHeritage)).toBe(true);
    expect(unresolved(refs.resolvedImport)).toBe(false);
  });

  it("filters by kind and symbol ids", () => {
    expect(ofKind("import")(refs.resolvedImport)).toBe(true);
    expect(ofKind("heritage", "type-use")(refs.unresolvedHeritage)).toBe(true);
    expect(ofKind("export")(refs.resolvedImport)).toBe(false);
    expect(fromSymbol("m1")(refs.resolvedImport)).toBe(true);
    expect(toSymbol("point-symbol")(refs.toPoint)).toBe(true);
    expect(toSymbol("nope")(refs.toPoint)).toBe(false);
  });

  it("filters by source file through the symbol context", () => {
    expect(inFile("src/a.ts")(refs.resolvedImport, context)).toBe(true);
    expect(inFile("src/b.ts")(refs.resolvedImport, context)).toBe(false);
    expect(inFile("src/a.ts")(refs.resolvedImport)).toBe(false);
  });

  it("filters by name pattern", () => {
    expect(matches(/^Mi/)(refs.unresolvedHeritage)).toBe(true);
    expect(matches(/^Missing$/)(refs.resolvedImport)).toBe(false);
  });

  it("combines, negates and composes filters", () => {
    const combined = and(resolved, ofKind("import"));
    expect(combined(refs.resolvedImport)).toBe(true);
    expect(or(ofKind("export"), unresolved)(refs.unresolvedHeritage)).toBe(true);
    expect(not(ofKind("import"))(refs.unresolvedHeritage)).toBe(true);
    expect(composeFilter(ofKind("import"), fromSymbol("m1"))(refs.resolvedImport)).toBe(true);
    expect(referenceMatchesFilter(refs.toPoint, toSymbol("point-symbol"))).toBe(true);
  });
});
