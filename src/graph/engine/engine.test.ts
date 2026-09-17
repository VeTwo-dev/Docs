import { describe, it, expect } from "vitest";
import type { SymbolExtractionResult } from "../../symbols/index.js";
import { createCompilerManager } from "../../compiler/index.js";
import { createSymbolEngine } from "../../symbols/index.js";
import { createReferenceEngine } from "../../references/index.js";
import { createGraphEngine, type GraphEngine } from "./index.js";
import { edgeOfKind } from "../filters/index.js";
import { collectNodes } from "../visitors/index.js";

const ROOT = "/project";

const A = `import { point } from "./point";
export const origin = point;`;

const POINT = `export const point = { x: 0, y: 0 };
export class Point {
  x = 0;
  y = 0;
}`;

const SHAPES = `import { Point } from "./point";
export class Circle extends Point {
  radius = 0;
}`;

const FILES = ["src/a.ts", "src/point.ts", "src/shapes.ts"] as const;
const CONTENTS = { "src/a.ts": A, "src/point.ts": POINT, "src/shapes.ts": SHAPES };

async function fixture(): Promise<{ extraction: SymbolExtractionResult; units: unknown[] }> {
  const compiler = createCompilerManager();
  const byLanguage = new Map<string, string[]>();
  for (const file of FILES) {
    const language = file.endsWith(".js") ? "javascript" : "typescript";
    byLanguage.set(language, [...(byLanguage.get(language) ?? []), file]);
  }
  const units = [];
  for (const [language, languageFiles] of byLanguage) {
    const result = await compiler.compile({
      rootDir: ROOT,
      files: languageFiles,
      contents: CONTENTS,
      requestId: `compile-${language}`,
    });
    units.push(...result.units);
  }
  await compiler.dispose();

  const symbols = createSymbolEngine();
  const extraction = await symbols.extract({
    rootDir: ROOT,
    files: [...FILES],
    contents: CONTENTS,
    projectName: "demo",
  });
  await symbols.dispose();
  return { extraction, units };
}

async function buildGraph(): Promise<{
  engine: GraphEngine;
  graph: ReturnType<GraphEngine["build"]>;
}> {
  const { extraction, units } = await fixture();
  const references = createReferenceEngine();
  const resolution = references.resolve({ rootDir: ROOT, extraction, units: units as never });
  references.dispose();

  const engine = createGraphEngine();
  const graph = engine.build({ rootDir: ROOT, extraction, resolution });
  return { engine, graph };
}

describe("GraphEngine", () => {
  it("unifies the symbol hierarchy and resolved references", async () => {
    const { graph } = await buildGraph();

    expect(graph.statistics.nodeCount).toBeGreaterThanOrEqual(3);
    expect(graph.statistics.edgeCount).toBeGreaterThanOrEqual(5);
    expect(graph.statistics.unresolvedReferenceCount).toBe(0);

    const aModule = [...graph.nodes.values()].find((node) => node.file === "src/a.ts");
    const pointModule = [...graph.nodes.values()].find((node) => node.file === "src/point.ts");
    const circle = [...graph.nodes.values()].find(
      (node) => node.label === "Circle" && node.file === "src/shapes.ts",
    );
    const point = [...graph.nodes.values()].find(
      (node) => node.label === "Point" && node.file === "src/point.ts",
    );
    expect(aModule?.kind).toBe("module");
    expect(pointModule?.kind).toBe("module");
    expect(circle?.kind).toBe("symbol");
    expect(circle?.symbolKind).toBe("class");
    expect(point?.symbolKind).toBe("class");

    const imports = graph.edges.filter((edge) => edge.kind === "imports");
    expect(imports).toHaveLength(2);
    const aImports = imports.filter((edge) => edge.from === aModule!.id);
    expect(aImports).toHaveLength(1);
    expect(aImports[0]?.to).toBe(pointModule!.id);

    const heritage = graph.edges.filter((edge) => edge.kind === "references");
    expect(heritage).toHaveLength(1);
    expect(heritage[0]?.from).toBe(circle!.id);
    expect(heritage[0]?.to).toBe(point!.id);

    const owns = graph.edges.filter((edge) => edge.kind === "owns");
    expect(owns.some((edge) => edge.from === pointModule!.id && edge.to === point!.id)).toBe(true);

    const shapesModule = [...graph.nodes.values()].find((node) => node.file === "src/shapes.ts");

    const declared = graph.edges.filter((edge) => edge.kind === "declared-in");
    expect(declared.some((edge) => edge.from === circle!.id && edge.to === shapesModule!.id)).toBe(
      true,
    );
  });

  it("exposes graph navigation", async () => {
    const { graph } = await buildGraph();
    const pointModule = [...graph.nodes.values()].find((node) => node.file === "src/point.ts")!;
    const aModule = [...graph.nodes.values()].find((node) => node.file === "src/a.ts")!;

    expect(collectNodes(graph, aModule.id, edgeOfKind("imports"))).toContain(pointModule.id);
    expect(graph.neighbors(aModule.id)).toContain(pointModule.id);
    expect(graph.statistics.nodeKinds["module"]).toBe(3);
    expect(graph.statistics.edgeKinds["imports"]).toBe(2);
  });

  it("memoizes identical build signatures and invalidates", async () => {
    const { extraction, units } = await fixture();
    const references = createReferenceEngine();
    const resolution = references.resolve({ rootDir: ROOT, extraction, units: units as never });
    references.dispose();

    const engine = createGraphEngine();
    const first = engine.build({ rootDir: ROOT, extraction, resolution });
    const second = engine.build({ rootDir: ROOT, extraction, resolution });
    expect(second).toBe(first);

    engine.invalidate();
    const third = engine.build({ rootDir: ROOT, extraction, resolution });
    expect(third).not.toBe(first);
    expect(third.statistics.cacheMisses).toBeGreaterThan(first.statistics.cacheMisses);

    engine.clearCache();
    expect(engine.build({ rootDir: ROOT, extraction, resolution }).statistics.cacheMisses).toBe(1);
  });

  it("builds a structural-only graph without a resolution", async () => {
    const { extraction, units } = await fixture();
    const engine = createGraphEngine();
    const graph = engine.build({ rootDir: ROOT, extraction });
    expect(graph.statistics.resolvedReferenceCount).toBe(0);
    expect(graph.statistics.edgeKinds["imports"]).toBeUndefined();
    expect(graph.statistics.edgeKinds["owns"]).toBeGreaterThan(0);
    void units;
  });

  it("registers built-ins by default and honours a custom registry", async () => {
    const engine = createGraphEngine();
    expect(engine.registry.resolve("structural")).toBeDefined();
    expect(engine.registry.resolve("references")).toBeDefined();

    const custom = createGraphEngine({ autoRegisterBuiltins: false });
    expect(custom.registry.size).toBe(0);
    custom.dispose();
  });

  it("throws after dispose", async () => {
    const engine = createGraphEngine();
    engine.dispose();
    expect(() => engine.build({ rootDir: ROOT, extraction: {} as SymbolExtractionResult })).toThrow(
      "GraphEngine has been disposed.",
    );
  });
});
