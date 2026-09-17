import { describe, it, expect } from "vitest";
import { CompilerDiagnosticCode, createCompilerDiagnostic } from "../contracts/diagnostics.js";
import { createCompilationContext } from "./context.js";
import { createCompilationResult } from "./result.js";
import { createCompilationStatistics } from "./statistics.js";
import { createCompilationUnit } from "./unit.js";
import { createSourceMap } from "./sourcemap.js";
import { createSyntaxTree } from "./syntax.js";
import { fingerprintCompileRequest } from "../shared/fingerprint.js";
import { hashContent } from "../shared/hash.js";

function unit(overrides: Partial<Parameters<typeof createCompilationUnit>[0]> = {}) {
  return createCompilationUnit({
    file: "a.ts",
    languageId: "typescript",
    compilerId: "typescript",
    hash: "abc",
    ...overrides,
  });
}

function context(overrides: Partial<Parameters<typeof createCompilationContext>[0]> = {}) {
  return createCompilationContext({
    requestId: "r1",
    rootDir: "/root",
    languageId: "typescript",
    compilerId: "typescript",
    files: ["a.ts"],
    compiledFiles: ["a.ts"],
    ...overrides,
  });
}

describe("createCompilationUnit", () => {
  it("builds a frozen unit with defaults", () => {
    const created = unit();
    expect(created.status).toBe("ok");
    expect(created.compileTimeMs).toBe(0);
    expect(created.diagnostics).toEqual([]);
    expect(Object.isFrozen(created)).toBe(true);
    expect(Object.isFrozen(created.diagnostics)).toBe(true);
  });

  it("preserves a syntax tree, diagnostics, source map and compile time", () => {
    const tree = createSyntaxTree({
      languageId: "typescript",
      file: "a.ts",
      format: "typescript",
      root: { kind: "SourceFile" },
    });
    const diagnostic = createCompilerDiagnostic({
      code: CompilerDiagnosticCode.SyntaxError,
      severity: "error",
      message: "bad",
    });
    const map = createSourceMap({
      sources: ["a.ts"],
      names: [],
      mappings: "AAAA",
    });
    const created = createCompilationUnit({
      file: "a.ts",
      languageId: "typescript",
      compilerId: "typescript",
      status: "failed",
      syntaxTree: tree,
      diagnostics: [diagnostic],
      sourceMap: map,
      hash: "abc",
      compileTimeMs: 12,
    });
    expect(created.status).toBe("failed");
    expect(created.syntaxTree).toBe(tree);
    expect(created.sourceMap).toBe(map);
    expect(created.compileTimeMs).toBe(12);
  });
});

describe("createCompilationStatistics", () => {
  it("defaults counters to zero", () => {
    const stats = createCompilationStatistics({});
    expect(stats.totalFiles).toBe(0);
    expect(stats.cached).toBe(false);
    expect(stats.nativeVersion).toBe(undefined);
  });

  it("carries provided values and optional native version", () => {
    const stats = createCompilationStatistics({
      totalFiles: 3,
      compiledFiles: 2,
      cachedFiles: 1,
      cached: true,
      nativeVersion: "5.9.3",
    });
    expect(stats.totalFiles).toBe(3);
    expect(stats.cachedFiles).toBe(1);
    expect(stats.cached).toBe(true);
    expect(stats.nativeVersion).toBe("5.9.3");
  });
});

describe("createCompilationContext", () => {
  it("builds an immutable context with a default mode", () => {
    const created = context();
    expect(created.mode).toBe("full");
    expect(Object.isFrozen(created.files)).toBe(true);
    expect(created.workspace).toBe(undefined);
  });

  it("freezes workspace and options", () => {
    const created = context({
      mode: "incremental",
      workspace: { manager: "npm", packages: ["a", "b"], monorepo: true },
      options: { sourceMaps: true },
    });
    expect(created.mode).toBe("incremental");
    expect(created.workspace?.monorepo).toBe(true);
    expect(created.options.sourceMaps).toBe(true);
    expect(Object.isFrozen(created.workspace)).toBe(true);
  });
});

