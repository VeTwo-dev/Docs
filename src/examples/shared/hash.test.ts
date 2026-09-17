import { describe, it, expect } from "vitest";
import { hashString, stableId, normalizeForCompare, normalizePathForCompare } from "./index.js";

describe("hashString", () => {
  it("is deterministic and differs across inputs", () => {
    expect(hashString("abc")).toBe(hashString("abc"));
    expect(hashString("abc")).not.toBe(hashString("abd"));
    expect(hashString("")).toMatch(/^[0-9a-f]+$/);
  });
});

describe("stableId", () => {
  it("prefixes and is stable", () => {
    expect(stableId("example", "a", "b", "c")).toMatch(/^example:/);
    expect(stableId("gap", "x")).toBe(stableId("gap", "x"));
  });
});

describe("normalizeForCompare", () => {
  it("collapses whitespace and case for comparison", () => {
    expect(normalizeForCompare("  Hello   World\n\n")).toBe(normalizeForCompare("hello world"));
  });
});

describe("normalizePathForCompare", () => {
  it("normalizes path separators", () => {
    expect(normalizePathForCompare("a\\b\\c.ts")).toBe(normalizePathForCompare("a/b/c.ts"));
  });
});
