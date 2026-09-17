import { describe, it, expect } from "vitest";
import {
  REFERENCE_KINDS,
  createReference,
  createReferenceDiagnostic,
  emptyFileBindings,
  isModuleReference,
  isReferenceKind,
  isResolvedReference,
  isUnresolvedReference,
  type ReferenceDiagnosticCode,
} from "./index.js";

describe("reference models", () => {
  it("lists the universal kinds (core six preserved, expanded set)", () => {
    const core = ["import", "import-name", "export", "re-export", "heritage", "type-use"];
    for (const kind of core) {
      expect(REFERENCE_KINDS).toContain(kind);
    }
    expect(REFERENCE_KINDS).toEqual([
      ...core,
      "alias",
      "module",
      "package",
      "workspace",
      "dependency",
      "implements",
      "containment",
      "ownership",
      "composition",
      "call",
      "extends",
      "uses",
      "circular",
      "unknown",
    ]);
    expect(isReferenceKind("heritage")).toBe(true);
    expect(isReferenceKind("extends")).toBe(true);
    expect(isReferenceKind("nope")).toBe(false);
  });

  it("builds a frozen resolved reference", () => {
    const reference = createReference(
      { kind: "import-name", fromId: "m:a", name: "point", specifier: "./point", toId: "m:b" },
      "ref:import-name:m:a:point:./point:0",
    );
    expect(reference.resolved).toBe(true);
    expect(reference.kind).toBe("import-name");
    expect(reference.toId).toBe("m:b");
    expect(Object.isFrozen(reference)).toBe(true);
    expect(isResolvedReference(reference)).toBe(true);
    expect(isModuleReference(reference)).toBe(false);
    expect(isUnresolvedReference(reference)).toBe(false);
  });

  it("builds a module-level reference without a target symbol", () => {
    const reference = createReference(
      { kind: "import", fromId: "m:a", specifier: "./point", toFile: "src/point.ts" },
      "ref:import:m:a::./point:1",
    );
    expect(reference.resolved).toBe(true);
    expect(isModuleReference(reference)).toBe(true);
    expect(reference.toId).toBeUndefined();
  });

  it("builds an unresolved reference keeping its raw name", () => {
    const reference = createReference(
      { kind: "heritage", fromId: "c1", name: "Missing" },
      "ref:heritage:c1:Missing::0",
    );
    expect(reference.resolved).toBe(false);
    expect(isUnresolvedReference(reference)).toBe(true);
    expect(reference.name).toBe("Missing");
  });

  it("omits optional fields from the frozen shape", () => {
    const reference = createReference({ kind: "export", fromId: "m1", name: "a" }, "id");
    expect(reference.specifier).toBeUndefined();
    expect(reference.toId).toBeUndefined();
  });
});

describe("reference diagnostics", () => {
  it("builds a frozen diagnostic with optional fields", () => {
    const diagnostic = createReferenceDiagnostic({
      code: "unresolved-import",
      severity: "warning",
      message: "Nope",
      languageId: "typescript",
      resolverId: "typescript",
      file: "src/a.ts",
    });
    expect(diagnostic.code).toBe("unresolved-import");
    expect(diagnostic.severity).toBe("warning");
    expect(diagnostic.file).toBe("src/a.ts");
    expect(Object.isFrozen(diagnostic)).toBe(true);
  });

  it("recognizes error severities", () => {
    const error = createReferenceDiagnostic({
      code: "broken-symbol-metadata" as ReferenceDiagnosticCode,
      severity: "error",
      message: "x",
      languageId: "typescript",
    });
    expect(error.severity).toBe("error");
  });
});

describe("emptyFileBindings", () => {
  it("returns an immutable empty binding set", () => {
    const bindings = emptyFileBindings("src/a.ts");
    expect(bindings.file).toBe("src/a.ts");
    expect(bindings.imports).toEqual([]);
    expect(bindings.exportAliases).toEqual([]);
    expect(bindings.reExports).toEqual([]);
    expect(Object.isFrozen(bindings)).toBe(true);
  });
});
