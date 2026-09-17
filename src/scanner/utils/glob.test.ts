import { describe, expect, it } from "vitest";
import { expandBraces, hasGlobMagic, matchPath } from "./glob.js";

describe("hasGlobMagic", () => {
  it("detects glob magic", () => {
    expect(hasGlobMagic("src/**/*.ts")).toBe(true);
    expect(hasGlobMagic("src/foo.ts")).toBe(false);
    expect(hasGlobMagic("a?c")).toBe(true);
    expect(hasGlobMagic("[ab]")).toBe(true);
    expect(hasGlobMagic("{a,b}")).toBe(true);
  });
});

describe("expandBraces", () => {
  it("expands simple alternatives", () => {
    expect(expandBraces("*.{ts,js}")).toEqual(["*.ts", "*.js"]);
  });

  it("handles multiple brace groups", () => {
    expect(expandBraces("{a,b}/x.{1,2}")).toEqual(["a/x.1", "a/x.2", "b/x.1", "b/x.2"]);
  });

  it("handles nested braces", () => {
    expect(expandBraces("{a,{b,c}}/d")).toEqual(["a/d", "b/d", "c/d"]);
  });

  it("returns the input unchanged without braces", () => {
    expect(expandBraces("plain/path.ts")).toEqual(["plain/path.ts"]);
  });

  it("returns the input unchanged for unterminated braces", () => {
    expect(expandBraces("{a,b")).toEqual(["{a,b"]);
  });
});

describe("matchPath", () => {
  it("matches a literal path", () => {
    expect(matchPath("src/index.ts", "src/index.ts")).toBe(true);
    expect(matchPath("src/index.ts", "src/other.ts")).toBe(false);
  });

  it("matches a single-star segment", () => {
    expect(matchPath("src/*.ts", "src/index.ts")).toBe(true);
    expect(matchPath("src/*.ts", "src/deep/index.ts")).toBe(false);
  });

  it("matches globstar across directories", () => {
    expect(matchPath("**/*.ts", "a/b/c/file.ts")).toBe(true);
    expect(matchPath("src/**", "src/a/b/c.ts")).toBe(true);
    expect(matchPath("src/**", "src/index.ts")).toBe(true);
    expect(matchPath("packages/**/src", "packages/a/src")).toBe(true);
    expect(matchPath("packages/**/src", "packages/a/b/c/src")).toBe(true);
    expect(matchPath("packages/**/src", "packages/a/lib")).toBe(false);
  });

  it("matches question marks", () => {
    expect(matchPath("file?.ts", "file1.ts")).toBe(true);
    expect(matchPath("file?.ts", "file12.ts")).toBe(false);
  });

  it("matches character classes", () => {
    expect(matchPath("file[0-9].ts", "file5.ts")).toBe(true);
    expect(matchPath("file[!0-9].ts", "filea.ts")).toBe(true);
    expect(matchPath("file[!0-9].ts", "file5.ts")).toBe(false);
  });

  it("matches basename-only patterns at any depth", () => {
    expect(matchPath("node_modules", "node_modules")).toBe(true);
    expect(matchPath("node_modules", "a/b/node_modules/x.js")).toBe(true);
    expect(matchPath("*.test.ts", "packages/a/index.test.ts")).toBe(true);
    expect(matchPath("dist", "packages/a/dist/bundle.js")).toBe(true);
  });

  it("matches patterns with braces via expansion", () => {
    expect(matchPath("*.{ts,js}", "file.ts")).toBe(true);
    expect(matchPath("*.{ts,js}", "file.js")).toBe(true);
    expect(matchPath("*.{ts,js}", "file.py")).toBe(false);
  });

  it("does not let wildcards match leading-dot segments by default", () => {
    expect(matchPath("**/*.ts", ".hidden/deep/file.ts")).toBe(false);
    expect(matchPath("**/*.ts", "src/.hidden.ts")).toBe(false);
  });

  it("matches dotfiles when dot is enabled", () => {
    expect(matchPath("**/*.ts", ".hidden/file.ts", { dot: true })).toBe(true);
    expect(matchPath("**/*.ts", "src/.hidden.ts", { dot: true })).toBe(true);
  });

  it("anchors a leading slash to the root", () => {
    expect(matchPath("/package.json", "package.json")).toBe(true);
    expect(matchPath("/package.json", "a/package.json")).toBe(false);
  });

  it("matches directories and descendants for trailing-slash patterns", () => {
    expect(matchPath("docs/", "docs")).toBe(true);
    expect(matchPath("docs/", "docs/intro.md")).toBe(true);
    expect(matchPath("docs/", "src/docs/intro.md")).toBe(true);
  });

  it("respects case sensitivity", () => {
    expect(matchPath("*.TS", "file.ts")).toBe(false);
    expect(matchPath("*.TS", "file.ts", { caseSensitive: false })).toBe(true);
  });
});
