import { describe, it, expect } from "vitest";
import type { AdapterCompileInput } from "../../contracts/adapter.js";
import { DEFAULT_TREE_LIMITS } from "../../shared/tree.js";
import { compileJavaScript } from "./compile.js";
import { extractBabelModuleSpecifiers } from "./dependencies.js";
import { BABEL_PLUGINS, JAVASCRIPT_EXTENSIONS, loadBabelParser } from "./native.js";
import { buildBabelTree } from "./tree.js";

const parser = await loadBabelParser();
if (parser === undefined || parser.parse === undefined) {
  throw new Error("@babel/parser is required for tests");
}

function input(overrides: Partial<AdapterCompileInput> = {}): AdapterCompileInput {
  return {
    rootDir: "/root",
    files: ["src/a.js"],
    contents: { "src/a.js": "export const a = 1;" },
    languageId: "javascript",
    requestId: "r1",
    ...overrides,
  };
}

describe("JAVASCRIPT_EXTENSIONS", () => {
  it("is frozen and covers JavaScript files", () => {
    expect(Object.isFrozen(JAVASCRIPT_EXTENSIONS)).toBe(true);
    expect(JAVASCRIPT_EXTENSIONS).toEqual([".js", ".jsx", ".mjs", ".cjs"]);
  });
});

describe("BABEL_PLUGINS", () => {
  it("is frozen and includes jsx and decorators", () => {
    expect(Object.isFrozen(BABEL_PLUGINS)).toBe(true);
    expect(BABEL_PLUGINS).toContain("jsx");
    expect(BABEL_PLUGINS).toContain("decorators-legacy");
  });
});

describe("extractBabelModuleSpecifiers", () => {
  it("extracts import/export/require/dynamic-import specifiers", () => {
    const content = `
      import a from "./a";
      import * as b from "./b";
      export { x } from "./c";
      const d = require("./d");
      const m = import("./e");
      import "bare-pkg";
    `;
    const ast = parser.parse(content, { sourceType: "module", plugins: BABEL_PLUGINS });
    const specifiers = extractBabelModuleSpecifiers(ast["program"]["body"] as readonly unknown[]);
    expect(specifiers).toEqual(["./a", "./b", "./c", "./d", "./e", "bare-pkg"]);
  });
});

describe("buildBabelTree", () => {
  it("builds a normalized tree with the native handle only on the root", () => {
    const ast = parser.parse("const x = 1; function hello() { return x; }", {
      sourceType: "module",
      plugins: BABEL_PLUGINS,
    });
    const tree = buildBabelTree(ast, DEFAULT_TREE_LIMITS);
    expect(tree.languageId).toBe("javascript");
    expect(tree.format).toBe("ecmascript");
    expect(tree.native?.name).toBe("@babel/parser");
    expect(tree.nodeCount).toBeGreaterThan(0);
    expect(tree.root.kind).toBe("Program");
    expect(tree.root.raw).toBe(ast.program);
    expect(Object.isFrozen(tree.root)).toBe(true);
  });

  it("respects depth and node limits", () => {
    const ast = parser.parse("const obj = { a: { b: { c: { d: 1 } } } };", {
      sourceType: "module",
      plugins: BABEL_PLUGINS,
    });
    const limited = buildBabelTree(ast, { maxDepth: 2, maxNodes: 100 });
    expect(limited.nodeCount).toBeLessThan(DEFAULT_TREE_LIMITS.maxNodes);
  });
});

describe("compileJavaScript", () => {
  it("compiles files into ok units", async () => {
    const output = await compileJavaScript(
      input({
        files: ["src/a.js"],
        contents: { "src/a.js": "export const a = 1;" },
      }),
    );
    expect(output.units).toHaveLength(1);
    expect(output.units[0]!.status).toBe("ok");
    expect(output.units[0]!.syntaxTree).toBeDefined();
    expect(output.failedFiles).toEqual([]);
  });

  it("produces a normalized syntax-error diagnostic for bad input", async () => {
    const output = await compileJavaScript(
      input({
        contents: { "src/a.js": "const x = ;" },
      }),
    );
    expect(output.units[0]!.status).toBe("failed");
    expect(output.failedFiles).toEqual(["src/a.js"]);
    expect(output.units[0]!.diagnostics[0]?.code).toBe("syntax-error");
    expect(output.units[0]!.diagnostics[0]?.severity).toBe("error");
  });
});
