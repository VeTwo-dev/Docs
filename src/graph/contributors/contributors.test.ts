import { describe, it, expect } from "vitest";
import type { SymbolInput } from "../../symbols/index.js";
import { buildSymbols } from "../../symbols/index.js";
import { createReference } from "../../references/index.js";
import { structuralContributor, referencesContributor } from "./index.js";
import type { GraphBuildContext } from "../contracts/index.js";

function sym(
  input: Partial<SymbolInput> & {
    kind: SymbolInput["kind"];
    identifier: string;
    id: string;
    file: string;
  },
): SymbolInput {
  return {
    qualifiedName: input.identifier,
    languageId: "typescript",
    compiler: { compilerId: "typescript", format: "typescript" },
    hash: `h:${input.id}`,
    modifiers: [],
    ...input,
  };
}

function buildContext(): GraphBuildContext {
  const { symbols } = buildSymbols([
    sym({ kind: "project", identifier: "demo", id: "prj:demo", file: "" }),
    sym({ kind: "package", identifier: "demo", id: "pkg:demo", file: "", parentId: "prj:demo" }),
    sym({
      kind: "module",
      identifier: "point",
      id: "m:point",
      file: "src/point.ts",
      parentId: "pkg:demo",
      childrenIds: ["c:point", "c:Point"],
      exports: ["point", "Point"],
    }),
    sym({
      kind: "module",
      identifier: "a",
      id: "m:a",
      file: "src/a.ts",
      parentId: "pkg:demo",
      imports: ["./point"],
      reExports: [{ specifier: "./point", names: ["Point"] }],
      childrenIds: ["c:origin", "c:Circle"],
    }),
    sym({
      kind: "constant",
      identifier: "point",
      id: "c:point",
      file: "src/point.ts",
      parentId: "m:point",
      exported: true,
      modifiers: ["export"],
    }),
    sym({
      kind: "class",
      identifier: "Point",
      id: "c:Point",
      file: "src/point.ts",
      parentId: "m:point",
      exported: true,
      modifiers: ["export"],
    }),
    sym({
      kind: "constant",
      identifier: "origin",
      id: "c:origin",
      file: "src/a.ts",
      parentId: "m:a",
      exported: true,
      modifiers: ["export"],
    }),
    sym({
      kind: "class",
      identifier: "Circle",
      id: "c:Circle",
      file: "src/a.ts",
      parentId: "m:a",
      exported: true,
      modifiers: ["export"],
      heritage: ["Point"],
    }),
  ]);

  const symbolsMap = new Map(symbols.map((symbol) => [symbol.id, symbol]));

  const references = [
    createReference(
      { kind: "import", fromId: "m:a", specifier: "./point", toId: "m:point" },
      "ref:import:m:a:::0",
    ),
    createReference(
      { kind: "import-name", fromId: "m:a", name: "point", specifier: "./point", toId: "c:point" },
      "ref:import-name:m:a:point:./point:1",
    ),
    createReference(
      { kind: "export", fromId: "m:point", name: "Point", toId: "c:Point" },
      "ref:export:m:point:Point::2",
    ),
    createReference(
      { kind: "re-export", fromId: "m:a", name: "Point", specifier: "./point", toId: "m:point" },
      "ref:re-export:m:a:Point:./point:3",
    ),
    createReference(
      { kind: "heritage", fromId: "c:Circle", name: "Point", toId: "c:Point" },
      "ref:heritage:c:Circle:Point::4",
    ),
    createReference({ kind: "import", fromId: "m:a", specifier: "./ghost" }, "ref:import:m:a:::5"),
  ];

  const moduleMap = new Map<string, (typeof symbols)[number]>();
  for (const symbol of symbols) {
    if (symbol.kind === "module") {
      moduleMap.set(symbol.metadata.location.file, symbol);
    }
  }

  return {
    rootDir: "/project",
    symbols: symbolsMap,
    modules: moduleMap as unknown as GraphBuildContext["modules"],
    references,
  };
}

describe("structuralContributor", () => {
  it("adds one node per symbol with the right knowledge kinds", () => {
    const { nodes } = structuralContributor.contributes(buildContext());
    const byId = new Map(nodes.map((node) => [node.id, node]));

    expect(byId.get("prj:demo")?.kind).toBe("project");
    expect(byId.get("pkg:demo")?.kind).toBe("package");
    expect(byId.get("m:point")?.kind).toBe("module");
    expect(byId.get("m:point")?.file).toBe("src/point.ts");
    expect(byId.get("c:Point")?.kind).toBe("symbol");
    expect(byId.get("c:Point")?.symbolKind).toBe("class");
    expect(byId.get("c:Point")?.detail).toBe("Point");
    expect(nodes).toHaveLength(8);
  });

  it("adds owns and declared-in edges", () => {
    const { edges } = structuralContributor.contributes(buildContext());
    const kinds = (from: string, to: string) =>
      edges.filter((edge) => edge.from === from && edge.to === to).map((edge) => edge.kind);

    expect(kinds("prj:demo", "pkg:demo")).toEqual(["owns"]);
    expect(kinds("pkg:demo", "m:point")).toEqual(["owns"]);
    expect(kinds("m:point", "c:Point")).toEqual(["owns"]);
    expect(kinds("c:Point", "m:point")).toEqual(["declared-in"]);
    expect(kinds("c:origin", "m:a")).toEqual(["declared-in"]);
    expect(edges).toHaveLength(11);
  });
});

describe("referencesContributor", () => {
  it("maps resolved references onto knowledge edges", () => {
    const { edges } = referencesContributor.contributes(buildContext());
    const byKind = new Map<string, (typeof edges)[number][]>();
    for (const edge of edges) {
      byKind.set(edge.kind, [...(byKind.get(edge.kind) ?? []), edge]);
    }

    expect(byKind.get("imports")?.map((edge) => [edge.from, edge.to])).toEqual([
      ["m:a", "m:point"],
    ]);
    expect(byKind.get("imports-name")?.[0]).toMatchObject({
      from: "m:a",
      to: "c:point",
      label: "point",
    });
    expect(byKind.get("exports")?.[0]).toMatchObject({
      from: "m:point",
      to: "c:Point",
      label: "Point",
    });
    expect(byKind.get("re-exports")?.[0]).toMatchObject({
      from: "m:a",
      to: "m:point",
      label: "Point",
    });
    expect(byKind.get("references")?.[0]).toMatchObject({
      from: "c:Circle",
      to: "c:Point",
      label: "Point",
    });
    expect(byKind.get("references")?.[0]?.referenceId).toBe("ref:heritage:c:Circle:Point::4");
  });

  it("drops unresolved references", () => {
    const { edges } = referencesContributor.contributes(buildContext());
    expect(edges.some((edge) => edge.label === "./ghost")).toBe(false);
    expect(edges).toHaveLength(5);
  });

  it("deduplicates repeated references between the same pair", () => {
    const context = buildContext();
    const duplicate = createReference(
      { kind: "import-name", fromId: "m:a", name: "point", specifier: "./point", toId: "c:point" },
      "ref:import-name:m:a:point:./point:99",
    );
    const { edges } = referencesContributor.contributes({
      ...context,
      references: [...context.references, duplicate],
    });
    expect(edges.filter((edge) => edge.kind === "imports-name")).toHaveLength(1);
  });
});
