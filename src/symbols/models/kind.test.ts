import { describe, it, expect } from "vitest";
import { SYMBOL_KINDS, isSymbolKind } from "./kind.js";

describe("SYMBOL_KINDS", () => {
  it("includes the universal vocabulary", () => {
    expect(SYMBOL_KINDS).toContain("project");
    expect(SYMBOL_KINDS).toContain("module");
    expect(SYMBOL_KINDS).toContain("class");
    expect(SYMBOL_KINDS).toContain("interface");
    expect(SYMBOL_KINDS).toContain("enum-member");
    expect(SYMBOL_KINDS).toContain("decorator");
    expect(SYMBOL_KINDS).toContain("unknown");
  });

  it("exposes framework-oriented reserved kinds", () => {
    expect(SYMBOL_KINDS).toContain("component");
    expect(SYMBOL_KINDS).toContain("hook");
    expect(SYMBOL_KINDS).toContain("route");
  });
});

describe("isSymbolKind", () => {
  it("accepts known kinds", () => {
    expect(isSymbolKind("class")).toBe(true);
    expect(isSymbolKind("property")).toBe(true);
  });

  it("rejects unknown kinds", () => {
    expect(isSymbolKind("banana")).toBe(false);
    expect(isSymbolKind("")).toBe(false);
  });
});
