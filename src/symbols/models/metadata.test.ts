import { describe, it, expect } from "vitest";
import { createSymbolMetadata, type SymbolMetadataInput } from "./metadata.js";

function input(overrides: Partial<SymbolMetadataInput> = {}): SymbolMetadataInput {
  return {
    identifier: "area",
    qualifiedName: "demo.src.index.Circle.area",
    kind: "method",
    file: "src/index.ts",
    languageId: "typescript",
    compiler: { compilerId: "typescript", format: "typescript", nativeVersion: "5.9" },
    id: "ts:src/index.ts:demo.src.index.Circle.area",
    hash: "abc123",
    ...overrides,
  };
}

describe("createSymbolMetadata", () => {
  it("builds a frozen symbol metadata with defaults", () => {
    const metadata = createSymbolMetadata(input());
    expect(metadata.visibility).toBe("public");
    expect(metadata.modifiers).toEqual([]);
    expect(metadata.exported).toBe(false);
    expect(metadata.internal).toBe(false);
    expect(metadata.generated).toBe(false);
    expect(metadata.deprecated).toBe(false);
    expect(metadata.synthetic).toBe(false);
    expect(metadata.displayName).toBe("area");
    expect(metadata.location).toEqual({ file: "src/index.ts" });
    expect(metadata.sourceFile).toBe("src/index.ts");
    expect(metadata.attributes).toEqual({});
    expect(metadata.compiler).toEqual({
      compilerId: "typescript",
      format: "typescript",
      nativeVersion: "5.9",
    });
  });

  it("applies explicit flags and visibility", () => {
    const metadata = createSymbolMetadata(
      input({
        visibility: "protected",
        modifiers: ["export", "static"],
        exported: true,
        internal: true,
        synthetic: true,
        namespace: ["N"],
        packageName: "core",
        moduleName: "src.index",
      }),
    );
    expect(metadata.visibility).toBe("protected");
    expect(metadata.modifiers).toEqual(["export", "static"]);
    expect(metadata.exported).toBe(true);
    expect(metadata.internal).toBe(true);
    expect(metadata.namespace).toEqual(["N"]);
    expect(metadata.packageName).toBe("core");
    expect(metadata.moduleName).toBe("src.index");
  });

  it("records a location range when provided", () => {
    const range = {
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 1, column: 10, offset: 9 },
    };
    const metadata = createSymbolMetadata(input({ range }));
    expect(metadata.location.range).toEqual(range);
  });

  it("freezes nested collections", () => {
    const metadata = createSymbolMetadata(input({ attributes: { a: "1" } }));
    expect(Object.isFrozen(metadata.attributes)).toBe(true);
    expect(Object.isFrozen(metadata.modifiers)).toBe(true);
    expect(Object.isFrozen(metadata)).toBe(true);
  });
});
