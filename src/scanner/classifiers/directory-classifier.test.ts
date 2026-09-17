import { describe, expect, it } from "vitest";
import { classifyDirectory } from "./directory-classifier.js";
import type { DirectoryClassificationInput } from "./types.js";

function classify(
  name: string,
  depth = 1,
  relativePath?: string,
): ReturnType<typeof classifyDirectory> {
  const input: DirectoryClassificationInput = {
    name,
    depth,
    relativePath: relativePath ?? (depth === 0 ? "." : name),
  };
  return classifyDirectory(input);
}

describe("classifyDirectory", () => {
  it("classifies the root", () => {
    expect(classify("", 0, ".")).toBe("root");
  });

  it("maps common directory names", () => {
    expect(classify("src")).toBe("src");
    expect(classify("lib")).toBe("src");
    expect(classify("docs")).toBe("docs");
    expect(classify("packages")).toBe("packages");
    expect(classify("apps")).toBe("apps");
    expect(classify("tests")).toBe("tests");
    expect(classify("scripts")).toBe("scripts");
    expect(classify("assets")).toBe("assets");
    expect(classify("public")).toBe("public");
    expect(classify("dist")).toBe("dist");
    expect(classify("coverage")).toBe("coverage");
    expect(classify("node_modules")).toBe("node_modules");
    expect(classify(".github")).toBe("ci");
    expect(classify(".vscode")).toBe("ide");
  });

  it("classifies case-insensitively", () => {
    expect(classify("SRC")).toBe("src");
    expect(classify("Docs")).toBe("docs");
  });

  it("falls back to unknown", () => {
    expect(classify("mystery")).toBe("unknown");
  });
});
