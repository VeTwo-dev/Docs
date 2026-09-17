import { describe, it, expect } from "vitest";
import type { buildReferenceGraph } from "../graph/index.js";
import { ofKind, resolved } from "../filters/index.js";
import { collectReferences, reachableCount, reachableSymbols, visitReferences } from "./index.js";

const P = { id: "p", metadata: { location: { file: "src/p.ts" } } } as const;
const Q = { id: "q", metadata: { location: { file: "src/q.ts" } } } as const;
const R = { id: "r", metadata: { location: { file: "src/r.ts" } } } as const;

const symbols = new Map([
  ["p", P],
  ["q", Q],
  ["r", R],
] as never);

const edges = [
  { id: "e1", kind: "import", fromId: "p", toId: "q", toFile: "src/q.ts", resolved: true },
  { id: "e2", kind: "import-name", fromId: "p", name: "x", toId: "q", resolved: true },
  { id: "e3", kind: "heritage", fromId: "q", name: "Base", toId: "r", resolved: true },
  { id: "e4", kind: "type-use", fromId: "p", name: "Missing", resolved: false },
];

function graph() {
  const references = edges.map((edge) => ({ ...edge, byFile: undefined }));
  return {
    references,
    symbols,
    modules: new Map(),
    bySource: new Map([
      ["p", references.slice(0, 2).concat(references.slice(3))],
      ["q", [references[2]]],
    ]),
    byTarget: new Map([
      ["q", [references[0], references[1]]],
      ["r", [references[2]]],
    ]),
    byFile: new Map(),
    findSymbol: () => undefined,
    moduleOf: () => undefined,
    referencesOf: (id: string) => [
      ...(new Map([
        ["p", references.slice(0, 2).concat(references.slice(3))],
        ["q", [references[2]]],
      ]).get(id) ?? []),
    ],
    referencedBy: () => [],
    importsOf: () => [],
    exportsOf: () => [],
    dependenciesOf: () => [],
    dependentsOf: () => [],
  } as ReturnType<typeof buildReferenceGraph>;
}

describe("reference visitors", () => {
  it("visits references in pre-order with depth", () => {
    const seen: Array<{ id: string; depth: number }> = [];
    visitReferences(graph(), "p", (reference, depth) => {
      seen.push({ id: reference.id, depth });
      if (reference.toId !== undefined) return false;
    });
    expect(seen.map((s) => s.id)).toEqual(["e1", "e2", "e4"]);
    expect(seen.map((s) => s.depth)).toEqual([0, 0, 0]);
  });

  it("follows resolved symbol edges to their targets", () => {
    const g = graph();
    const visited: string[] = [];
    visitReferences(g, "p", (reference) => {
      visited.push(reference.id);
    });
    expect(visited).toContain("e3");
    expect(visited.length).toBe(4);
  });

  it("prunes subtrees when the visitor returns false", () => {
    const pruned = {
      references: [edges[0], edges[2], edges[3]],
      symbols,
      modules: new Map(),
      bySource: new Map([
        ["p", [edges[0], edges[3]]],
        ["q", [edges[2]]],
      ]),
      byTarget: new Map(),
      byFile: new Map(),
      findSymbol: () => undefined,
      moduleOf: () => undefined,
      referencesOf: (id: string) =>
        id === "p" ? [edges[0]!, edges[3]!] : id === "q" ? [edges[2]!] : [],
      referencedBy: () => [],
      importsOf: () => [],
      exportsOf: () => [],
      dependenciesOf: () => [],
      dependentsOf: () => [],
    } as ReturnType<typeof buildReferenceGraph>;

    const visited: string[] = [];
    visitReferences(pruned, "p", (reference) => {
      visited.push(reference.id);
      if (reference.id === "e1") return false;
    });
    expect(visited).toEqual(["e1", "e4"]);
  });

  it("supports post-order traversal and filters", () => {
    const seen: string[] = [];
    visitReferences(
      graph(),
      "p",
      (reference) => {
        seen.push(reference.id);
      },
      { order: "post-order", filter: ofKind("import") },
    );
    expect(seen).toEqual(["e1"]);
  });

  it("collects references, symbols and counts", () => {
    const g = graph();
    expect(collectReferences(g, "p")).toHaveLength(4);
    expect(collectReferences(g, "p", resolved)).toHaveLength(3);
    expect(reachableSymbols(g, "p").sort()).toEqual(["p", "q", "r"]);
    expect(reachableCount(g, "p")).toBe(4);
  });
});
