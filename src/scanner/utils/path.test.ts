import { describe, it, expect } from "vitest";
import { resolvePathSafe, isSubPath } from "./path.js";

describe("resolvePathSafe", () => {
  it("resolves a safe relative path", () => {
    const result = resolvePathSafe("/project/src", "utils/helper.ts");
    expect(result).toBe("/project/src/utils/helper.ts");
  });

  it("resolves a safe absolute path within base", () => {
    const result = resolvePathSafe("/project", "/project/src/index.ts");
    expect(result).toBe("/project/src/index.ts");
  });

  it("throws on path traversal", () => {
    expect(() => resolvePathSafe("/project/src", "../../etc/passwd")).toThrow(
      "Path traversal detected",
    );
  });

  it("throws on absolute path outside base", () => {
    expect(() => resolvePathSafe("/project", "/etc/passwd")).toThrow("Path traversal detected");
  });
});

describe("isSubPath", () => {
  it("returns true for child paths", () => {
    expect(isSubPath("/project", "/project/src/index.ts")).toBe(true);
  });

  it("returns false for parent paths", () => {
    expect(isSubPath("/project/src", "/project")).toBe(false);
  });

  it("returns false for sibling paths", () => {
    expect(isSubPath("/project/src", "/other/dir")).toBe(false);
  });

  it("returns false for traversal paths", () => {
    expect(isSubPath("/project/src", "/project/src/../../etc")).toBe(false);
  });
});
