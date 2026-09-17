import { describe, it, expect } from "vitest";
import { emptyInitResult } from "./result.js";

describe("emptyInitResult", () => {
  it("builds an empty result scaffold for dry runs", () => {
    const result = emptyInitResult(true);
    expect(result.dryRun).toBe(true);
    expect(result.root).toBe("");
    expect(result.created).toEqual([]);
    expect(result.plan).toEqual([]);
  });

  it("builds a non-dry-run scaffold", () => {
    expect(emptyInitResult(false).dryRun).toBe(false);
  });
});
