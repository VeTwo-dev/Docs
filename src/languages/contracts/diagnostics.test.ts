import { describe, expect, it } from "vitest";
import { createDiagnostic, LanguageDiagnosticCode } from "./diagnostics.js";

describe("createDiagnostic", () => {
  it("builds a frozen diagnostic with required fields", () => {
    const diagnostic = createDiagnostic({
      code: LanguageDiagnosticCode.DuplicateRegistration,
      severity: "warning",
      message: "duplicate",
    });
    expect(diagnostic.code).toBe("duplicate-registration");
    expect(diagnostic.severity).toBe("warning");
    expect(diagnostic.message).toBe("duplicate");
    expect(Object.isFrozen(diagnostic)).toBe(true);
  });

  it("includes optional languageId and related arrays", () => {
    const diagnostic = createDiagnostic({
      code: LanguageDiagnosticCode.ConflictingAdapters,
      severity: "warning",
      message: "conflict",
      languageId: "typescript",
      related: ["javascript"],
    });
    expect(diagnostic.languageId).toBe("typescript");
    expect(diagnostic.related).toEqual(["javascript"]);
    expect(Object.isFrozen(diagnostic.related)).toBe(true);
  });

  it("omits absent optional fields", () => {
    const diagnostic = createDiagnostic({
      code: LanguageDiagnosticCode.InvalidCapability,
      severity: "error",
      message: "invalid",
    });
    expect("languageId" in diagnostic).toBe(false);
    expect("related" in diagnostic).toBe(false);
  });
});
