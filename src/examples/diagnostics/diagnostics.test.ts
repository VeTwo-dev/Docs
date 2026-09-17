import { describe, it, expect } from "vitest";
import { detectStaleExamples, detectExampleGaps, buildExampleDiagnostics } from "./index.js";
import type { Example, ExampleGap } from "../models/index.js";
import { createExample, createExampleProvenance, createExampleGap } from "../models/index.js";

function example(id: string, source: string, symbols: readonly string[] = []): Example {
  return createExample({
    id,
    title: id,
    type: "snippet",
    language: "ts",
    provenance: createExampleProvenance({ kind: "docs", source }),
    content: "const x = 1;",
    referencedSymbols: symbols,
  });
}

describe("detectStaleExamples", () => {
  it("flags examples whose source file is gone", () => {
    const findings = detectStaleExamples([example("a", "docs/old.md")], {
      existingFiles: new Set(),
      existingSymbols: new Set(),
    });
    expect(findings[0]?.missingFile).toBe("docs/old.md");
    expect(findings[0]?.evidence.length).toBeGreaterThan(0);
  });

  it("flags examples referencing removed symbols", () => {
    const findings = detectStaleExamples([example("b", "docs/guide.md", ["GoneSymbol"])], {
      existingFiles: new Set(["docs/guide.md"]),
      existingSymbols: new Set(),
    });
    expect(findings[0]?.missingSymbols).toEqual(["GoneSymbol"]);
  });

  it("keeps fresh examples", () => {
    const findings = detectStaleExamples([example("c", "docs/guide.md", ["AliveSymbol"])], {
      existingFiles: new Set(["docs/guide.md"]),
      existingSymbols: new Set(["AliveSymbol"]),
    });
    expect(findings).toHaveLength(0);
  });
});

describe("detectExampleGaps", () => {
  it("recommends gaps for important user-facing nodes without examples", () => {
    const gaps = detectExampleGaps(
      [example("a", "docs/x.md", ["Covered"])],
      [
        { id: "Covered", label: "Covered", userFacing: true, importance: 0.9 },
        { id: "Missing", label: "Missing", userFacing: true, importance: 0.8 },
      ],
    );
    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.relatedNodeId).toBe("Missing");
    expect(gaps[0]?.evidence.length).toBeGreaterThan(0);
  });

  it("skips non-user-facing and low-importance nodes", () => {
    const gaps = detectExampleGaps(
      [],
      [
        { id: "Internal", label: "Internal", userFacing: false, importance: 0.9 },
        { id: "Low", label: "Low", userFacing: true, importance: 0.2 },
      ],
    );
    expect(gaps).toHaveLength(0);
  });

  it("records candidate files and basic complexity for high-importance nodes", () => {
    const gaps = detectExampleGaps(
      [],
      [{ id: "Hot", label: "Hot", userFacing: true, importance: 0.9, file: "src/hot.ts" }],
    );
    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.recommendedComplexity).toBe("basic");
    expect(gaps[0]?.evidence).toContain("defined in src/hot.ts");
    expect(gaps[0]?.confidence).toBeGreaterThan(0.8);
  });

  it("recommends minimal complexity and applies a custom minimum", () => {
    const gaps = detectExampleGaps(
      [],
      [
        { id: "Warm", label: "Warm", userFacing: true, importance: 0.6 },
        { id: "Lukewarm", label: "Lukewarm", userFacing: true, importance: 0.55 },
      ],
      { minImportance: 0.6 },
    );
    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.relatedNodeId).toBe("Warm");
    expect(gaps[0]?.recommendedComplexity).toBe("minimal");
  });

  it("skips nodes covered by any example referencing the symbol", () => {
    const gaps = detectExampleGaps(
      [example("a", "docs/x.md", ["Covered"])],
      [{ id: "Covered", label: "Covered", userFacing: true, importance: 0.9 }],
    );
    expect(gaps).toHaveLength(0);
  });
});

describe("buildExampleDiagnostics", () => {
  it("summarizes extraction health", () => {
    const invalid = createExample({
      ...example("bad", "docs/bad.md"),
      validation: "invalid",
    });
    const diagnostics = buildExampleDiagnostics({
      examples: [invalid, example("good", "docs/good.md")],
      duplicateGroups: [],
      gaps: [] as readonly ExampleGap[],
    });
    expect(diagnostics.summary.total).toBe(2);
    expect(diagnostics.summary.invalid).toBe(1);
    expect(diagnostics.invalidExamples[0]?.id).toBe("bad");
  });

  it("counts stale, duplicate and gap entries in the report", () => {
    const stale = createExample({
      ...example("stale", "docs/gone.md"),
      validation: "stale",
    });
    const diagnostics = buildExampleDiagnostics({
      examples: [stale],
      duplicateGroups: [
        { duplicates: [stale, example("dup", "docs/dup.md")], canonical: stale.id },
      ],
      gaps: [
        createExampleGap({
          relatedNodeId: "Missing",
          importance: 0.8,
          missingExampleType: "production",
          recommendedComplexity: "basic",
          evidence: [],
          confidence: 0.8,
        }),
      ],
      staleFindings: [
        { exampleId: stale.id, missingFile: "docs/gone.md", missingSymbols: [], evidence: [] },
      ],
    });
    expect(diagnostics.summary).toMatchObject({ stale: 1, duplicateGroups: 1, gaps: 1 });
    expect(diagnostics.staleExamples).toHaveLength(1);
    expect(diagnostics.staleFindings).toHaveLength(1);
    expect(diagnostics.duplicateGroups).toHaveLength(1);
    expect(diagnostics.gaps).toHaveLength(1);
  });
});
