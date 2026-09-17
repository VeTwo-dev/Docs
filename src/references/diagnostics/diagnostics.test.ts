import { describe, it, expect } from "vitest";
import {
  detectUnresolvedReferences,
  referenceDiagnosticCodes,
  summarizeReferenceDiagnostics,
} from "./index.js";
import { createReference, createReferenceDiagnostic } from "../models/index.js";
import type { ReferenceGraph } from "../graph/index.js";

function symbol(id: string, file: string) {
  return { id, metadata: { location: { file } } };
}

function fakeGraph(references: readonly ReturnType<typeof createReference>[]): ReferenceGraph {
  return {
    references,
    symbols: new Map(),
    modules: new Map(),
    bySource: new Map(),
    byTarget: new Map(),
    byFile: new Map(),
    findSymbol: () => undefined,
    moduleOf: () => undefined,
    referencesOf: () => [],
    referencedBy: () => [],
    importsOf: () => [],
    exportsOf: () => [],
    dependenciesOf: () => [],
    dependentsOf: () => [],
  };
}

describe("detectUnresolvedReferences", () => {
  it("warns on relative imports and re-exports that miss", () => {
    const graph = fakeGraph([
      createReference({ kind: "import", fromId: "m1", specifier: "./missing" }, "id1"),
      createReference({ kind: "re-export", fromId: "m1", specifier: "./gone" }, "id2"),
    ]);
    const diagnostics = detectUnresolvedReferences(graph, {
      symbols: new Map([["m1", symbol("m1", "src/a.ts") as never]]),
      languageId: "typescript",
      resolverId: "typescript",
    });
    expect(diagnostics.map((d) => d.code).sort()).toEqual([
      "unresolved-import",
      "unresolved-re-export",
    ]);
    expect(diagnostics.every((d) => d.severity === "warning")).toBe(true);
    expect(diagnostics[0]?.file).toBe("src/a.ts");
  });

  it("ignores bare specifiers and resolved references", () => {
    const graph = fakeGraph([
      createReference({ kind: "import", fromId: "m1", specifier: "lodash" }, "id1"),
      createReference(
        { kind: "import", fromId: "m1", specifier: "./ok", toFile: "src/ok.ts" },
        "id2",
      ),
    ]);
    const diagnostics = detectUnresolvedReferences(graph, {
      symbols: new Map([["m1", symbol("m1", "src/a.ts") as never]]),
    });
    expect(diagnostics).toHaveLength(0);
  });

  it("reports unresolved exports and names as info", () => {
    const graph = fakeGraph([
      createReference({ kind: "export", fromId: "m1", name: "ghost" }, "id1"),
      createReference({ kind: "heritage", fromId: "c1", name: "Missing" }, "id2"),
    ]);
    const diagnostics = detectUnresolvedReferences(graph, {
      symbols: new Map([
        ["m1", symbol("m1", "src/a.ts") as never],
        ["c1", symbol("c1", "src/a.ts") as never],
      ]),
    });
    expect(diagnostics.map((d) => d.code)).toEqual(["unresolved-export", "unresolved-reference"]);
    expect(diagnostics.every((d) => d.severity === "info")).toBe(true);
  });
});

describe("summarizeReferenceDiagnostics", () => {
  it("counts by severity and code", () => {
    const summary = summarizeReferenceDiagnostics([
      createReferenceDiagnostic({
        code: "unresolved-import",
        severity: "warning",
        message: "x",
        languageId: "typescript",
      }),
      createReferenceDiagnostic({
        code: "unresolved-import",
        severity: "warning",
        message: "x",
        languageId: "typescript",
      }),
      createReferenceDiagnostic({
        code: "unresolved-export",
        severity: "info",
        message: "x",
        languageId: "typescript",
      }),
      createReferenceDiagnostic({
        code: "broken-symbol-metadata",
        severity: "info",
        message: "x",
        languageId: "typescript",
      }),
    ]);
    expect(summary.total).toBe(4);
    expect(summary.warnings).toBe(2);
    expect(summary.infos).toBe(2);
    expect(summary.errors).toBe(0);
    expect(summary.byCode["unresolved-import"]).toBe(2);
    expect(summary.bySeverity["info"]).toBe(2);
    expect(Object.isFrozen(summary)).toBe(true);
  });

  it("lists the reference diagnostic codes", () => {
    expect(referenceDiagnosticCodes()).toContain("missing-resolver");
  });
});
