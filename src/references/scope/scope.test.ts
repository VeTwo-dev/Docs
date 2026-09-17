import { describe, it, expect } from "vitest";
import type { ModuleSymbol, Symbol, SymbolInput } from "../../symbols/index.js";
import { buildSymbols } from "../../symbols/index.js";
import type { ReferenceFileBindings } from "../models/index.js";
import { buildModuleScopes, type ModuleScopes } from "./index.js";
import { DEFAULT_NAME, STAR_NAME } from "../shared/index.js";

interface Fixture {
  scopes: ModuleScopes;
  modules: Map<string, ModuleSymbol>;
  symbols: Map<string, Symbol>;
}

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

function buildFixture(): Fixture {
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

  const { store, symbols } = buildSymbols([
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
    ["src/point.ts", { file: "src/point.ts", imports: [], exportAliases: [], reExports: [] }],
    ["src/bar.ts", { file: "src/bar.ts", imports: [], exportAliases: [], reExports: [] }],
  ]);

  const resolveModule = (fromFile: string, specifier: string): string | undefined => {
    if (specifier === "./point") return "src/point.ts";
    if (specifier === "./bar") return "src/bar.ts";
    void fromFile;
    return undefined;
  };

  const modules = new Map<string, ModuleSymbol>();
  for (const symbol of symbols) {
    if (symbol.kind === "module")
      modules.set(symbol.metadata.location.file, symbol as ModuleSymbol);
  }

  const scopes = buildModuleScopes({ symbols: store, modules, bindings, resolveModule });
  return { scopes, modules, symbols: store };
}

function expectIds(ids: readonly string[], expected: string[]): void {
  expect([...ids].sort()).toEqual([...expected].sort());
}

describe("buildModuleScopes", () => {
  it("exposes module scopes with children, exports and defaults", () => {
    const { scopes } = buildFixture();
    const scope = scopes.scopeOf("m:a");
    expect(scope?.file).toBe("src/a.ts");
    expect(scope?.languageId).toBe("typescript");
    expect(scopes.moduleOf("src/point.ts")?.name).toBe("point");
    expect(scopes.moduleOf("missing.ts")).toBeUndefined();
    expect(scopes.scopeOf("nope")).toBeUndefined();

    const point = scopes.scopeOf("m:point")!;
    expect(point.defaultIds).toEqual(["c:default"]);
    expect([...point.exportedChildren.get("Point")!]).toEqual(["c:Point"]);
  });

  it("resolves imported names through bindings", () => {
    const { scopes } = buildFixture();
    expectIds(scopes.resolveName("m:a", "point"), ["c:point"]);
    expectIds(scopes.resolveName("m:a", "def"), ["c:default"]);
    expectIds(scopes.resolveName("m:a", "ns"), ["m:point"]);
    expectIds(scopes.resolveName("m:a", "unknown"), []);
  });

  it("resolves local and aliased exports", () => {
    const { scopes } = buildFixture();
    expectIds(scopes.resolveName("m:a", "origin"), ["c:origin"]);
    expectIds(scopes.resolveName("m:a", "fromOrigin"), ["c:origin"]);
    expectIds(scopes.resolveImported("m:a", "fromOrigin"), ["c:origin"]);
  });

  it("resolves named re-exports through the target module", () => {
    const { scopes } = buildFixture();
    expectIds(scopes.resolveName("m:a", "Point"), ["c:Point"]);
    expectIds(scopes.resolveImported("m:a", "Point"), ["c:Point"]);
    expectIds(scopes.resolveName("m:a", "NS"), ["c:NS"]);
    expectIds(scopes.resolveImported("m:point", "point"), ["c:point"]);
  });

  it("resolves star re-exports transitively", () => {
    const { scopes } = buildFixture();
    expectIds(scopes.resolveName("m:a", "fromBar"), ["c:fromBar"]);
    expectIds(scopes.resolveImported("m:a", "fromBar"), ["c:fromBar"]);
  });

  it("resolves default and namespace imports", () => {
    const { scopes } = buildFixture();
    expectIds(scopes.resolveImport("m:point", DEFAULT_NAME), ["c:default"]);
    expectIds(scopes.resolveImport("m:point", STAR_NAME), ["m:point"]);
    expectIds(scopes.resolveImport("m:point", "point"), ["c:point"]);
  });

  it("resolves dotted names through namespace children", () => {
    const { scopes } = buildFixture();
    expectIds(scopes.resolveDotted("m:a", "NS.Type"), ["c:NS.Type"]);
    expectIds(scopes.resolveDotted("m:point", "NS.Type"), ["c:NS.Type"]);
    expectIds(scopes.resolveDotted("m:point", "NS"), ["c:NS"]);
    expectIds(scopes.resolveDotted("m:a", "Missing.Nope"), []);
  });

  it("guards against re-export cycles", () => {
    const aModule = sym({
      kind: "module",
      identifier: "a",
      id: "m:a",
      file: "src/a.ts",
      reExports: [{ specifier: "./b" }],
    });
    const bModule = sym({
      kind: "module",
      identifier: "b",
      id: "m:b",
      file: "src/b.ts",
      reExports: [{ specifier: "./a" }],
    });
    const { store } = buildSymbols([aModule, bModule]);
    const modules = new Map<string, ModuleSymbol>([
      ["src/a.ts", store.get("m:a") as ModuleSymbol],
      ["src/b.ts", store.get("m:b") as ModuleSymbol],
    ]);
    const resolveModule = (fromFile: string, specifier: string) =>
      specifier === "./b"
        ? "src/b.ts"
        : specifier === "./a"
          ? "src/a.ts"
          : (void fromFile, undefined);
    const scopes = buildModuleScopes({
      symbols: store,
      modules,
      bindings: new Map(),
      resolveModule,
    });
    expectIds(scopes.resolveName("m:a", "anything"), []);
  });
});
