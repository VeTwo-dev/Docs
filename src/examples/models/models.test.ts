import { describe, it, expect } from "vitest";
import {
  createExample,
  createExampleProvenance,
  createExampleGap,
  isExampleType,
  isExampleProvenanceKind,
  groupDuplicates,
  signatureOf,
} from "./index.js";

describe("createExample", () => {
  it("builds a frozen example with a stable id", () => {
    const example = createExample({
      title: "Usage",
      type: "snippet",
      language: "ts",
      provenance: createExampleProvenance({
        kind: "docs",
        source: "README.md",
        location: { startLine: 3, endLine: 5 },
        context: "Usage",
      }),
      content: "const a = 1;",
    });
    expect(example.id).toMatch(/^example:/);
    expect(example.validation).toBe("unverified");
    expect(example.classification.userFacing).toBe(true);
    expect(Object.isFrozen(example)).toBe(true);
    expect(Object.isFrozen(example.referencedSymbols)).toBe(true);
  });

  it("derives the same id from the same provenance and content", () => {
    const base = {
      title: "t",
      type: "snippet" as const,
      language: "ts",
      provenance: createExampleProvenance({ kind: "docs", source: "README.md" }),
      content: "const a = 1;",
    };
    expect(createExample(base).id).toBe(createExample(base).id);
  });
});

describe("createExampleProvenance", () => {
  it("records source, context and location", () => {
    const p = createExampleProvenance({
      kind: "readme",
      source: "README.md",
      location: { startLine: 1, endLine: 2 },
      context: "Intro",
    });
    expect(p).toMatchObject({ kind: "readme", source: "README.md", context: "Intro" });
    expect(Object.isFrozen(p)).toBe(true);
  });
});

describe("createExampleGap", () => {
  it("creates a gap recommendation, never content", () => {
    const gap = createExampleGap({
      relatedNodeId: "PublicApi",
      importance: 0.8,
      missingExampleType: "production",
    });
    expect(gap.id).toMatch(/^gap:/);
    expect(gap.recommendedComplexity).toBe("basic");
    expect(Object.isFrozen(gap)).toBe(true);
  });
});

describe("guards", () => {
  it("recognizes the type and provenance unions", () => {
    expect(isExampleType("cli")).toBe(true);
    expect(isExampleType("wat")).toBe(false);
    expect(isExampleProvenanceKind("tests")).toBe(true);
    expect(isExampleProvenanceKind("wat")).toBe(false);
  });
});

describe("groupDuplicates", () => {
  const base = {
    title: "t",
    type: "snippet" as const,
    language: "ts",
    provenance: createExampleProvenance({ kind: "docs", source: "README.md" }),
    content: 'import { greet } from "p";\ngreet("Ada");',
  };

  it("groups identical examples with a primary and alternates", () => {
    const a = createExample({ ...base });
    const b = createExample({
      ...base,
      provenance: createExampleProvenance({ kind: "docs", source: "guide.md" }),
    });
    const groups = groupDuplicates([a, b], () => 0.5);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.alternateIds).toContain(b.id);
    expect(Object.isFrozen(groups)).toBe(true);
  });

  it("leaves unique examples alone", () => {
    const a = createExample({ ...base, content: "const one = 1;" });
    const b = createExample({ ...base, content: "const two = 2;" });
    expect(groupDuplicates([a, b], () => 0.5)).toHaveLength(0);
  });

  it("computes signatures", () => {
    const a = createExample({ ...base });
    expect(signatureOf(a).pattern.length).toBeGreaterThan(0);
  });
});
