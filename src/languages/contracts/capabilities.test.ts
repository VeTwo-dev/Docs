import { describe, expect, it } from "vitest";
import { isKnownCapability, isValidCapabilityValue, KNOWN_CAPABILITIES } from "./capabilities.js";

describe("KNOWN_CAPABILITIES", () => {
  it("exposes the canonical capability keys", () => {
    expect(KNOWN_CAPABILITIES).toContain("scanning");
    expect(KNOWN_CAPABILITIES).toContain("compilation");
    expect(KNOWN_CAPABILITIES).toContain("parsing");
    expect(KNOWN_CAPABILITIES).toContain("ast");
    expect(KNOWN_CAPABILITIES).toContain("typeSystem");
    expect(KNOWN_CAPABILITIES).toContain("semanticTokens");
  });
});

describe("isKnownCapability", () => {
  it("recognises canonical capabilities", () => {
    expect(isKnownCapability("typeSystem")).toBe(true);
    expect(isKnownCapability("documentationComments")).toBe(true);
  });

  it("rejects custom and malformed capabilities", () => {
    expect(isKnownCapability("myCustomCapability")).toBe(false);
    expect(isKnownCapability("")).toBe(false);
  });
});

describe("isValidCapabilityValue", () => {
  it("accepts booleans for any capability", () => {
    expect(isValidCapabilityValue("ast", true)).toBe(true);
    expect(isValidCapabilityValue("ast", false)).toBe(true);
    expect(isValidCapabilityValue("custom", false)).toBe(true);
  });

  it("accepts level strings", () => {
    expect(isValidCapabilityValue("compilation", "none")).toBe(true);
    expect(isValidCapabilityValue("compilation", "basic")).toBe(true);
    expect(isValidCapabilityValue("compilation", "full")).toBe(true);
  });

  it("accepts string arrays for any capability", () => {
    expect(isValidCapabilityValue("documentationComments", ["jsdoc", "tsdoc"])).toBe(true);
    expect(isValidCapabilityValue("custom", ["a", "b"])).toBe(true);
  });

  it("accepts arbitrary strings and numbers only for custom capabilities", () => {
    expect(isValidCapabilityValue("customCapability", "some-value")).toBe(true);
    expect(isValidCapabilityValue("customCapability", 42)).toBe(true);
    expect(isValidCapabilityValue("parsing", "some-value")).toBe(false);
    expect(isValidCapabilityValue("parsing", 42)).toBe(false);
  });

  it("rejects nullish and object values", () => {
    expect(isValidCapabilityValue("scanning", undefined)).toBe(false);
    expect(isValidCapabilityValue("scanning", null)).toBe(false);
    expect(isValidCapabilityValue("scanning", {})).toBe(false);
    expect(isValidCapabilityValue("scanning", [1, 2])).toBe(false);
  });
});