describe("createCompilationResult", () => {
  it("is ok when nothing failed and there are no error diagnostics", () => {
    const result = createCompilationResult({
      requestId: "r1",
      compilerId: "typescript",
      languageId: "typescript",
      rootDir: "/root",
      units: [unit()],
      statistics: createCompilationStatistics({}),
      context: context(),
    });
    expect(result.ok).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.dependencies)).toBe(true);
  });

  it("is not ok when a unit failed", () => {
    const result = createCompilationResult({
      requestId: "r1",
      compilerId: "typescript",
      languageId: "typescript",
      rootDir: "/root",
      units: [unit({ status: "failed" })],
      failedFiles: ["a.ts"],
      statistics: createCompilationStatistics({}),
      context: context(),
    });
    expect(result.ok).toBe(false);
    expect(result.failedFiles).toEqual(["a.ts"]);
  });

  it("is not ok when an error diagnostic exists", () => {
    const result = createCompilationResult({
      requestId: "r1",
      compilerId: "typescript",
      languageId: "typescript",
      rootDir: "/root",
      diagnostics: [
        createCompilerDiagnostic({
          code: CompilerDiagnosticCode.CompilationFailed,
          severity: "error",
          message: "boom",
        }),
      ],
      statistics: createCompilationStatistics({}),
      context: context(),
    });
    expect(result.ok).toBe(false);
  });

  it("is ok with only warning diagnostics", () => {
    const result = createCompilationResult({
      requestId: "r1",
      compilerId: "typescript",
      languageId: "typescript",
      rootDir: "/root",
      diagnostics: [
        createCompilerDiagnostic({
          code: CompilerDiagnosticCode.CompilerWarning,
          severity: "warning",
          message: "meh",
        }),
      ],
      statistics: createCompilationStatistics({}),
      context: context(),
    });
    expect(result.ok).toBe(true);
  });

  it("freezes list fields and deps", () => {
    const result = createCompilationResult({
      requestId: "r1",
      compilerId: "typescript",
      languageId: "typescript",
      rootDir: "/root",
      units: [unit()],
      dependencies: { "a.ts": ["b.ts"] },
      statistics: createCompilationStatistics({}),
      context: context(),
    });
    expect(Object.isFrozen(result.units)).toBe(true);
    expect(Object.isFrozen(result.dependencies)).toBe(true);
    expect(Object.isFrozen(result.dependencies["a.ts"])).toBe(true);
    expect(result.timestamp).toBeTypeOf("number");
  });
});

describe("createSourceMap", () => {
  it("forces version 3 and copies arrays", () => {
    const sources = ["a.ts"];
    const map = createSourceMap({ sources, names: ["x"], mappings: "AAAA", file: "a.js" });
    expect(map.version).toBe(3);
    expect(map.file).toBe("a.js");
    expect(map.sources).toEqual(["a.ts"]);
    expect(map.mappings).toBe("AAAA");
    expect(Object.isFrozen(map)).toBe(true);
  });
});

describe("createSyntaxTree", () => {
  it("computes node count and freezes nodes", () => {
    const tree = createSyntaxTree({
      languageId: "typescript",
      file: "a.ts",
      format: "typescript",
      root: {
        kind: "SourceFile",
        children: [{ kind: "FunctionDeclaration", name: "hello", children: [{ kind: "x" }] }],
      },
      native: { name: "typescript", version: "5.9.3" },
    });
    expect(tree.nodeCount).toBe(3);
    expect(tree.truncated).toBe(false);
    expect(tree.native?.version).toBe("5.9.3");
    expect(Object.isFrozen(tree.root)).toBe(true);
    expect(Object.isFrozen(tree.root.children)).toBe(true);
  });
});

describe("fingerprintCompileRequest", () => {
  it("is stable regardless of file order and option key order", () => {
    const a = fingerprintCompileRequest("ts", ["b.ts", "a.ts"], { b: 1, a: 2 });
    const b = fingerprintCompileRequest("ts", ["a.ts", "b.ts"], { a: 2, b: 1 });
    expect(a).toBe(b);
  });

  it("varies when the compiler, files or options change", () => {
    const base = fingerprintCompileRequest("ts", ["a.ts"], {});
    expect(fingerprintCompileRequest("js", ["a.ts"], {})).not.toBe(base);
    expect(fingerprintCompileRequest("ts", ["b.ts"], {})).not.toBe(base);
    expect(fingerprintCompileRequest("ts", ["a.ts"], { sourceMaps: true })).not.toBe(base);
  });
});

describe("hashContent", () => {
  it("produces a stable sha-1 hex digest", () => {
    expect(hashContent("hello")).toBe(hashContent("hello"));
    expect(hashContent("hello")).not.toBe(hashContent("world"));
    expect(hashContent("x")).toMatch(/^[0-9a-f]{40}$/);
  });
});
