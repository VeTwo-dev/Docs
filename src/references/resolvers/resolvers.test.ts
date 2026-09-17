import { describe, it, expect } from "vitest";
import type { CompilationUnit, SyntaxNode } from "../../compiler/index.js";
import {
  extractFileBindings,
  typescriptResolver,
  javascriptResolver,
  builtinResolvers,
} from "./index.js";

function root(children: readonly SyntaxNode[]): SyntaxNode {
  return { kind: "SourceFile", children };
}

function importDeclaration(specifier: string, children: readonly SyntaxNode[] = []): SyntaxNode {
  return { kind: "ImportDeclaration", moduleSpecifier: specifier, children };
}

function exportDeclaration(
  specifier: string | undefined,
  children: readonly SyntaxNode[] = [],
): SyntaxNode {
  return {
    kind: "ExportDeclaration",
    ...(specifier !== undefined ? { moduleSpecifier: specifier } : {}),
    children,
  };
}

describe("extractFileBindings", () => {
  it("recovers default, named and namespace imports", () => {
    const tree = root([
      importDeclaration("./a", [
        {
          kind: "ImportClause",
          children: [
            { kind: "ImportDefaultSpecifier", name: "def" },
            {
              kind: "NamedImports",
              children: [
                { kind: "ImportSpecifier", name: "local", propertyName: "imported" },
                { kind: "ImportSpecifier", name: "plain" },
              ],
            },
            { kind: "NamespaceImport", name: "ns" },
          ],
        },
      ]),
    ]);
    const bindings = extractFileBindings(tree, "src/x.ts");
    expect(bindings.imports).toEqual(
      expect.arrayContaining([
        { specifier: "./a", localName: "def", importedName: "default" },
        { specifier: "./a", localName: "local", importedName: "imported" },
        { specifier: "./a", localName: "plain", importedName: "plain" },
        { specifier: "./a", localName: "ns", importedName: "*" },
      ]),
    );
    expect(bindings.imports).toHaveLength(4);
  });

  it("recovers import-equals declarations as namespace imports", () => {
    const tree = root([{ kind: "ImportEqualsDeclaration", name: "foo", moduleSpecifier: "./foo" }]);
    const bindings = extractFileBindings(tree, "src/x.ts");
    expect(bindings.imports).toEqual([{ specifier: "./foo", localName: "foo", importedName: "*" }]);
  });

  it("splits local export aliases from re-export clauses", () => {
    const tree = root([
      exportDeclaration(undefined, [
        {
          kind: "ExportClause",
          children: [
            { kind: "ExportSpecifier", name: "b", propertyName: "a" },
            { kind: "ExportSpecifier", name: "c" },
          ],
        },
      ]),
      exportDeclaration("./mod", [
        {
          kind: "ExportClause",
          children: [{ kind: "ExportSpecifier", name: "x", propertyName: "y" }],
        },
      ]),
      exportDeclaration("./star", [{ kind: "NamespaceExport", name: "thing" }]),
    ]);
    const bindings = extractFileBindings(tree, "src/x.ts");
    expect(bindings.exportAliases).toEqual([
      { exportedName: "b", localName: "a" },
      { exportedName: "c", localName: "c" },
    ]);
    expect(bindings.reExports).toEqual([
      { exportedName: "x", localName: "y", specifier: "./mod" },
      { exportedName: "thing", localName: "*", specifier: "./star" },
    ]);
  });

  it("freezes all produced bindings", () => {
    const bindings = extractFileBindings(root([]), "src/x.ts");
    expect(Object.isFrozen(bindings)).toBe(true);
    expect(bindings.imports).toEqual([]);
  });
});

function unit(file: string, treeRoot: SyntaxNode): CompilationUnit {
  return {
    file,
    languageId: "typescript",
    compilerId: "typescript",
    status: "ok",
    syntaxTree: {
      languageId: "typescript",
      file,
      format: "typescript",
      root: treeRoot,
      nodeCount: 1,
      truncated: false,
    },
    diagnostics: [],
    hash: "h",
    compileTimeMs: 1,
  };
}

describe("builtin resolvers", () => {
  it("expose both built-ins with full capabilities", () => {
    expect(builtinResolvers.map((r) => r.metadata.id)).toEqual(["typescript", "javascript"]);
    expect(typescriptResolver.capabilities["import-bindings"]).toBe("full");
    expect(javascriptResolver.metadata.languageId).toBe("javascript");
  });

  it("extract bindings across units", () => {
    const tree = root([
      importDeclaration("./point", [
        { kind: "ImportClause", children: [{ kind: "ImportSpecifier", name: "point" }] },
      ]),
    ]);
    const output = typescriptResolver.extractBindings({
      rootDir: "/project",
      requestId: "r1",
      languageId: "typescript",
      resolverId: "typescript",
      units: [unit("src/a.ts", tree)],
    });
    expect(output.bindings["src/a.ts"]?.imports).toEqual([
      { specifier: "./point", localName: "point", importedName: "point" },
    ]);
    expect(output.statistics.files).toBe(1);
    expect(output.statistics.extractedFiles).toBe(1);
    expect(output.statistics.diagnosticsCount).toBe(0);
  });

  it("reports units without usable trees", () => {
    const broken: CompilationUnit = {
      file: "src/broken.ts",
      languageId: "typescript",
      compilerId: "typescript",
      status: "failed",
      diagnostics: [],
      hash: "h",
      compileTimeMs: 1,
    };
    const output = typescriptResolver.extractBindings({
      rootDir: "/project",
      requestId: "r1",
      languageId: "typescript",
      resolverId: "typescript",
      units: [broken],
    });
    expect(output.bindings).toEqual({});
    expect(output.diagnostics[0]?.code).toBe("broken-symbol-metadata");
    expect(output.statistics.diagnosticsCount).toBe(1);
  });
});
