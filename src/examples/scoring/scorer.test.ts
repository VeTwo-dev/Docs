import { describe, it, expect } from "vitest";
import { scoreExample } from "./index.js";
import type { Example, ExampleProvenanceKind } from "../models/index.js";
import { createExample } from "../models/index.js";

function example(overrides: Partial<Example> = {}): Example {
  return createExample({
    title: "t",
    type: "snippet",
    language: "ts",
    provenance: { kind: "docs", source: "docs/a.md" },
    content: "const x = 1;",
    ...overrides,
  });
}

describe("scoreExample", () => {
  it("scores a rich documented example highest", () => {
    const scored = scoreExample(
      example({
        provenance: { kind: "readme", source: "README.md" },
        type: "production",
        content: "a".repeat(1200),
        description: "how to use it",
        referencedSymbols: ["a", "b", "c"],
        referencedPackages: ["pkg"],
        validation: "valid",
        confidence: 1,
      }),
    );
    expect(scored.importance).toBeGreaterThan(0.8);
    expect(scored.confidence).toBe(1);
  });

  it("records every factor with an explanation", () => {
    const scored = scoreExample(example());
    expect(scored.factors.map((f) => f.name)).toEqual([
      "provenance",
      "linkage",
      "completeness",
      "context",
      "type",
      "validation",
    ]);
    expect(scored.explanation).toContain("provenance kind");
  });

  it("uses the provenance fallback weight for unknown kinds", () => {
    const scored = scoreExample(
      example({ provenance: { kind: "unknown-kind" as ExampleProvenanceKind, source: "x" } }),
    );
    const provenanceFactor = scored.factors.find((f) => f.name === "provenance");
    expect(provenanceFactor?.value).toBe(0.4);
  });

  it("penalizes fixtures, tests and internal types", () => {
    const fixture = scoreExample(
      example({ provenance: { kind: "fixtures", source: "__fixtures__/x.json" }, type: "fixture" }),
    );
    const test = scoreExample(
      example({ provenance: { kind: "tests", source: "a.test.ts" }, type: "test" }),
    );
    expect(fixture.importance).toBeLessThan(test.importance);
  });

  it("downgrades stale and invalid examples", () => {
    const fresh = scoreExample(example({ validation: "valid", confidence: 1 }));
    const stale = scoreExample(example({ validation: "stale", confidence: 1 }));
    const unverified = scoreExample(example({ validation: "unverified", confidence: 1 }));
    expect(stale.confidence).toBeLessThan(fresh.confidence);
    expect(unverified.confidence).toBeLessThan(fresh.confidence);
    expect(unverified.confidence).toBeGreaterThan(stale.confidence);
  });

  it("caps linkage and completeness at their ceiling", () => {
    const scored = scoreExample(
      example({ referencedSymbols: ["a", "b", "c", "d", "e"], content: "a".repeat(5000) }),
    );
    const linkage = scored.factors.find((f) => f.name === "linkage");
    const completeness = scored.factors.find((f) => f.name === "completeness");
    expect(linkage?.value).toBe(1);
    expect(completeness?.value).toBe(1);
  });

  it("boosts examples with a description", () => {
    const withDescription = scoreExample(example({ description: "context" }));
    const without = scoreExample(example());
    const context = (s: typeof withDescription) =>
      s.factors.find((f) => f.name === "context")?.value;
    expect(context(withDescription)).toBe(1);
    expect(context(without)).toBe(0.3);
  });
});
