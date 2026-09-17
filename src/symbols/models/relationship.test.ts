import { describe, it, expect } from "vitest";
import { createSymbolRelationship, type SymbolRelationship } from "./relationship.js";

describe("createSymbolRelationship", () => {
  it("builds a frozen structural relationship", () => {
    const relationship = createSymbolRelationship({
      type: "owns",
      fromId: "module:ts:a",
      toId: "ts:a:Circle",
    });
    expect(relationship.type).toBe("owns");
    expect(relationship.fromId).toBe("module:ts:a");
    expect(relationship.toId).toBe("ts:a:Circle");
    expect(relationship.names).toBeUndefined();
    expect(Object.isFrozen(relationship)).toBe(true);
  });

  it("records module-level relationships without ids", () => {
    const relationship = createSymbolRelationship({
      type: "imported-by",
      fromFile: "src/index.ts",
      toFile: "src/util.ts",
      module: "./util",
    });
    expect(relationship.fromFile).toBe("src/index.ts");
    expect(relationship.toFile).toBe("src/util.ts");
    expect(relationship.module).toBe("./util");
    expect(relationship.fromId).toBeUndefined();
  });

  it("freezes names arrays", () => {
    const relationship = createSymbolRelationship({
      type: "re-exports",
      fromFile: "src/re.ts",
      module: "./util",
      names: ["a", "b"],
    });
    expect(relationship.names).toEqual(["a", "b"]);
    expect(Object.isFrozen(relationship.names)).toBe(true);
  });
});

describe("relationship type vocabulary", () => {
  it("covers the structural edge types", () => {
    const types: SymbolRelationship["type"][] = [
      "owns",
      "nested-inside",
      "declared-in",
      "defined-in",
      "exported-by",
      "imported-by",
      "re-exports",
    ];
    expect(types).toHaveLength(7);
  });
});
