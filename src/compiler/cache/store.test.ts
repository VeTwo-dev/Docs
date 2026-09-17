import { describe, it, expect } from "vitest";
import { createCompilerCache } from "./store.js";
import { createCompilationUnit } from "../models/unit.js";
import { createCompilationResult } from "../models/result.js";
import { createCompilationContext } from "../models/context.js";
import { createCompilationStatistics } from "../models/statistics.js";

function unit(file: string, hash = "h"): ReturnType<typeof createCompilationUnit> {
  return createCompilationUnit({
    file,
    languageId: "typescript",
    compilerId: "typescript",
    hash,
    compileTimeMs: 1,
  });
}

describe("CompilerCache", () => {
  it("stores and retrieves units with hashes and dependencies", () => {
    const cache = createCompilerCache();
    expect(cache.getUnit("ts", "a.ts")).toBe(undefined);
    cache.putUnit("ts", "a.ts", unit("a.ts", "h1"), ["b.ts"]);
    expect(cache.getUnit("ts", "a.ts")?.hash).toBe("h1");
    expect(cache.getHash("ts", "a.ts")).toBe("h1");
    expect(cache.getDependencies("ts", "a.ts")).toEqual(["b.ts"]);
    expect(cache.size()).toBe(1);
  });

  it("detects content changes via hashes", () => {
    const cache = createCompilerCache();
    cache.putUnit("ts", "a.ts", unit("a.ts", "h1"));
    expect(cache.hasChanged("ts", "a.ts", "h1")).toBe(false);
    expect(cache.hasChanged("ts", "a.ts", "h2")).toBe(true);
    expect(cache.hasChanged("ts", "new.ts", "h1")).toBe(true);
  });

  it("removes units and stores results/artifacts", () => {
    const cache = createCompilerCache();
    cache.putUnit("ts", "a.ts", unit("a.ts"));
    cache.removeUnit("ts", "a.ts");
    expect(cache.getUnit("ts", "a.ts")).toBe(undefined);

    const result = createCompilationResult({
      requestId: "r",
      compilerId: "ts",
      languageId: "typescript",
      rootDir: "/root",
      units: [unit("a.ts")],
      statistics: createCompilationStatistics({}),
      context: createCompilationContext({
        requestId: "r",
        rootDir: "/root",
        languageId: "typescript",
        compilerId: "ts",
        files: ["a.ts"],
        compiledFiles: ["a.ts"],
      }),
    });
    cache.putResult("ts", "fp", result);
    expect(cache.getResult("ts", "fp")?.requestId).toBe("r");

    cache.putArtifact("ts", "a.ts", "map", { version: 3 });
    expect(cache.getArtifact("ts", "a.ts", "map")).toEqual({ version: 3 });
    cache.removeArtifact("ts", "a.ts", "map");
    expect(cache.getArtifact("ts", "a.ts", "map")).toBe(undefined);
  });

  it("invalidates per compiler and per file", () => {
    const cache = createCompilerCache();
    cache.putUnit("ts", "a.ts", unit("a.ts"));
    cache.putUnit("js", "a.js", unit("a.js"));

    cache.invalidate("ts");
    expect(cache.getUnit("ts", "a.ts")).toBe(undefined);
    expect(cache.getUnit("js", "a.js")).not.toBe(undefined);

    cache.invalidate(undefined, "a.js");
    expect(cache.getUnit("js", "a.js")).toBe(undefined);
  });

  it("invalidates results and artifacts when clearing per compiler", () => {
    const cache = createCompilerCache();
    const result = createCompilationResult({
      requestId: "r",
      compilerId: "ts",
      languageId: "typescript",
      rootDir: "/root",
      statistics: createCompilationStatistics({}),
      context: createCompilationContext({
        requestId: "r",
        rootDir: "/root",
        languageId: "typescript",
        compilerId: "ts",
        files: [],
        compiledFiles: [],
      }),
    });
    cache.putResult("ts", "fp", result);
    cache.putArtifact("ts", "a.ts", "map", 1);
    cache.invalidate("ts");
    expect(cache.getResult("ts", "fp")).toBe(undefined);
    expect(cache.getArtifact("ts", "a.ts", "map")).toBe(undefined);
  });

  it("clears everything", () => {
    const cache = createCompilerCache();
    cache.putUnit("ts", "a.ts", unit("a.ts"));
    cache.putUnit("js", "a.js", unit("a.js"));
    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.getUnit("ts", "a.ts")).toBe(undefined);
    expect(cache.getUnit("js", "a.js")).toBe(undefined);
  });

  it("evicts the oldest units beyond maxEntries", () => {
    const cache = createCompilerCache({ maxEntries: 2 });
    cache.putUnit("ts", "a.ts", unit("a.ts"));
    cache.putUnit("ts", "b.ts", unit("b.ts"));
    cache.putUnit("ts", "c.ts", unit("c.ts"));
    expect(cache.size()).toBe(2);
    expect(cache.getUnit("ts", "a.ts")).toBe(undefined);
    expect(cache.getUnit("ts", "b.ts")).not.toBe(undefined);
    expect(cache.getUnit("ts", "c.ts")).not.toBe(undefined);
  });
});
