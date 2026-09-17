import { describe, expect, it } from "vitest";
import {
  createDefaultRules,
  IgnoreEngine,
  loadIgnoreFilesForDir,
  parseIgnoreFile,
} from "./ignore.js";
import { MemoryProvider } from "../providers/memory.js";

describe("createDefaultRules", () => {
  it("creates non-negated root-scoped rules", () => {
    const rules = createDefaultRules();
    expect(rules.length).toBeGreaterThan(0);
    expect(rules[0]).toMatchObject({ source: "default", dir: ".", negated: false });
  });
});

describe("parseIgnoreFile", () => {
  it("parses comments, blanks and rules", () => {
    const rules = parseIgnoreFile("# comment\n\n*.log\n\n!keep.log\n", ".", "gitignore", 5);
    expect(rules).toHaveLength(2);
    expect(rules[0]).toEqual({
      pattern: "*.log",
      source: "gitignore",
      dir: ".",
      negated: false,
      index: 5,
    });
    expect(rules[1]).toEqual({
      pattern: "keep.log",
      source: "gitignore",
      dir: ".",
      negated: true,
      index: 6,
    });
  });

  it("un-escapes escaped leading characters", () => {
    const rules = parseIgnoreFile("\\#not-comment\n\\!keep\n\\ leading\n", ".", "gitignore", 0);
    expect(rules.map((r) => r.pattern)).toEqual(["#not-comment", "!keep", " leading"]);
    expect(rules.every((r) => !r.negated)).toBe(true);
  });
});

describe("IgnoreEngine", () => {
  it("ignores matching patterns", () => {
    const engine = new IgnoreEngine(createDefaultRules());
    expect(engine.isIgnored("node_modules/lodash/index.js")).toBe(true);
    expect(engine.isIgnored("src/index.ts")).toBe(false);
    expect(engine.count).toBe(createDefaultRules().length);
  });

  it("re-includes files matching a later negation rule", () => {
    const rules = [
      { pattern: "dist", source: "gitignore" as const, dir: ".", negated: false, index: 0 },
      { pattern: "dist/keep.txt", source: "gitignore" as const, dir: ".", negated: true, index: 1 },
    ];
    const engine = new IgnoreEngine(rules);
    expect(engine.isIgnored("dist/bundle.js")).toBe(true);
    expect(engine.isIgnored("dist/keep.txt")).toBe(false);
    expect(engine.matches("dist/keep.txt").rule?.negated).toBe(true);
  });

  it("scopes rules to their directory", () => {
    const rules = [
      { pattern: "*.log", source: "gitignore" as const, dir: ".", negated: false, index: 0 },
      {
        pattern: "*.log",
        source: "gitignore" as const,
        dir: "packages/a",
        negated: false,
        index: 1,
      },
    ];
    const engine = new IgnoreEngine(rules);
    expect(engine.isIgnored("packages/a/x.log")).toBe(true);
    expect(engine.isIgnored("packages/b/x.log")).toBe(true);
    expect(engine.isIgnored("src/x.log")).toBe(true);
  });

  it("excludes root-scoped single-segment patterns from nested paths only as directories", () => {
    const engine = new IgnoreEngine([
      { pattern: "coverage", source: "default" as const, dir: ".", negated: false, index: 0 },
    ]);
    expect(engine.isIgnored("coverage/lcov.info")).toBe(true);
    expect(engine.isIgnored("a/coverage/x")).toBe(true);
  });

  it("reports no rule when nothing matches", () => {
    const engine = new IgnoreEngine([
      { pattern: "*.log", source: "user" as const, dir: ".", negated: false, index: 0 },
    ]);
    expect(engine.matches("index.ts")).toEqual({ ignored: false });
  });

  it("reports couldReincludeUnder for re-including negation rules", () => {
    const engine = new IgnoreEngine([
      { pattern: "dist", source: "gitignore" as const, dir: ".", negated: false, index: 0 },
      { pattern: "dist/keep.txt", source: "gitignore" as const, dir: ".", negated: true, index: 1 },
    ]);
    expect(engine.couldReincludeUnder("dist")).toBe(true);
    expect(engine.couldReincludeUnder("src")).toBe(false);
  });

  it("handles global negation rules that could apply anywhere", () => {
    const engine = new IgnoreEngine([
      { pattern: "**/!(*.tmp)", source: "gitignore" as const, dir: ".", negated: true, index: 0 },
    ]);
    expect(engine.couldReincludeUnder("anything")).toBe(true);
  });
});

describe("loadIgnoreFilesForDir", () => {
  it("loads and parses ignore files from a provider", async () => {
    const provider = new MemoryProvider("/root");
    await provider.writeFile("/root/.gitignore", "*.log\nnode_modules\n");
    await provider.writeFile("/root/.docsignore", "!important.log\n");
    const rules = await loadIgnoreFilesForDir(provider, "/root", ".", 0);
    expect(rules.map((r) => [r.pattern, r.source, r.negated])).toEqual([
      ["*.log", "gitignore", false],
      ["node_modules", "gitignore", false],
      ["important.log", "docsignore", true],
    ]);
  });

  it("skips missing files and unreadable files", async () => {
    const provider = new MemoryProvider("/root");
    const rules = await loadIgnoreFilesForDir(provider, "/root", ".", 0);
    expect(rules).toEqual([]);
  });
});
