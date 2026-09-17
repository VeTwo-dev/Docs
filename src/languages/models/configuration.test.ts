import { describe, expect, it } from "vitest";
import { createConfigurationModel } from "./configuration.js";

describe("createConfigurationModel", () => {
  it("normalises optional fields and freezes", () => {
    const model = createConfigurationModel({
      files: ["tsconfig.json"],
      description: "ts config",
    });
    expect(model.files).toEqual(["tsconfig.json"]);
    expect(model.patterns).toEqual([]);
    expect(model.description).toBe("ts config");
    expect(Object.isFrozen(model)).toBe(true);
  });

  it("copies arrays and preserves schemaPath", () => {
    const files = ["tsconfig.json"];
    const model = createConfigurationModel({
      files,
      patterns: ["**/tsconfig*.json"],
      schemaPath: "schema/tsconfig.json",
    });
    files.push("mutated");
    expect(model.files).toEqual(["tsconfig.json"]);
    expect(model.schemaPath).toBe("schema/tsconfig.json");
  });
});
