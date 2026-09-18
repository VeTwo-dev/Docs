import { describe, it, expect } from "vitest";
import { createCompilerManager } from "../../../compiler/index.js";
import type { SymbolExtractionInput } from "../../contracts/input.js";
import type { Symbol } from "../../models/index.js";
import { typescriptExtractor } from "../index.js";

const ROOT = "/project";

function inputFor(files: readonly string[]): SymbolExtractionInput {
  return {
    rootDir: ROOT,
    requestId: "r1",
    languageId: "typescript",
    extractorId: "typescript",
    projectName: "demo",
    units: [],
    fileToPackage: Object.fromEntries(files.map((file) => [file, "demo"])),
  };
}

async function compile(
  files: readonly string[],
  contents: Readonly<Record<string, string>>,
): Promise<ReturnType<typeof inputFor> & { units: NonNullable<SymbolExtractionInput["units"]> }> {
  const manager = createCompilerManager();
  const result = await manager.compile({
    rootDir: ROOT,
    files,
    contents,
    languageId: "typescript",
    requestId: "r1",
  });
  await manager.dispose();
  return { ...inputFor(files), units: result.units };
}

function find(symbols: readonly Symbol[], name: string, kind?: Symbol["kind"]): Symbol {
  const match = symbols.find(
    (symbol) => symbol.name === name && (kind === undefined || symbol.kind === kind),
  );
  if (match === undefined) throw new Error(`symbol "${name}" not found`);
  return match;
}

const SOURCE = `
import { Point } from "./point";

export const PI = 3.14;

export function area(radius: number): number {
  return PI * radius * radius;
}

export class Circle extends Point {
  radius: number;
  constructor(radius: number) {
    super();
    this.radius = radius;
  }
  get diameter(): number {
    return this.radius * 2;
  }
  set diameter(value: number) {
    this.radius = value / 2;
  }
  scale(factor: number): Circle {
    return new Circle(this.radius * factor);
  }
}

export enum Color {
  Red,
  Green,
  Blue,
}

const secret = "hidden";
export { secret as publicSecret };
`;

describe("typescriptExtractor", () => {
  it("extracts a module with its exports, imports and re-exports", async () => {
    const input = await compile(["src/shapes.ts"], { "src/shapes.ts": SOURCE });
    const output = typescriptExtractor.extract(input);
    expect(output.extractorId).toBe("typescript");
    expect(output.modules).toHaveLength(1);
    expect(output.extractedFiles).toEqual(["src/shapes.ts"]);

    const module = output.modules[0]!;
    expect(module.kind).toBe("module");
    expect(module.name).toBe("src.shapes");
    expect(module.metadata.packageName).toBe("demo");
    expect(module.metadata.qualifiedName).toBe("demo.src.shapes");
    expect(module.imports).toEqual(["./point"]);
    expect(module.exports).toEqual(["Circle", "Color", "PI", "area", "publicSecret", "secret"]);
  });

  it("builds declarations with kind-specific payloads", async () => {
    const input = await compile(["src/shapes.ts"], { "src/shapes.ts": SOURCE });
    const { symbols } = typescriptExtractor.extract(input);

    const circle = find(symbols, "Circle", "class");
    expect(circle.heritage).toEqual(["Point"]);
    expect(circle.metadata.exported).toBe(true);
    const radius = find(symbols, "radius", "property");
    expect(radius.parentId).toBe(circle.id);
    const scale = find(symbols, "scale", "method");
    expect(scale.parameterCount).toBe(1);
    expect(scale.signatures).toEqual(["(factor)"]);
    expect(scale.parentId).toBe(circle.id);

    const diameter = find(symbols, "diameter", "getter");
    expect(diameter.kind).toBe("getter");

    const pi = find(symbols, "PI", "constant");
    expect(pi.metadata.exported).toBe(true);

    const area = find(symbols, "area", "function");
    expect(area.parameterCount).toBe(1);
    expect(area.metadata.exported).toBe(true);

    const color = find(symbols, "Color", "enum");
    expect(color.enumMembers).toEqual(["Red", "Green", "Blue"]);

    const secret = find(symbols, "secret", "constant");
    expect(secret.metadata.exported).toBe(true);
  });

  it("maps container children to module roots", async () => {
    const input = await compile(["src/shapes.ts"], { "src/shapes.ts": SOURCE });
    const output = typescriptExtractor.extract(input);
    const module = output.modules[0]!;
    expect(module.childrenIds).toEqual(
      expect.arrayContaining([
        find(output.symbols, "Circle", "class").id,
        find(output.symbols, "area", "function").id,
        find(output.symbols, "PI", "constant").id,
      ]),
    );
  });

  it("extracts multiple units in one pass", async () => {
    const input = await compile(["src/a.ts", "src/b.ts"], {
      "src/a.ts": 'import b from "./b";\nexport const a = b;',
      "src/b.ts": "export const b = 1;",
    });
    const output = typescriptExtractor.extract(input);
    expect(output.modules).toHaveLength(2);
    expect(output.modules.map((module) => module.name).sort()).toEqual(["src.a", "src.b"]);
  });
});
