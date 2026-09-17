import { describe, it, expect } from "vitest";
import {
  isRelativeSpecifier,
  normalizePosix,
  posixDirname,
  resolveRelativeTarget,
  resolveSpecifiers,
  toRelativePath,
} from "./dependencies.js";

describe("isRelativeSpecifier", () => {
  it("accepts relative specifiers", () => {
    expect(isRelativeSpecifier("./x")).toBe(true);
    expect(isRelativeSpecifier("../x")).toBe(true);
    expect(isRelativeSpecifier(".")).toBe(true);
    expect(isRelativeSpecifier("..")).toBe(true);
  });

  it("rejects bare and package specifiers", () => {
    expect(isRelativeSpecifier("lodash")).toBe(false);
    expect(isRelativeSpecifier("@scope/pkg")).toBe(false);
    expect(isRelativeSpecifier("/abs")).toBe(false);
    expect(isRelativeSpecifier("")).toBe(false);
  });
});

describe("normalizePosix", () => {
  it("collapses dots, resolves dot-dots and drops empties", () => {
    expect(normalizePosix("./a/./b")).toBe("a/b");
    expect(normalizePosix("a//b")).toBe("a/b");
    expect(normalizePosix("a/../b")).toBe("b");
    expect(normalizePosix("a\\b")).toBe("a/b");
  });
});

describe("posixDirname", () => {
  it("returns the directory part of a relative path", () => {
    expect(posixDirname("src/foo.ts")).toBe("src");
    expect(posixDirname("foo.ts")).toBe(".");
  });
});

describe("resolveRelativeTarget", () => {
  const extensions = [".ts", ".tsx"];

  it("resolves a relative specifier against a known file set", () => {
    const known = new Set(["src/a.ts"]);
    expect(resolveRelativeTarget("/root", "src/index.ts", "./a", extensions, known)).toBe(
      "src/a.ts",
    );
  });

  it("appends the target file's extension", () => {
    const known = new Set(["src/index.ts"]);
    expect(resolveRelativeTarget("/root", "src/main.ts", "./index", extensions, known)).toBe(
      "src/index.ts",
    );
  });

  it("resolves directory imports to index files", () => {
    const known = new Set(["src/lib/index.ts", "src/lib/index.tsx"]);
    expect(resolveRelativeTarget("/root", "src/main.ts", "./lib", extensions, known)).toBe(
      "src/lib/index.ts",
    );
  });

  it("returns undefined for unknown targets", () => {
    const known = new Set(["src/other.ts"]);
    expect(resolveRelativeTarget("/root", "src/main.ts", "./missing", extensions, known)).toBe(
      undefined,
    );
  });

  it("returns undefined for non-relative specifiers", () => {
    expect(resolveRelativeTarget("/root", "src/main.ts", "lodash", extensions)).toBe(undefined);
  });
});

describe("resolveSpecifiers", () => {
  it("dedupes and sorts resolved specifiers", () => {
    const known = new Set(["src/a.ts", "src/b.ts"]);
    const result = resolveSpecifiers(
      "/root",
      "src/index.ts",
      ["./b", "./a", "./a", "lodash"],
      [".ts", ".tsx"],
      known,
    );
    expect(result).toEqual(["src/a.ts", "src/b.ts"]);
  });

  it("skips specifiers that cannot be resolved", () => {
    const result = resolveSpecifiers("/root", "src/index.ts", ["./nope"], [".ts"], new Set());
    expect(result).toEqual([]);
  });
});

describe("toRelativePath", () => {
  it("strips the root prefix and leading slashes", () => {
    expect(toRelativePath("/root", "/root/src/a.ts")).toBe("src/a.ts");
    expect(toRelativePath("/root", "/root/a.ts")).toBe("a.ts");
  });
});
