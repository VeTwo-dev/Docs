import { describe, expect, it } from "vitest";
import { normalizeMetadata, validateMetadata } from "./metadata.js";

describe("normalizeMetadata", () => {
  it("fills defaults and normalises extensions/aliases/mime types", () => {
    const normalized = normalizeMetadata({
      id: "TypeScript",
      displayName: "TypeScript",
      aliases: ["ts", "TS"],
      extensions: ["ts", ".TS"],
      mimeTypes: ["Application/TypeScript"],
    });
    expect(normalized.id).toBe("typescript");
    expect(normalized.aliases).toEqual(["ts"]);
    expect(normalized.extensions).toEqual([".ts"]);
    expect(normalized.mimeTypes).toEqual(["application/typescript"]);
    expect(normalized.priority).toBe(0);
  });

  it("deduplicates and strips empty values", () => {
    const normalized = normalizeMetadata({
      id: "js",
      displayName: "JS",
      fileNames: ["a", "a", "  "],
      defaultEntryFiles: ["index.js", "index.js"],
    });
    expect(normalized.fileNames).toEqual(["a"]);
    expect(normalized.defaultEntryFiles).toEqual(["index.js"]);
  });

  it("preserves optional scalar fields", () => {
    const normalized = normalizeMetadata({
      id: "x",
      displayName: "X",
      version: "1.0.0",
      priority: 3,
      color: "#fff",
      icon: "x",
    });
    expect(normalized.version).toBe("1.0.0");
    expect(normalized.priority).toBe(3);
    expect(normalized.color).toBe("#fff");
    expect(normalized.icon).toBe("x");
  });
});

describe("validateMetadata", () => {
  it("accepts valid metadata", () => {
    expect(validateMetadata({ id: "ts", displayName: "TypeScript" })).toEqual([]);
  });

  it("flags a missing id", () => {
    const diagnostics = validateMetadata({ id: "", displayName: "X" });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe("invalid-adapter");
  });

  it("flags a missing displayName", () => {
    const diagnostics = validateMetadata({ id: "x", displayName: "  " });
    expect(diagnostics.some((d) => d.message.includes("displayName"))).toBe(true);
  });

  it("warns about extensions without a leading dot", () => {
    const diagnostics = validateMetadata({ id: "x", displayName: "X", extensions: ["ts"] });
    expect(diagnostics.some((d) => d.severity === "warning")).toBe(true);
  });
});
