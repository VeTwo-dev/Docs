import { describe, expect, it } from "vitest";
import {
  capabilityLevel,
  capabilityValue,
  declaredCapabilities,
  hasAnyCapability,
  hasCapability,
  validateCapabilities,
} from "./capabilities.js";

const caps = {
  scanning: true,
  compilation: "full",
  parsing: "basic",
  ast: false,
  documentationComments: ["jsdoc", "tsdoc"],
};

describe("capabilityLevel", () => {
  it("maps values to levels", () => {
    expect(capabilityLevel(caps, "scanning")).toBe(2);
    expect(capabilityLevel(caps, "compilation")).toBe(2);
    expect(capabilityLevel(caps, "parsing")).toBe(1);
    expect(capabilityLevel(caps, "ast")).toBe(0);
    expect(capabilityLevel(caps, "macros")).toBe(0);
  });

  it("treats string arrays as partial", () => {
    expect(capabilityLevel(caps, "documentationComments")).toBe(1);
  });
});

describe("hasCapability / hasAnyCapability", () => {
  it("reports declarations above none", () => {
    expect(hasCapability(caps, "scanning")).toBe(true);
    expect(hasCapability(caps, "ast")).toBe(false);
    expect(hasCapability(caps, "missing")).toBe(false);
  });

  it("matches any of a list", () => {
    expect(hasAnyCapability(caps, ["ast", "parsing"])).toBe(true);
    expect(hasAnyCapability(caps, ["ast", "macros"])).toBe(false);
  });
});

describe("declaredCapabilities", () => {
  it("lists declared names, dropping undefined", () => {
    expect(declaredCapabilities({ a: true, b: undefined, c: "basic" })).toEqual(["a", "c"]);
  });
});

describe("validateCapabilities", () => {
  it("returns no diagnostics for valid declarations", () => {
    expect(validateCapabilities(caps, "typescript")).toEqual([]);
  });

  it("flags invalid values for known capabilities", () => {
    const diagnostics = validateCapabilities({ parsing: 42, ast: {} }, "typescript");
    expect(diagnostics).toHaveLength(2);
    expect(diagnostics[0]?.code).toBe("invalid-capability");
    expect(diagnostics[0]?.languageId).toBe("typescript");
  });

  it("allows arbitrary values for custom capabilities", () => {
    expect(validateCapabilities({ myFeature: 42, other: "str" }, "x")).toEqual([]);
  });

  it("ignores undefined declarations", () => {
    expect(validateCapabilities({ scanning: undefined }, "x")).toEqual([]);
  });
});

describe("capabilityValue", () => {
  it("returns the declared value or the fallback", () => {
    expect(capabilityValue(caps, "scanning", false)).toBe(true);
    expect(capabilityValue(caps, "missing", "none")).toBe("none");
  });
});
