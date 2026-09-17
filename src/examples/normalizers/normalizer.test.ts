import { describe, it, expect } from "vitest";
import {
  normalizeExampleBody,
  dedentExampleBody,
  languageFromInfo,
  detectPackages,
  detectSymbols,
} from "./index.js";

describe("normalizeExampleBody", () => {
  it("collapses CRLF, trailing whitespace and blank runs", () => {
    expect(normalizeExampleBody("  a\r\nb  \n\n\nc\n\n")).toBe("  a\nb\n\nc");
  });

  it("returns empty input as empty", () => {
    expect(normalizeExampleBody("   \n\n  ")).toBe("");
  });
});

describe("dedentExampleBody", () => {
  it("removes the shared minimum indentation", () => {
    expect(dedentExampleBody("    a\n      b\n")).toBe("a\n  b\n");
  });

  it("keeps content with no indentation", () => {
    expect(dedentExampleBody("a\nb")).toBe("a\nb");
  });

  it("keeps whitespace-only bodies", () => {
    expect(dedentExampleBody("   ")).toBe("   ");
  });
});

describe("languageFromInfo", () => {
  it("parses language from fenced info strings", () => {
    expect(languageFromInfo("ts")).toBe("ts");
    expect(languageFromInfo("  TypeScriptx foo  ")).toBe("typescriptx");
    expect(languageFromInfo("ts title")).toBe("ts");
  });

  it("defaults to text", () => {
    expect(languageFromInfo(undefined)).toBe("text");
    expect(languageFromInfo("")).toBe("text");
    expect(languageFromInfo("   ")).toBe("text");
  });
});

describe("detectPackages", () => {
  it("detects packages in import statements", () => {
    const found = detectPackages('import { a } from "pkg-one";', ["pkg-one", "pkg-two"]);
    expect(found).toEqual(["pkg-one"]);
  });

  it("detects require() and quoted package names", () => {
    expect(detectPackages("const x = require('pkg-a');", ["pkg-a"])).toEqual(["pkg-a"]);
    expect(detectPackages('{"deps": "pkg-b"}', ["pkg-b"])).toEqual(["pkg-b"]);
  });

  it("returns empty for missing or empty known lists", () => {
    expect(detectPackages('import "x";', undefined)).toEqual([]);
    expect(detectPackages('import "x";', [])).toEqual([]);
  });

  it("escapes regex-special package names", () => {
    expect(detectPackages('import "@scope/pkg";', ["@scope/pkg"])).toEqual(["@scope/pkg"]);
    expect(detectPackages('import "aXb";', ["a.b"])).toEqual([]);
  });
});

describe("detectSymbols", () => {
  it("detects whole-word symbol references", () => {
    const found = detectSymbols("call greet(x);", ["greet", "greeting"]);
    expect(found).toEqual(["greet"]);
  });

  it("returns empty for missing or empty known lists and skips blank symbols", () => {
    expect(detectSymbols("greet", undefined)).toEqual([]);
    expect(detectSymbols("greet", [])).toEqual([]);
    expect(detectSymbols("greet", ["", "greet"])).toEqual(["greet"]);
  });
});
