import { describe, it, expect } from "vitest";
import { DEFAULT_TREE_LIMITS } from "../../shared/tree.js";
import { extractTsModuleSpecifiers } from "./dependencies.js";
import { loadTypeScript, scriptKindFor, TYPESCRIPT_EXTENSIONS } from "./native.js";
import { buildTypeScriptTree } from "./tree.js";
import { compileTypeScript } from "./compile.js";
import type { AdapterCompileInput } from "../../contracts/adapter.js";

const ts = await loadTypeScript();
if (ts === undefined) {
  throw new Error("typescript module is required for tests");
}

function input(overrides: Partial<AdapterCompileInput> = {}): AdapterCompileInput {
  return {
    rootDir: "/root",
    files: ["src/a.ts"],
    contents: { "src/a.ts": "export const value: number = 1;" },
    languageId: "typescript",
    requestId: "r1",
    ...overrides,
  };
}

describe("scriptKindFor", () => {
  it("maps extensions to the matching script kind", () => {
    expect(scriptKindFor("a.ts", ts)).toBe(ts.ScriptKind.TS);
    expect(scriptKindFor("a.tsx", ts)).toBe(ts.ScriptKind.TSX);
    expect(scriptKindFor("a.js", ts)).toBe(ts.ScriptKind.JS);
    expect(scriptKindFor("a.jsx", ts)).toBe(ts.ScriptKind.JSX);
    expect(scriptKindFor("a.mts", ts)).toBe(ts.ScriptKind.TS);
    expect(scriptKindFor("a.cts", ts)).toBe(ts.ScriptKind.TS);
    expect(scriptKindFor("a.d.ts", ts)).toBe(ts.ScriptKind.TS);
  });
});

describe("TYPESCRIPT_EXTENSIONS", () => {
  it("is frozen and covers TypeScript files", () => {
    expect(Object.isFrozen(TYPESCRIPT_EXTENSIONS)).toBe(true);
    expect(TYPESCRIPT_EXTENSIONS).toContain(".ts");
    expect(TYPESCRIPT_EXTENSIONS).toContain(".tsx");
    expect(TYPESCRIPT_EXTENSIONS).toContain(".mts");
    expect(TYPESCRIPT_EXTENSIONS).toContain(".cts");
  });
});

describe("extractTsModuleSpecifiers", () => {
  it("extracts import/export/require/dynamic-import specifiers", () => {
    const content = `
      import a from "./a";
      import * as b from "./b";
      export { x } from "./c";
      import d = require("./d");
      require("./e");
      const mod = import("./f");
      import "bare-pkg";
    `;
    const sourceFile = ts.createSourceFile(
      "src/index.ts",
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const specifiers = extractTsModuleSpecifiers(sourceFile, ts);
    expect(specifiers).toEqual(["./a", "./b", "./c", "./d", "./e", "./f", "bare-pkg"]);
  });
});

describe("buildTypeScriptTree", () => {
  it("builds a normalized tree with named nodes and ranges", () => {
    const sourceFile = ts.createSourceFile(
      "src/index.ts",
      "export function hello(): number { return 1; }",
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const tree = buildTypeScriptTree(sourceFile, ts, DEFAULT_TREE_LIMITS);
    expect(tree.languageId).toBe("typescript");
    expect(tree.format).toBe("typescript");
    expect(tree.file).toBe("src/index.ts");
    expect(tree.nodeCount).toBeGreaterThan(0);
    expect(tree.truncated).toBe(false);
    expect(tree.native?.name).toBe("typescript");
    expect(tree.native?.version).toBeTypeOf("string");
    expect(tree.root.kind).toBe("SourceFile");
    expect(tree.root.range?.start).toBeDefined();
    expect(Object.isFrozen(tree.root)).toBe(true);
  });

  it("marks tsx format for .tsx files", () => {
    const sourceFile = ts.createSourceFile(
      "src/Component.tsx",
      "export const c = <div>hi</div>;",
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const tree = buildTypeScriptTree(sourceFile, ts, DEFAULT_TREE_LIMITS);
    expect(tree.format).toBe("tsx");
  });
});

describe("compileTypeScript", () => {
  it("compiles files into units with dependencies and native version", async () => {
    const output = await compileTypeScript(
      input({
        files: ["src/a.ts", "src/b.ts"],
        contents: {
          "src/a.ts": 'import b from "./b";\nexport const a: number = 1;',
          "src/b.ts": "export const b = 2;",
        },
      }),
    );
    expect(output.units).toHaveLength(2);
    expect(output.failedFiles).toEqual([]);
    expect(output.dependencies["src/a.ts"]).toEqual(["src/b.ts"]);
    expect(output.nativeVersion).toBeTypeOf("string");
    for (const unit of output.units) {
      expect(unit.status).toBe("ok");
      expect(unit.syntaxTree).toBeDefined();
    }
  });
});
