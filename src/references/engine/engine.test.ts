import { describe, it, expect } from "vitest";
import { createCompilerManager } from "../../compiler/index.js";
import { createSymbolEngine } from "../../symbols/index.js";
import { createReferenceEngine, type ReferenceEngine } from "./index.js";

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
}
export type Named = Point;`;

const SHAPES = `import { Point } from "./point";
export class Circle extends Point {
  radius = 0;
}`;

const UTIL_JS = `export const util = 2;
export { util as default };`;

const FILES = ["src/a.ts", "src/point.ts", "src/shapes.ts"] as const;
const CONTENTS = { "src/a.ts": A, "src/point.ts": POINT, "src/shapes.ts": SHAPES };

async function fixture(
  files: readonly string[] = FILES as unknown as string[],
  contents: Readonly<Record<string, string>> = CONTENTS,
) {
  const compiler = createCompilerManager();
  const byLanguage = new Map<string, string[]>();
  for (const file of files) {
    const language = file.endsWith(".js") ? "javascript" : "typescript";
    byLanguage.set(language, [...(byLanguage.get(language) ?? []), file]);
  }
  const units = [];
  for (const [language, languageFiles] of byLanguage) {
    const result = await compiler.compile({
      rootDir: ROOT,
      files: languageFiles,
      contents,
      requestId: `compile-${language}`,
    });
    units.push(...result.units);
  }
  await compiler.dispose();

  const symbols = createSymbolEngine();
  const extraction = await symbols.extract({
    rootDir: ROOT,
    files: [...files],
    contents,
    projectName: "demo",
  });
  await symbols.dispose();
  return { extraction, units };
}

async function resolve(
  overrides: { files?: readonly string[]; contents?: Readonly<Record<string, string>> } = {},
): Promise<{ engine: ReferenceEngine; result: ReturnType<ReferenceEngine["resolve"]> }> {
  const { extraction, units } = await fixture(overrides.files, overrides.contents);
  const engine = createReferenceEngine();
  const result = engine.resolve({ rootDir: ROOT, extraction, units });
  return { engine, result };
}

describe("ReferenceEngine", () => {
  it("resolves imports, exports, heritage and type aliases", async () => {
    const { engine, result } = await resolve();
    await engine.dispose();

    expect(result.projectName).toBe("demo");
    expect(result.requestId).toMatch(/^reference-/);
    expect(result.statistics.moduleCount).toBe(3);
    expect(result.statistics.symbolCount).toBeGreaterThan(3);

    const moduleA = result.graph.moduleOf("src/a.ts")!;
    const imports = result.graph.referencesOf(moduleA.id).filter((r) => r.kind === "import");
    expect(imports[0]?.toFile).toBe("src/point.ts");

    const importNames = result.graph
      .referencesOf(moduleA.id)
      .filter((r) => r.kind === "import-name");
    expect(importNames).toHaveLength(1);
    expect(importNames[0]?.name).toBe("point");
    expect(importNames[0]?.resolved).toBe(true);

    const exports = result.graph.referencesOf(moduleA.id).filter((r) => r.kind === "export");
    expect(exports).toHaveLength(2);
    expect(exports.every((r) => r.resolved)).toBe(true);

    const heritage = result.references.find((r) => r.kind === "heritage");
    expect(heritage?.name).toBe("Point");
    expect(heritage?.resolved).toBe(true);
    const heritageTarget = result.graph.findSymbol(heritage!.toId!);
    expect(heritageTarget?.name).toBe("Point");

    expect(result.statistics.unresolvedCount).toBe(0);
    expect(result.statistics.resolvedCount).toBe(result.statistics.referenceCount);
    expect(result.statistics.files).toBe(3);
  });

  it("serves unchanged files from the incremental binding cache", async () => {
    const { extraction, units } = await fixture();
    const engine = createReferenceEngine();
    const first = engine.resolve({ rootDir: ROOT, extraction, units });
    const second = engine.resolve({ rootDir: ROOT, extraction, units });

    expect(first.statistics.extractedFiles).toBe(3);
    expect(first.statistics.cachedFiles).toBe(0);
    expect(second.statistics.extractedFiles).toBe(0);
    expect(second.statistics.cachedFiles).toBe(3);
    expect(second.references.map((r) => r.id)).toEqual(first.references.map((r) => r.id));
    expect(engine.getCached("src/a.ts")?.imports).toHaveLength(1);
    await engine.dispose();
  });

  it("re-extracts after invalidate or clearCache", async () => {
    const { extraction, units } = await fixture();
    const engine = createReferenceEngine();
    await engine.resolve({ rootDir: ROOT, extraction, units });
    engine.invalidate("src/a.ts");
    const partial = engine.resolve({ rootDir: ROOT, extraction, units });
    expect(partial.statistics.extractedFiles).toBe(1);
    expect(partial.statistics.cachedFiles).toBe(2);
    engine.clearCache();
    const fresh = engine.resolve({ rootDir: ROOT, extraction, units });
    expect(fresh.statistics.extractedFiles).toBe(3);
    await engine.dispose();
  });

  it("skips the cache when requested", async () => {
    const { extraction, units } = await fixture();
    const engine = createReferenceEngine();
    engine.resolve({ rootDir: ROOT, extraction, units });
    const result = engine.resolve({ rootDir: ROOT, extraction, units, skipCache: true });
    expect(result.statistics.extractedFiles).toBe(3);
    expect(result.statistics.cachedFiles).toBe(0);
    await engine.dispose();
  });

  it("falls back to module-level resolution without units", async () => {
    const { extraction } = await fixture();
    const engine = createReferenceEngine();
    const result = engine.resolve({ rootDir: ROOT, extraction });
    expect(result.references.some((r) => r.kind === "import" && r.resolved)).toBe(true);
    expect(result.references.filter((r) => r.kind === "import-name")).toHaveLength(0);
    expect(result.resolutions[0]?.extractedFiles).toBe(0);
    await engine.dispose();
  });

  it("honours a caller-supplied request id", async () => {
    const { engine, result } = await resolve();
    await engine.dispose();
    const engine2 = createReferenceEngine();
    const { extraction, units } = await fixture();
    const withId = engine2.resolve({ rootDir: ROOT, extraction, units, requestId: "custom" });
    expect(withId.requestId).toBe("custom");
    expect(result.requestId).not.toBe("custom");
    await engine2.dispose();
  });

  it("handles mixed-language projects through per-language resolutions", async () => {
    const { engine, result } = await resolve({
      files: ["src/a.ts", "src/point.ts", "src/util.js"],
      contents: { "src/a.ts": A, "src/point.ts": POINT, "src/util.js": UTIL_JS },
    });
    await engine.dispose();
    expect(result.resolutions.map((r) => r.languageId).sort()).toEqual([
      "javascript",
      "typescript",
    ]);
    expect(result.resolutions.find((r) => r.languageId === "javascript")?.bindings).toBeGreaterThan(
      0,
    );
  });

  it("reports missing resolvers when built-ins are disabled", async () => {
    const { extraction, units } = await fixture();
    const engine = createReferenceEngine({ autoRegisterBuiltins: false });
    const result = engine.resolve({ rootDir: ROOT, extraction, units });
    expect(result.resolutions).toHaveLength(0);
    expect(result.diagnostics.some((d) => d.code === "missing-resolver")).toBe(true);
    await engine.dispose();
  });

  it("reports capabilities and refuses work after dispose", async () => {
    const engine = createReferenceEngine();
    expect(engine.capabilitiesOf("typescript")?.["import-bindings"]).toBe("full");
    expect(engine.capabilitiesOf("ruby")).toBeUndefined();
    engine.dispose();
    const { extraction, units } = await fixture();
    expect(() => engine.resolve({ rootDir: ROOT, extraction, units })).toThrow(/disposed/);
  });

  it("produces statistics consistent across summaries and totals", async () => {
    const { extraction, units } = await fixture();
    const engine = createReferenceEngine();
    const result = engine.resolve({ rootDir: ROOT, extraction, units });
    const { statistics } = result;
    const perLanguageFiles = result.resolutions.reduce((sum, r) => sum + r.files, 0);
    expect(perLanguageFiles).toBe(statistics.files);
    const bindings = result.resolutions.reduce((sum, r) => sum + r.bindings, 0);
    expect(bindings).toBeGreaterThan(0);
    const perLanguageRefs = result.resolutions.reduce((sum, r) => sum + r.references, 0);
    // Project/package root ownership edges have no source file and no language.
    const fileAttributedRefs = result.references.filter((r) => {
      const symbol = result.graph.symbols.get(r.fromId);
      return symbol !== undefined && symbol.metadata.location.file.length > 0;
    }).length;
    expect(perLanguageRefs).toBe(fileAttributedRefs);
    await engine.dispose();
  });
});
