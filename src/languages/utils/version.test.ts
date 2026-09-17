import { describe, expect, it } from "vitest";
import { compareVersions, parseVersion, satisfiesVersion } from "./version.js";

describe("parseVersion", () => {
  it("parses numeric segments", () => {
    expect(parseVersion("1.2.3")).toEqual([1, 2, 3]);
    expect(parseVersion("2")).toEqual([2]);
    expect(parseVersion("1.2.3-beta.1")).toEqual([1, 2, 3]);
  });
});

describe("compareVersions", () => {
  it("compares major/minor/patch numerically", () => {
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
    expect(compareVersions("2.0.0", "1.9.9")).toBeGreaterThan(0);
    expect(compareVersions("1.0.1", "1.0.0")).toBeGreaterThan(0);
    expect(compareVersions("1.0.0", "1.1.0")).toBeLessThan(0);
  });

  it("treats pre-releases as lower than releases", () => {
    expect(compareVersions("1.0.0-beta", "1.0.0")).toBeLessThan(0);
    expect(compareVersions("1.0.0", "1.0.0-alpha")).toBeGreaterThan(0);
  });

  it("compares pre-releases against each other", () => {
    expect(compareVersions("1.0.0-alpha", "1.0.0-beta")).toBeLessThan(0);
    expect(compareVersions("1.0.0-beta", "1.0.0-beta")).toBe(0);
  });
});

describe("satisfiesVersion", () => {
  it("treats empty and bare requirements as equality", () => {
    expect(satisfiesVersion("1.2.3", "")).toBe(true);
    expect(satisfiesVersion("1.2.3", "1.2.3")).toBe(true);
    expect(satisfiesVersion("1.2.3", "1.2.4")).toBe(false);
    expect(satisfiesVersion("1.2.3", "=1.2.3")).toBe(true);
  });

  it("supports comparison operators", () => {
    expect(satisfiesVersion("1.5.0", ">=1.0.0")).toBe(true);
    expect(satisfiesVersion("0.9.0", ">=1.0.0")).toBe(false);
    expect(satisfiesVersion("1.0.0", ">1.0.0")).toBe(false);
    expect(satisfiesVersion("1.0.1", ">1.0.0")).toBe(true);
    expect(satisfiesVersion("1.0.0", "<1.0.1")).toBe(true);
    expect(satisfiesVersion("1.5.0", "<=1.0.0")).toBe(false);
  });

  it("supports caret and tilde ranges", () => {
    expect(satisfiesVersion("1.9.0", "^1.0.0")).toBe(true);
    expect(satisfiesVersion("2.0.0", "^1.0.0")).toBe(false);
    expect(satisfiesVersion("1.2.5", "~1.2.0")).toBe(true);
    expect(satisfiesVersion("1.3.0", "~1.2.0")).toBe(false);
  });

  it("rejects malformed requirements", () => {
    expect(satisfiesVersion("1.0.0", ">=abc")).toBe(false);
    expect(satisfiesVersion("1.0.0", ">=")).toBe(false);
  });
});
