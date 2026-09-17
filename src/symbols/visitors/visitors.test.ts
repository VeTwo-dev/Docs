import { describe, it, expect } from "vitest";
import { buildSymbols, type SymbolInput } from "../models/symbol.js";
import {
  ancestorSymbols,
  childSymbols,
  collectSymbols,
  descendantCount,
  leafSymbols,
  maxDepth,
  visitSymbols,
  visitSymbolsMany,
} from "./visitors.js";

function input(overrides: Partial<SymbolInput>): SymbolInput {
  return {
    kind: "module",
    identifier: "src.index",
    qualifiedName: "demo.src.index",
    file: "src/index.ts",
    languageId: "typescript",
    compiler: { compilerId: "typescript", format: "typescript" },
    id: "id",
    hash: "h",
    ...overrides,
  };
}

function buildTree(): {
  module: ReturnType<typeof buildSymbols>["symbols"][number];
  circle: ReturnType<typeof buildSymbols>["symbols"][number];
} {
  const { symbols } = buildSymbols([
    input({
      id: "module",
      identifier: "src.index",
      childrenIds: ["circle", "area"],
    }),
    input({
      id: "circle",
      kind: "class",
      identifier: "Circle",
      qualifiedName: "demo.src.index.Circle",
      parentId: "module",
      childrenIds: ["x", "circle-area"],
    }),
    input({ id: "x", kind: "property", identifier: "x", parentId: "circle" }),
    input({
      id: "circle-area",
      kind: "method",
      identifier: "area",
      parentId: "circle",
    }),
    input({ id: "area", kind: "function", identifier: "area", parentId: "module" }),
  ]);
  return { module: symbols[0]!, circle: symbols[1]! };
}

describe("visitSymbols", () => {
  it("walks pre-order by default", () => {
    const { module } = buildTree();
    const order: string[] = [];
    visitSymbols(module, (symbol) => {
      order.push(symbol.name);
    });
    expect(order).toEqual(["src.index", "Circle", "x", "area", "area"]);
  });

  it("walks post-order when requested", () => {
    const { module } = buildTree();
    const order: string[] = [];
    visitSymbols(
      module,
      (symbol) => {
        order.push(symbol.name);
      },
      { order: "post-order" },
    );
    expect(order).toEqual(["x", "area", "Circle", "area", "src.index"]);
  });

  it("prunes subtrees when the visitor returns false", () => {
    const { module } = buildTree();
    const order: string[] = [];
    visitSymbols(module, (symbol) => {
      order.push(symbol.name);
      return symbol.name !== "Circle";
    });
    expect(order).toEqual(["src.index", "Circle", "area"]);
  });

  it("prunes subtrees whose roots fail the filter", () => {
    const { module } = buildTree();
    const visited: string[] = [];
    visitSymbols(
      module,
      (symbol) => {
        visited.push(symbol.name);
      },
      { filter: (symbol) => symbol.kind !== "class" },
    );
    expect(visited).toEqual(["src.index", "area"]);
  });

  it("shares visited sets across walks", () => {
    const { module, circle } = buildTree();
    const visited = new Set<string>();
    const first: string[] = [];
    visitSymbols(
      module,
      (symbol) => {
        first.push(symbol.name);
      },
      { visited },
    );
    const second: string[] = [];
    visitSymbolsMany(
      [circle],
      (symbol) => {
        second.push(symbol.name);
      },
      { visited },
    );
    expect(first).toHaveLength(5);
    expect(second).toEqual([]);
  });
});

describe("symbol traversal helpers", () => {
  it("collects all symbols reachable from a root", () => {
    const { module } = buildTree();
    expect(collectSymbols(module).map((symbol) => symbol.name)).toEqual([
      "src.index",
      "Circle",
      "x",
      "area",
      "area",
    ]);
  });

  it("returns ancestors nearest first", () => {
    const { circle } = buildTree();
    const x = circle.symbols.get("x")!;
    expect(ancestorSymbols(x).map((symbol) => symbol.name)).toEqual(["Circle", "src.index"]);
    expect(ancestorSymbols(circle).map((symbol) => symbol.name)).toEqual(["src.index"]);
  });

  it("returns direct children in declaration order", () => {
    const { module } = buildTree();
    expect(childSymbols(module).map((symbol) => symbol.name)).toEqual(["Circle", "area"]);
  });

  it("collects leaf symbols", () => {
    const { module } = buildTree();
    expect(
      leafSymbols(module)
        .map((symbol) => symbol.name)
        .sort(),
    ).toEqual(["area", "area", "x"]);
  });

  it("counts descendants and computes max depth", () => {
    const { module } = buildTree();
    expect(descendantCount(module)).toBe(4);
    expect(maxDepth(module)).toBe(2);
  });
});
