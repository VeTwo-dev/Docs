import { describe, it, expect } from "vitest";
import { generateApiPages } from "../page-generator.js";
import { buildApiGraph } from "../graph.js";
import type { ApiSymbol } from "../models.js";
import type { DocumentationArchitecture } from "../../documentation/compiler/types.js";

function makeSymbol(overrides: Partial<ApiSymbol> & { id: string; name: string }): ApiSymbol {
  return {
    qualifiedName: overrides.name,
    kind: "function",
    documentation: {
      summary: `Description of ${overrides.name}`,
      params: [],
      examples: [],
      throws: [],
      see: [],
      links: [],
      tags: {},
      raw: "",
    },
    sourceFile: "src/index.ts",
    line: 1,
    column: 1,
    exported: true,
    deprecated: false,
    boundary: "public",
    ...overrides,
  };
}

function makeArchitecture(symbols: string[]): DocumentationArchitecture {
  return {
    schemaVersion: 1,
    project: { name: "test", archetypes: ["library"], personas: [{ persona: "api-consumer", priority: 1 }] },
    sections: [{ id: "api-reference", title: "API Reference", kinds: ["api", "reference"], rationale: "APIs exist", pages: ["api"] }],
    pages: [{
      slug: "api",
      title: "API Reference",
      sectionId: "api-reference",
      kinds: ["api", "reference"],
      summary: "Complete API reference.",
      symbols,
      evidence: symbols.map((s) => ({ kind: "symbol" as const, value: s })),
      importance: 0.9,
      depth: "deep",
    }],
    relationships: [],
    navigation: {
      sidebar: [{ label: "API Reference", slug: "api" }],
      primaryJourney: ["api"],
      secondaryJourneys: {},
      breadcrumbs: { api: [{ label: "API Reference" }] },
    },
    learningPaths: [],
    coverage: { areas: [], score: 1 },
  };
}

describe("generateApiPages", () => {
  it("generates IR pages for API symbols", () => {
    const symbols: ApiSymbol[] = [
      makeSymbol({ id: "fn1", name: "createUser", kind: "function", returnType: "Promise<User>", parameters: [
        { name: "name", type: "string", description: "The name", required: true, rest: false },
        { name: "email", type: "string", description: "The email", required: true, rest: false },
      ]}),
      makeSymbol({ id: "fn2", name: "searchUsers", kind: "function", returnType: "User[]", parameters: [
        { name: "query", type: "string", description: "Search query", required: true, rest: false },
        { name: "limit", type: "number", description: "Max results", required: false, rest: false, defaultValue: "10" },
      ]}),
    ];
    const graph = buildApiGraph(symbols);
    const architecture = makeArchitecture(["createUser", "searchUsers"]);

    const pages = generateApiPages(architecture, symbols, graph);

    expect(pages).toHaveLength(1);
    expect(pages[0].slug).toBe("api");
    expect(pages[0].title).toBe("API Reference");

    // Should have rich blocks (not just a bullet list)
    const customBlocks = pages[0].blocks.filter((b) => b.kind === "custom");
    expect(customBlocks.length).toBeGreaterThan(0);

    // Should have ApiSignature blocks
    const signatureBlocks = customBlocks.filter(
      (b) => b.kind === "custom" && (b as { component?: string }).component === "ApiSignature",
    );
    expect(signatureBlocks).toHaveLength(2);
  });

  it("includes parameter tables for functions", () => {
    const symbols: ApiSymbol[] = [
      makeSymbol({ id: "fn1", name: "createUser", kind: "function", parameters: [
        { name: "name", type: "string", description: "The name", required: true, rest: false },
      ]}),
    ];
    const graph = buildApiGraph(symbols);
    const architecture = makeArchitecture(["createUser"]);

    const pages = generateApiPages(architecture, symbols, graph);
    const paramTables = pages[0].blocks.filter(
      (b) => b.kind === "custom" && (b as { component?: string }).component === "ParameterTable",
    );
    expect(paramTables).toHaveLength(1);
  });

  it("includes heritage displays for classes", () => {
    const symbols: ApiSymbol[] = [
      makeSymbol({
        id: "cls1",
        name: "Child",
        kind: "class",
        extends: "Base",
        implements: ["IFoo"],
        members: [],
      }),
    ];
    const graph = buildApiGraph(symbols);
    const architecture = makeArchitecture(["Child"]);

    const pages = generateApiPages(architecture, symbols, graph);
    const heritageBlocks = pages[0].blocks.filter(
      (b) => b.kind === "custom" && (b as { component?: string }).component === "HeritageDisplay",
    );
    expect(heritageBlocks).toHaveLength(1);
  });

  it("generates enum tables", () => {
    const symbols: ApiSymbol[] = [
      makeSymbol({
        id: "enum1",
        name: "HttpMethod",
        kind: "enum",
        enumMembers: [
          { name: "GET", value: "GET", description: "" },
          { name: "POST", value: "POST", description: "" },
        ],
      }),
    ];
    const graph = buildApiGraph(symbols);
    const architecture = makeArchitecture(["HttpMethod"]);

    const pages = generateApiPages(architecture, symbols, graph);
    const tables = pages[0].blocks.filter((b) => b.kind === "table");
    expect(tables.length).toBeGreaterThan(0);
  });

  it("skips unknown symbols gracefully", () => {
    const symbols: ApiSymbol[] = [];
    const graph = buildApiGraph(symbols);
    const architecture = makeArchitecture(["unknownSymbol"]);

    const pages = generateApiPages(architecture, symbols, graph);
    expect(pages).toHaveLength(1);
    // Should only have heading and summary, no rich blocks
    const customBlocks = pages[0].blocks.filter((b) => b.kind === "custom");
    expect(customBlocks).toHaveLength(0);
  });
});
