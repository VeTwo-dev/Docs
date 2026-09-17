import { describe, it, expect } from "vitest";
import {
  validateExampleContent,
  validateExample,
  validateLanguage,
  isValidationStatus,
} from "./index.js";

describe("validateExampleContent", () => {
  it("accepts valid balanced code", () => {
    const result = validateExampleContent("const x = { a: 1 };", "ts");
    expect(result.status).toBe("valid");
  });

  it("flags unbalanced braces", () => {
    const result = validateExampleContent("function f() { return 1;", "ts");
    expect(result.status).toBe("invalid");
    expect(result.issues[0]?.code).toBe("UNBALANCED_BRACES");
  });

  it("ignores braces inside strings and comments", () => {
    const result = validateExampleContent('const s = "{" + "}"; // }', "ts");
    expect(result.status).toBe("valid");
  });

  it("flags empty bodies", () => {
    const result = validateExampleContent("   \n", "ts");
    expect(result.status).toBe("invalid");
    expect(result.issues.some((i) => i.code === "EMPTY")).toBe(true);
  });

  it("validates JSON structurally without executing", () => {
    expect(validateExampleContent('{"a": 1}', "json").status).toBe("valid");
    expect(validateExampleContent("{oops", "json").status).toBe("invalid");
  });

  it("warns on secret-like content", () => {
    const result = validateExampleContent("const key = 'sk-abc123def456';", "ts");
    expect(result.issues.some((i) => i.code === "SECRET_LIKE")).toBe(true);
  });

  it("warns on placeholder markers", () => {
    const result = validateExampleContent("// TODO finish this\nconst a = 1;", "ts");
    expect(result.issues.some((i) => i.code === "PLACEHOLDER")).toBe(true);
  });

  it("skips brace checks for markdown/text", () => {
    expect(validateExampleContent("# Just prose { unmatched", "markdown").status).toBe("valid");
  });

  it("notes truncated examples", () => {
    const result = validateExampleContent("const x = 1;\n...", "ts");
    expect(result.issues.some((i) => i.code === "TRUNCATED")).toBe(true);
    expect(result.issues.some((i) => i.code === "TRUNCATED" && i.severity === "info")).toBe(true);
  });
});

describe("validateExample", () => {
  it("re-validates an existing example", () => {
    const example = {
      id: "x",
      title: "x",
      type: "snippet" as const,
      language: "ts",
      provenance: { kind: "docs", source: "docs/a.md" },
      content: "function f() {",
    };
    const result = validateExample(example as Parameters<typeof validateExample>[0]);
    expect(result.status).toBe("invalid");
  });
});

describe("validateLanguage", () => {
  it("recognizes known languages", () => {
    expect(validateLanguage("ts")).toBe(true);
    expect(validateLanguage("TS")).toBe(true);
    expect(validateLanguage("python")).toBe(true);
  });

  it("rejects unknown languages", () => {
    expect(validateLanguage("not-a-language")).toBe(false);
  });
});

describe("isValidationStatus", () => {
  it("recognizes the status union", () => {
    expect(isValidationStatus("valid")).toBe(true);
    expect(isValidationStatus("stale")).toBe(true);
    expect(isValidationStatus("nope")).toBe(false);
  });
});
