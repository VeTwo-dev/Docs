import { describe, it, expect } from "vitest";
import { stableHash } from "./hash.js";

describe("stableHash", () => {
  it("is deterministic for the same parts", () => {
    expect(stableHash("ts", "src/index.ts", "demo")).toBe(stableHash("ts", "src/index.ts", "demo"));
  });

  it("differs when parts differ", () => {
    expect(stableHash("ts", "a.ts")).not.toBe(stableHash("ts", "b.ts"));
  });

  it("is order-insensitive for arrays", () => {
    expect(stableHash(["a", "b"])).toBe(stableHash(["b", "a"]));
  });

  it("normalizes undefined and null to empty segments", () => {
    expect(stableHash(undefined)).toBe(stableHash(""));
    expect(stableHash(null)).toBe(stableHash(""));
  });

  it("includes numbers and booleans", () => {
    expect(stableHash("overload", 0)).toBe(stableHash("overload", 0));
    expect(stableHash("overload", 0)).not.toBe(stableHash("overload", 1));
  });
});
