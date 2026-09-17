import { describe, expect, it } from "vitest";
import { clampConfidence, createDetectionResultModel } from "./detection.js";

describe("clampConfidence", () => {
  it("clamps values into 0..1", () => {
    expect(clampConfidence(1.5)).toBe(1);
    expect(clampConfidence(-0.5)).toBe(0);
    expect(clampConfidence(0.5)).toBe(0.5);
    expect(clampConfidence(Number.NaN)).toBe(0);
  });
});

describe("createDetectionResultModel", () => {
  it("builds a frozen model with defaults", () => {
    const model = createDetectionResultModel({ languageId: "typescript", confidence: 0.8 });
    expect(model.languageId).toBe("typescript");
    expect(model.confidence).toBe(0.8);
    expect(model.signals).toEqual([]);
    expect(model.frameworks).toEqual([]);
    expect(Object.isFrozen(model)).toBe(true);
  });

  it("deduplicates frameworks and copies signals", () => {
    const model = createDetectionResultModel({
      languageId: "js",
      confidence: 2,
      signals: [{ source: "extension", weight: 0.35, detail: ".js" }],
      frameworks: ["react", "react"],
    });
    expect(model.confidence).toBe(1);
    expect(model.frameworks).toEqual(["react"]);
    expect(model.signals).toHaveLength(1);
  });
});
