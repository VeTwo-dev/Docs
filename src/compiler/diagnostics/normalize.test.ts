import { describe, it, expect } from "vitest";
import { CompilerDiagnosticCode } from "../contracts/diagnostics.js";
import {
  diagnosticFile,
  flattenMessageText,
  mapDiagnosticCode,
  mapDiagnosticSeverity,
  normalizeCompilerDiagnostic,
  normalizeCompilerDiagnostics,
  toCompilerRange,
  toOneBasedPosition,
} from "./normalize.js";

describe("mapDiagnosticSeverity", () => {
  it("maps error hints", () => {
    expect(mapDiagnosticSeverity("error")).toBe("error");
    expect(mapDiagnosticSeverity(1)).toBe("error");
    expect(mapDiagnosticSeverity(undefined)).toBe("error");
  });

  it("maps warning hints", () => {
    expect(mapDiagnosticSeverity("warning")).toBe("warning");
    expect(mapDiagnosticSeverity(2)).toBe("warning");
  });

  it("maps info hints", () => {
    expect(mapDiagnosticSeverity("info")).toBe("info");
    expect(mapDiagnosticSeverity(3)).toBe("info");
    expect(mapDiagnosticSeverity(4)).toBe("info");
  });
});

describe("flattenMessageText", () => {
  it("passes plain strings through", () => {
    expect(flattenMessageText("hello")).toBe("hello");
  });

  it("flattens TypeScript message chains", () => {
    expect(
      flattenMessageText({
        messageText: "Type 'A' is not assignable to type 'B'.",
        next: { messageText: "Property 'x' is missing." },
      }),
    ).toBe("Type 'A' is not assignable to type 'B'. Property 'x' is missing.");
  });

  it("stringifies unknown values", () => {
    expect(flattenMessageText(null)).toBe("null");
    expect(flattenMessageText(42)).toBe("42");
  });
});

describe("toOneBasedPosition", () => {
  it("converts a 0-based line/column to 1-based", () => {
    expect(toOneBasedPosition({ line: 0, column: 0 })).toEqual({ line: 1, column: 1 });
  });

  it("treats already 1-based positions as 1-based", () => {
    expect(toOneBasedPosition({ line: 1, column: 3 })).toEqual({ line: 1, column: 3 });
  });

  it("returns undefined for invalid positions", () => {
    expect(toOneBasedPosition({ line: "x", column: 1 })).toBe(undefined);
    expect(toOneBasedPosition(null)).toBe(undefined);
    expect(toOneBasedPosition(undefined)).toBe(undefined);
  });
});

describe("toCompilerRange", () => {
  it("builds a range from a loc", () => {
    const range = toCompilerRange({ loc: { line: 1, column: 0 }, end: 12 });
    expect(range).toEqual({
      start: { line: 1, column: 1 },
      end: { line: 1, column: 1, offset: 12 },
    });
  });

  it("builds a range from start/end positions", () => {
    const range = toCompilerRange({ start: { line: 0, column: 0 }, end: { line: 0, column: 4 } });
    expect(range).toEqual({
      start: { line: 1, column: 1 },
      end: { line: 1, column: 4 },
    });
  });

  it("returns undefined when no positions are usable", () => {
    expect(toCompilerRange(null)).toBe(undefined);
    expect(toCompilerRange({ message: "no positions" })).toBe(undefined);
  });
});

describe("mapDiagnosticCode", () => {
  it("maps Babel-style reasonCode errors to syntax-error", () => {
    expect(mapDiagnosticCode({ reasonCode: "UnexpectedToken" }, "error")).toBe(
      CompilerDiagnosticCode.SyntaxError,
    );
  });

  it("maps warnings and info to compiler-warning", () => {
    expect(mapDiagnosticCode({}, "warning")).toBe(CompilerDiagnosticCode.CompilerWarning);
    expect(mapDiagnosticCode({}, "info")).toBe(CompilerDiagnosticCode.CompilerWarning);
  });

  it("maps errors without reasonCode to compilation-failed", () => {
    expect(mapDiagnosticCode({}, "error")).toBe(CompilerDiagnosticCode.CompilationFailed);
  });
});

describe("diagnosticFile", () => {
  it("reads file.fileName, fileName, path or filename", () => {
    expect(diagnosticFile({ file: { fileName: "a.ts" } }, {})).toBe("a.ts");
    expect(diagnosticFile({ fileName: "b.ts" }, {})).toBe("b.ts");
    expect(diagnosticFile({ path: "c.ts" }, {})).toBe("c.ts");
    expect(diagnosticFile({ filename: "d.ts" }, {})).toBe("d.ts");
  });

  it("falls back to the default file", () => {
    expect(diagnosticFile({}, { defaultFile: "main.ts" })).toBe("main.ts");
    expect(diagnosticFile(null, { defaultFile: "main.ts" })).toBe("main.ts");
    expect(diagnosticFile({ message: "x" }, {})).toBe(undefined);
  });
});

describe("normalizeCompilerDiagnostic", () => {
  it("normalizes a Babel-style thrown error", () => {
    const diagnostic = normalizeCompilerDiagnostic(
      {
        message: "Unexpected token (1:0)",
        reasonCode: "UnexpectedToken",
        loc: { line: 1, column: 0 },
      },
      { compilerId: "javascript", languageId: "javascript", defaultFile: "a.js" },
    );
    expect(diagnostic).toMatchObject({
      code: CompilerDiagnosticCode.SyntaxError,
      severity: "error",
      compilerId: "javascript",
      languageId: "javascript",
      file: "a.js",
      range: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } },
    });
  });

  it("normalizes a TypeScript-style diagnostic with a message chain", () => {
    const diagnostic = normalizeCompilerDiagnostic({
      category: 1,
      code: 2322,
      messageText: { messageText: "Type 'number' is not assignable to type 'string'." },
    });
    expect(diagnostic?.severity).toBe("error");
    expect(diagnostic?.message).toBe("Type 'number' is not assignable to type 'string'.");
    expect(diagnostic?.related).toEqual(["2322"]);
  });

  it("returns null for unusable input", () => {
    expect(normalizeCompilerDiagnostic(null)).toBeNull();
    expect(normalizeCompilerDiagnostic(undefined)).toBeNull();
    expect(normalizeCompilerDiagnostic("nope")).toBeNull();
    expect(normalizeCompilerDiagnostic({})).toBeNull();
  });

  it("honours a pre-computed range", () => {
    const range = {
      start: Object.freeze({ line: 1, column: 1 }),
      end: Object.freeze({ line: 1, column: 5 }),
    };
    const diagnostic = normalizeCompilerDiagnostic(
      { message: "custom", range },
      { defaultFile: "f.ts" },
    );
    expect(diagnostic?.range).toEqual(range);
  });
});

describe("normalizeCompilerDiagnostics", () => {
  it("filters nulls and keeps valid diagnostics", () => {
    const list = normalizeCompilerDiagnostics(
      [{ message: "a" }, null, { message: "b", severity: 2 }],
      { defaultFile: "f.ts" },
    );
    expect(list).toHaveLength(2);
    expect(list.map((d) => d.severity)).toEqual(["error", "warning"]);
  });
});
