import { describe, expect, it } from "vitest";
import { deepFreeze } from "./freeze.js";

describe("deepFreeze", () => {
  it("freezes plain objects deeply", () => {
    const value = { a: { b: [1, 2] }, c: "x" };
    const frozen = deepFreeze(value);
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.a)).toBe(true);
    expect(Object.isFrozen(frozen.a.b)).toBe(true);
  });

  it("freezes arrays and their elements", () => {
    const frozen = deepFreeze([{ x: 1 }, 2, "three"]);
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen[0])).toBe(true);
  });

  it("leaves functions and primitives untouched", () => {
    const fn = () => 1;
    expect(deepFreeze(fn)).toBe(fn);
    expect(deepFreeze(42)).toBe(42);
    expect(deepFreeze("str")).toBe("str");
    expect(deepFreeze(null)).toBe(null);
  });

  it("handles nested arrays inside objects and vice versa", () => {
    const frozen = deepFreeze({ list: [{ inner: [1] }] });
    expect(Object.isFrozen(frozen.list)).toBe(true);
    expect(Object.isFrozen(frozen.list[0])).toBe(true);
    expect(Object.isFrozen(frozen.list[0].inner)).toBe(true);
  });
});
