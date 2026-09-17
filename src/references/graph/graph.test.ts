import { describe, it, expect } from "vitest";
import type { ModuleSymbol, Symbol, SymbolInput } from "../../symbols/index.js";
import { buildSymbols } from "../../symbols/index.js";
import type { ReferenceFileBindings } from "../models/index.js";
import { buildModuleScopes, type ModuleScopes } from "../scope/index.js";
import { buildReferenceGraph } from "./index.js";
import { buildOwnershipTree } from "../ownership/index.js";
import { DEFAULT_NAME, STAR_NAME } from "../shared/index.js";

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

function buildFixture(): {
  graph: ReturnType<typeof buildReferenceGraph>;
  scopes: ModuleScopes;
  symbols: Map<string, Symbol>;
} {
  const pointModule = sym({
    kind: "module",
    identifier: "point",
    id: "m:point",
    file: "src/point.ts",
    childrenIds: ["c:point", "c:Point", "c:NS", "c:default"],
    exports: ["point", "Point", "NS", "DefaultThing"],
  });
  const barModule = sym({
    kind: "module",
    identifier: "bar",
    id: "m:bar",
    file: "src/bar.ts",
    childrenIds: ["c:fromBar"],
    exports: ["fromBar"],
  });
  const aModule = sym({
    kind: "module",
    identifier: "a",
    id: "m:a",
    file: "src/a.ts",
    imports: ["./point"],
    reExports: [{ specifier: "./point", names: ["Point", "NS"] }, { specifier: "./bar" }],
    exports: ["origin", "fromOrigin"],
    childrenIds: ["c:origin", "c:circle", "c:alias", "c:ghost"],
  });

  const { store } = buildSymbols([
    pointModule,
    barModule,
    aModule,
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
      kind: "namespace",
      identifier: "NS",
      id: "c:NS",
      file: "src/point.ts",
      parentId: "m:point",
      exported: true,
      modifiers: ["export"],
      childrenIds: ["c:NS.Type"],
    }),
    sym({
      kind: "class",
      identifier: "Type",
      id: "c:NS.Type",
      file: "src/point.ts",
      parentId: "c:NS",
      exported: true,
      modifiers: ["export"],
    }),
    sym({
      kind: "class",
      identifier: "DefaultThing",
      id: "c:default",
      file: "src/point.ts",
      parentId: "m:point",
      exported: true,
      modifiers: ["export", "default"],
    }),
    sym({
      kind: "constant",
      identifier: "fromBar",
      id: "c:fromBar",
      file: "src/bar.ts",
      parentId: "m:bar",
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
      id: "c:circle",
      file: "src/a.ts",
      parentId: "m:a",
      exported: true,
      modifiers: ["export"],
      heritage: ["Point"],
    }),
    sym({
      kind: "type-alias",
      identifier: "Alias",
      id: "c:alias",
      file: "src/a.ts",
      parentId: "m:a",
      exported: true,
      modifiers: ["export"],
      typeName: "NS.Type",
    }),
    sym({
      kind: "type-alias",
      identifier: "Ghost",
      id: "c:ghost",
      file: "src/a.ts",
      parentId: "m:a",
      exported: true,
      modifiers: ["export"],
      typeName: "Missing.Nope",
    }),
  ]);

  const bindings = new Map<string, ReferenceFileBindings>([
    [
      "src/a.ts",
      {
        file: "src/a.ts",
        imports: [
          { specifier: "./point", localName: "point", importedName: "point" },
          { specifier: "./point", localName: "def", importedName: DEFAULT_NAME },
          { specifier: "./point", localName: "ns", importedName: STAR_NAME },
        ],
        exportAliases: [{ exportedName: "fromOrigin", localName: "origin" }],
        reExports: [],
      },
    ],
  ]);

  const resolveModule = (fromFile: string, specifier: string): string | undefined => {
    void fromFile;
    if (specifier === "./point") return "src/point.ts";
    if (specifier === "./bar") return "src/bar.ts";
    return undefined;
  };

  const modules = new Map<string, ModuleSymbol>();
  for (const symbol of store.values()) {
    if (symbol.kind === "module")
      modules.set(symbol.metadata.location.file, symbol as ModuleSymbol);
  }

  const scopes = buildModuleScopes({ symbols: store, modules, bindings, resolveModule });
  const ownership = buildOwnershipTree(store);
  const graph = buildReferenceGraph({ symbols: store, modules, scopes, resolveModule, ownership });
  return { graph, scopes, symbols: store };
}

