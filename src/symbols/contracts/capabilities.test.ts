import { describe, it, expect } from "vitest";
import { KNOWN_SYMBOL_CAPABILITIES, isKnownSymbolCapability } from "./capabilities.js";

describe("KNOWN_SYMBOL_CAPABILITIES", () => {
  it("declares the standard capabilities", () => {
    expect(KNOWN_SYMBOL_CAPABILITIES).toContain("documents");
    expect(KNOWN_SYMBOL_CAPABILITIES).toContain("generics");
    expect(KNOWN_SYMBOL_CAPABILITIES).toContain("overloads");
    expect(KNOWN_SYMBOL_CAPABILITIES).toContain("re-exports");
    expect(KNOWN_SYMBOL_CAPABILITIES).toContain("incremental");
    expect(KNOWN_SYMBOL_CAPABILITIES).toContain("parallel");
  });
});

describe("isKnownSymbolCapability", () => {
  it("accepts known capabilities", () => {
    expect(isKnownSymbolCapability("documents")).toBe(true);
    expect(isKnownSymbolCapability("barrels")).toBe(true);
  });

  it("rejects unknown capabilities", () => {
    expect(isKnownSymbolCapability("wizardry")).toBe(false);
  });
});
