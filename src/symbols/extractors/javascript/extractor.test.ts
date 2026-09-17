import { describe, it, expect } from "vitest";
import { createCompilerManager } from "../../../compiler/index.js";
import type { SymbolExtractionInput } from "../../contracts/input.js";
import type { Symbol } from "../../models/index.js";
import { javascriptExtractor } from "../index.js";

const ROOT = "/project";

async function inputFor(
  files: readonly string[],
  contents: Readonly<Record<string, string>>,
): Promise<SymbolExtractionInput> {
  const manager = createCompilerManager();
  const result = await manager.compile({
    rootDir: ROOT,
    files,
    contents,
    languageId: "javascript",
    requestId: "r1",
  });
  await manager.dispose();
  return {
    rootDir: ROOT,
    requestId: "r1",
    languageId: "javascript",
    extractorId: "javascript",
    projectName: "demo",
    units: result.units,
    fileToPackage: Object.fromEntries(files.map((file) => [file, "demo"])),
  };
}

function find(symbols: readonly Symbol[], name: string, kind?: Symbol["kind"]): Symbol {
  const match = symbols.find(
    (symbol) => symbol.name === name && (kind === undefined || symbol.kind === kind),
  );
  if (match === undefined) throw new Error(`symbol "${name}" not found`);
  return match;
}

const SOURCE = `
import b from "./b";

export const PI = 3.14;

export function area(radius) {
  return radius * radius;
}

export class Circle {
  radius = 1;
  area() {
    return this.radius * this.radius;
  }
  get diameter() {
    return this.radius * 2;
  }
}

const secret = "hidden";
export { secret as publicSecret };
`;

describe("javascriptExtractor", () => {
  it("extracts a module with its imports, exports and members", async () => {
    const input = await inputFor(["src/shapes.js"], { "src/shapes.js": SOURCE });
    const output = javascriptExtractor.extract(input);
    expect(output.extractorId).toBe("javascript");
    expect(output.modules).toHaveLength(1);
    expect(output.extractedFiles).toEqual(["src/shapes.js"]);

    const module = output.modules[0]!;
    expect(module.kind).toBe("module");
    expect(module.name).toBe("src.shapes");
    expect(module.imports).toEqual(["./b"]);
    expect(module.exports).toEqual(["Circle", "PI", "area", "publicSecret", "secret"]);
  });

  it("builds class members as children", async () => {
    const input = await inputFor(["src/shapes.js"], { "src/shapes.js": SOURCE });
    const { symbols } = javascriptExtractor.extract(input);

    const circle = find(symbols, "Circle", "class");
    expect(circle.metadata.exported).toBe(true);
    const radius = find(symbols, "radius", "property");
    expect(radius.parentId).toBe(circle.id);
    const area = find(symbols, "area", "method");
    expect(area.parentId).toBe(circle.id);
    const diameter = find(symbols, "diameter", "method");
    expect(diameter.parentId).toBe(circle.id);
  });

  it("treats plain variable declarations, ignoring assignment statements", async () => {
    const input = await inputFor(["src/vars.js"], {
      "src/vars.js": `
          export const total = 1;
          let counter = 0;
          counter = 1;
        `,
    });
    const { symbols, modules } = javascriptExtractor.extract(input);
    const module = modules[0]!;
    const names = module.childrenIds.map((id) => symbols.find((s) => s.id === id)?.name).sort();
    expect(names).toEqual(["counter", "total"]);
  });

  it("extracts multiple units in one pass", async () => {
    const input = await inputFor(["src/a.js", "src/b.js"], {
      "src/a.js": 'import b from "./b";\nexport const a = b;',
      "src/b.js": "export const b = 1;",
    });
    const output = javascriptExtractor.extract(input);
    expect(output.modules).toHaveLength(2);
    expect(output.modules.map((module) => module.name).sort()).toEqual(["src.a", "src.b"]);
  });
});
