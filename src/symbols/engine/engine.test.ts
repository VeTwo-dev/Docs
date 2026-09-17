import { describe, it, expect } from "vitest";
import { createSymbolEngine, type SymbolEngine } from "../index.js";
import { packageSymbolId, projectSymbolId } from "../shared/index.js";

const ROOT = "/project";

const A = `import { point } from "./point";
export const origin = point;
export function distance(x: number): number {
  return Math.abs(x);
}`;

const POINT = `export const point = { x: 0, y: 0 };
export class Point {
  x = 0;
  y = 0;
}`;

function request(overrides: Parameters<SymbolEngine["extract"]>[0] = {}) {
  return {
    rootDir: ROOT,
    files: ["src/a.ts", "src/point.ts"],
    contents: { "src/a.ts": A, "src/point.ts": POINT },
    projectName: "demo",
    ...overrides,
  };
}

describe("SymbolEngine", () => {
  it("extracts a project of packages, modules and declarations", async () => {
    const engine = createSymbolEngine();
    const result = await engine.extract(request());
    await engine.dispose();

    expect(result.requestId).toBeTypeOf("string");
    expect(result.projectName).toBe("demo");
    expect(result.languageIds).toEqual(["typescript"]);

    expect(result.project.kind).toBe("project");
    expect(result.project.name).toBe("demo");
    expect(result.project.id).toBe(projectSymbolId("demo"));

    expect(result.packages).toHaveLength(1);
    const pkg = result.packages[0]!;
    expect(pkg.name).toBe("demo");
    expect(pkg.id).toBe(packageSymbolId("demo", "demo"));
    expect(pkg.parentId).toBe(result.project.id);

    const ownsModule = result.relationships.some(
      (r) =>
        r.type === "owns" && r.fromId === pkg.id && result.modules.some((m) => m.id === r.toId),
    );
    expect(ownsModule).toBe(true);
    const ownsPackage = result.relationships.some(
      (r) => r.type === "owns" && r.fromId === result.project.id && r.toId === pkg.id,
    );
    expect(ownsPackage).toBe(true);

    expect(result.modules).toHaveLength(2);
    const aModule = result.modules.find((m) => m.metadata.location.file === "src/a.ts");
    expect(aModule?.imports).toEqual(["./point"]);
    expect(aModule?.parentId).toBe(pkg.id);

    expect(result.statistics.files).toBe(2);
    expect(result.statistics.extractedFiles).toBe(2);
    expect(result.statistics.cachedFiles).toBe(0);
    expect(result.statistics.symbolCount).toBeGreaterThan(4);
    expect(result.statistics.moduleCount).toBe(2);
    expect(result.statistics.packageCount).toBe(1);
    expect(result.statistics.diagnosticsCount).toBe(0);

    expect(result.extracts).toHaveLength(1);
    expect(result.extracts[0]!.languageId).toBe("typescript");

    const graph = result.graph;
    expect(graph.moduleOf("src/a.ts")?.name).toBe("src.a");
    const importEdge = result.relationships.find(
      (r) => r.type === "imported-by" && r.fromFile === "src/a.ts",
    );
    expect(importEdge?.toFile).toBe("src/point.ts");
  });

  it("resolves module exports to exported-by edges", async () => {
    const engine = createSymbolEngine();
    const result = await engine.extract(request());
    await engine.dispose();

    const pointModule = result.graph.moduleOf("src/point.ts")!;
    const exported = result.relationships.filter(
      (r) => r.type === "exported-by" && r.fromId === pointModule.id,
    );
    expect(exported).toHaveLength(2);
  });

  it("serves unchanged files from the incremental cache", async () => {
    const engine = createSymbolEngine();
    const first = await engine.extract(request());
    const second = await engine.extract(request());

    expect(second.statistics.extractedFiles).toBe(0);
    expect(second.statistics.cachedFiles).toBe(2);
    expect(second.modules.map((m) => m.id)).toEqual(first.modules.map((m) => m.id));
    expect(engine.getCached("src/a.ts")).toBeDefined();
    await engine.dispose();
  });

  it("re-extracts after invalidate or clearCache", async () => {
    const engine = createSymbolEngine();
    await engine.extract(request());
    engine.invalidate("src/a.ts");
    const partial = await engine.extract(request());
    expect(partial.statistics.cachedFiles).toBe(1);
    expect(partial.statistics.extractedFiles).toBe(1);
    engine.clearCache();
    const fresh = await engine.extract(request());
    expect(fresh.statistics.cachedFiles).toBe(0);
    await engine.dispose();
  });

  it("skips the cache when requested", async () => {
    const engine = createSymbolEngine();
    await engine.extract(request());
    const result = await engine.extract(request({ skipCache: true }));
    await engine.dispose();
    expect(result.statistics.extractedFiles).toBe(2);
    expect(result.statistics.cachedFiles).toBe(0);
  });

  it("caps symbols via maxSymbols", async () => {
    const engine = createSymbolEngine();
    const result = await engine.extract(request({ maxSymbols: 3 }));
    await engine.dispose();
    expect(result.diagnostics.some((d) => d.code === "unsupported-construct")).toBe(true);
  });

  it("handles mixed-language projects", async () => {
    const engine = createSymbolEngine();
    const result = await engine.extract(
      request({
        files: ["src/a.ts", "src/util.js"],
        contents: { "src/a.ts": "export const a = 1;", "src/util.js": "export const util = 2;" },
      }),
    );
    await engine.dispose();
    expect(result.languageIds).toEqual(["javascript", "typescript"]);
    expect(result.modules).toHaveLength(2);
    expect(result.statistics.diagnosticsCount).toBe(0);
  });

  it("maps files to named packages", async () => {
    const engine = createSymbolEngine();
    const result = await engine.extract(
      request({
        packageMapping: { "src/a.ts": "core", "src/point.ts": "geometry" },
        packageVersions: { geometry: "2.0.0" },
      }),
    );
    await engine.dispose();

    expect(result.packages.map((p) => p.name).sort()).toEqual(["core", "geometry"]);
    const geometry = result.packages.find((p) => p.name === "geometry")!;
    expect(geometry.version).toBe("2.0.0");
    const pointModule = result.modules.find((m) => m.metadata.location.file === "src/point.ts")!;
    expect(pointModule.metadata.packageName).toBe("geometry");
    expect(pointModule.parentId).toBe(geometry.id);
  });

  it("reports files without a registered language", async () => {
    const engine = createSymbolEngine();
    const result = await engine.extract(
      request({ files: ["src/a.xyz"], contents: { "src/a.xyz": "x" } }),
    );
    await engine.dispose();
    expect(result.modules).toHaveLength(0);
    expect(result.diagnostics.some((d) => d.code === "missing-extractor")).toBe(true);
  });

  it("reports extractor capabilities and refuses work after dispose", async () => {
    const engine = createSymbolEngine();
    expect(engine.capabilitiesOf("typescript")?.documents).toBe("tsdoc");
    expect(engine.capabilitiesOf("nope")).toBeUndefined();
    await engine.extract(request());
    engine.dispose();
    await expect(engine.extract(request())).rejects.toThrow(/disposed/);
  });
});