describe("buildReferenceGraph", () => {
  it("builds import, import-name, export and re-export edges", () => {
    const { graph } = buildFixture();
    const fromA = graph.referencesOf("m:a");

    const imports = fromA.filter((r) => r.kind === "import");
    expect(imports).toHaveLength(1);
    expect(imports[0]?.toId).toBe("m:point");
    expect(imports[0]?.toFile).toBe("src/point.ts");

    const importNames = fromA.filter((r) => r.kind === "import-name");
    expect(importNames).toHaveLength(3);
    expect(importNames.map((r) => [r.name, r.toId])).toEqual(
      expect.arrayContaining([
        ["point", "c:point"],
        ["def", "c:default"],
        ["ns", "m:point"],
      ]),
    );

    const exports = fromA.filter((r) => r.kind === "export");
    expect(exports).toHaveLength(2);
    expect(exports.every((r) => r.toId === "c:origin")).toBe(true);

    const reExports = fromA.filter((r) => r.kind === "re-export");
    expect(reExports).toHaveLength(3);
    expect(reExports.map((r) => r.toId)).toEqual(
      expect.arrayContaining(["c:Point", "c:NS", "m:bar"]),
    );
  });

  it("builds heritage, extends, implements and type-use edges", () => {
    const { graph } = buildFixture();
    const circleRefs = graph.referencesOf("c:circle");
    const heritage = circleRefs.filter((r) => r.kind === "heritage");
    expect(heritage).toHaveLength(1);
    expect(heritage[0]?.toId).toBe("c:Point");

    const extendsRefs = circleRefs.filter((r) => r.kind === "extends");
    expect(extendsRefs).toHaveLength(1);
    expect(extendsRefs[0]?.toId).toBe("c:Point");

    const alias = graph.referencesOf("c:alias");
    expect(alias[0]?.kind).toBe("type-use");
    expect(alias[0]?.toId).toBe("c:NS.Type");

    const ghost = graph.referencesOf("c:ghost");
    expect(ghost[0]?.resolved).toBe(false);
    expect(graph.byTarget.get("c:Point")?.length).toBeGreaterThan(1);
  });

  it("indexes references by file and exposes dependency queries", () => {
    const { graph } = buildFixture();
    const inA = graph.byFile.get("src/a.ts");
    expect(inA?.filter((r) => r.kind === "import" || r.kind === "import-name")).toHaveLength(4);
    expect(inA?.filter((r) => r.kind === "ownership")).toHaveLength(4);
    expect(inA?.filter((r) => r.kind === "containment")).toHaveLength(4);
    expect(graph.dependenciesOf("src/a.ts")).toEqual(["src/bar.ts", "src/point.ts"]);
    expect(graph.dependentsOf("src/point.ts")).toEqual(["src/a.ts"]);
    expect(graph.dependentsOf("src/bar.ts")).toEqual(["src/a.ts"]);
    expect(graph.importsOf("src/a.ts")).toEqual(["./point"]);
    expect(graph.exportsOf("src/a.ts")).toEqual(["origin", "fromOrigin"]);
    expect(graph.dependenciesOf("src/point.ts")).toEqual([]);
    expect(graph.dependentsOf("src/a.ts")).toEqual([]);
  });

  it("exposes the find* query operations", () => {
    const { graph } = buildFixture();
    expect(graph.findOutgoingReferences("m:a").length).toBeGreaterThan(0);
    expect(graph.findIncomingReferences("c:Point").length).toBeGreaterThan(0);
    expect(graph.findReferences("m:a").length).toBeGreaterThan(0);
    expect(graph.findDependencies("m:a")).toEqual(["src/bar.ts", "src/point.ts"]);
    expect(graph.findDependents("m:point")).toEqual(["src/a.ts"]);
    expect(graph.findOwners("c:circle")).toContain("m:a");
    expect(graph.findInheritedSymbols("c:circle")).toContain("c:Point");
    expect(graph.findImplementations("c:Point")).toContain("c:circle");
  });

  it("produces deterministic ids", () => {
    const first = buildFixture();
    const second = buildFixture();
    expect(first.graph.references.map((r) => r.id)).toEqual(
      second.graph.references.map((r) => r.id),
    );
    expect(Object.isFrozen(first.graph.references)).toBe(true);
  });
});
