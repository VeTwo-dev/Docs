import { describe, it, expect } from "vitest";
import { joinQualifiedName, moduleNameOf, namespacePath, packageNameOf } from "./names.js";

describe("joinQualifiedName", () => {
  it("joins non-empty segments with dots", () => {
    expect(joinQualifiedName("pkg", "src.index", "Circle", "area")).toBe(
      "pkg.src.index.Circle.area",
    );
  });

  it("skips empty and undefined parts", () => {
    expect(joinQualifiedName("pkg", "", undefined, "Circle")).toBe("pkg.Circle");
  });

  it("returns an empty string when no parts remain", () => {
    expect(joinQualifiedName()).toBe("");
    expect(joinQualifiedName(undefined, "")).toBe("");
  });
});

describe("moduleNameOf", () => {
  it("strips the extension and replaces slashes with dots", () => {
    expect(moduleNameOf("src/index.ts")).toBe("src.index");
    expect(moduleNameOf("src/util.js")).toBe("src.util");
    expect(moduleNameOf("a/b/c.tsx")).toBe("a.b.c");
  });

  it("handles backslashes and files without extensions", () => {
    expect(moduleNameOf("src\\util.ts")).toBe("src.util");
    expect(moduleNameOf("index")).toBe("index");
  });

  it("handles hidden files", () => {
    expect(moduleNameOf(".eslintrc")).toBe(".eslintrc");
  });
});

describe("namespacePath", () => {
  it("joins namespace names with dots", () => {
    expect(namespacePath(["Http", "Client"])).toBe("Http.Client");
    expect(namespacePath([])).toBe("");
  });
});

describe("packageNameOf", () => {
  it("sanitizes directory names into identifier-safe package names", () => {
    expect(packageNameOf("my-app")).toBe("my-app");
    expect(packageNameOf("my app")).toBe("my_app");
    expect(packageNameOf("   ")).toBe("default");
    expect(packageNameOf("")).toBe("default");
  });
});
