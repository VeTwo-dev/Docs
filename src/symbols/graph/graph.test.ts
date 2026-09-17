import { describe, it, expect } from "vitest";
import { buildSymbolGraph, isExportedSymbol } from "./graph.js";
import { buildSymbols, type SymbolInput } from "../models/symbol.js";

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

function sampleGraph() {
  const { symbols } = buildSymbols([
    input({
      id: "m1",
      identifier: "src.index",
      file: "src/index.ts",
      childrenIds: ["c1"],
      exports: ["Circle"],
      imports: ["./util"],
      reExports: [{ specifier: "./util", names: ["foo"] }],
    }),
    input({
      id: "c1",
      kind: "class",
      identifier: "Circle",
      qualifiedName: "demo.src.index.Circle",
      file: "src/index.ts",
      parentId: "m1",
      exported: true,
    }),
    input({ id: "m2", identifier: "src.util", file: "src/util.ts" }),
  ]);
  return buildSymbolGraph(symbols, {
    resolveModule: (fromFile, specifier) =>
      fromFile === "src/index.ts" && specifier === "./util" ? "src/util.ts" : undefined,
  });
}

describe("buildSymbolGraph", () => {
  it("indexes nodes and modules", () => {
    const graph = sampleGraph();
    expect(graph.nodes.size).toBe(3);
    expect(graph.findSymbol("c1")?.name).toBe("Circle");
    expect(graph.moduleOf("src/index.ts")?.name).toBe("src.index");
    expect(graph.moduleOf("missing.ts")).toBeUndefined();
  });

  it("derives ownership and declared-in relationships", () => {
    const graph = sampleGraph();
    const types = graph.relationships.map((relationship) => relationship.type);
    expect(types).toContain("owns");
    expect(types).toContain("nested-inside");
    expect(types).toContain("declared-in");
    expect(types).toContain("defined-in");
    expect(types).toContain("exported-by");
    expect(types).toContain("imported-by");
    expect(types).toContain("re-exports");
  });

  it("emits exported-by only for exported symbols", () => {
    const graph = sampleGraph();
    const exportedBy = graph.relationships.filter(
      (relationship) => relationship.type === "exported-by",
    );
    expect(exportedBy).toHaveLength(1);
    expect(exportedBy[0]!.toId).toBe("c1");
    expect(exportedBy[0]!.toFile).toBe("src/index.ts");
  });

  it("resolves imports and re-exports to files when possible", () => {
    const graph = sampleGraph();
    const imported = graph.relationships.find(
      (relationship) => relationship.type === "imported-by",
    )!;
    expect(imported.module).toBe("./util");
    expect(imported.toFile).toBe("src/util.ts");
    const reExport = graph.relationships.find(
      (relationship) => relationship.type === "re-exports",
    )!;
    expect(reExport.names).toEqual(["foo"]);
    expect(reExport.toFile).toBe("src/util.ts");
  });

  it("leaves unresolved module specifiers raw", () => {
    const { symbols } = buildSymbols([
      input({ id: "m1", identifier: "src.index", file: "src/index.ts", imports: ["lodash"] }),
    ]);
    const graph = buildSymbolGraph(symbols);
    const imported = graph.relationships.find(
      (relationship) => relationship.type === "imported-by",
    )!;
    expect(imported.module).toBe("lodash");
    expect(imported.toFile).toBeUndefined();
  });

  it("indexes relationships by source and target", () => {
    const graph = sampleGraph();
    expect(graph.relationshipsBySource.get("m1")?.length).toBeGreaterThan(0);
    expect(graph.relationshipsByTarget.get("c1")?.length).toBeGreaterThan(0);
  });

  it("exposes imports and exports per file", () => {
    const graph = sampleGraph();
    expect(graph.importsOf("src/index.ts")).toEqual(["./util"]);
    expect(graph.exportsOf("src/index.ts")).toEqual(["Circle"]);
    expect(graph.importsOf("missing.ts")).toEqual([]);
  });

  it("skips synthetic roots with empty files", () => {
    const { symbols } = buildSymbols([
      input({ id: "p", identifier: "demo", file: "", kind: "project" }),
      input({ id: "m1", identifier: "src.index", file: "src/index.ts" }),
    ]);
    const graph = buildSymbolGraph(symbols);
    const declared = graph.relationships.filter(
      (relationship) => relationship.type === "declared-in",
    );
    expect(declared).toHaveLength(1);
  });
});

describe("isExportedSymbol", () => {
  it("reports the metadata exported flag", () => {
    const { symbols } = buildSymbols([
      input({ id: "a", kind: "function", identifier: "f", exported: true }),
      input({ id: "b", kind: "function", identifier: "g", exported: false }),
    ]);
    expect(isExportedSymbol(symbols[0]!)).toBe(true);
    expect(isExportedSymbol(symbols[1]!)).toBe(false);
  });
});
