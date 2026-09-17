import { describe, it, expect } from "vitest";
import { collectExampleEvidence } from "./index.js";
import { createKnowledgeGraph, createKnowledgeNode } from "../../graph/models/index.js";
import type { RawExample } from "../extractors/index.js";

function raw(content: string): RawExample {
  return {
    title: "t",
    language: "ts",
    content,
    provenance: { kind: "docs", source: "docs/a.md" },
    referencedSymbols: ["preSymbol"],
  };
}

describe("collectExampleEvidence", () => {
  it("merges detected and pre-recorded symbols and packages", () => {
    const evidence = collectExampleEvidence(raw('import { greet } from "pkg";'), {
      knownSymbols: ["greet", "unused"],
      knownPackages: ["pkg", "other"],
    });
    expect(evidence.referencedSymbols).toContain("greet");
    expect(evidence.referencedSymbols).toContain("preSymbol");
    expect(evidence.referencedPackages).toContain("pkg");
    expect(evidence.referencedPackages).not.toContain("other");
  });

  it("returns empty evidence lists when nothing is detected", () => {
    const evidence = collectExampleEvidence(raw("nothing here"), {});
    expect(evidence.referencedSymbols).toEqual(["preSymbol"]);
    expect(evidence.referencedPackages).toEqual([]);
    expect(evidence.linkedNodes).toEqual([]);
    expect(evidence.linkedPages).toEqual([]);
  });

  it("links graph nodes whose labels appear in the body", () => {
    const graph = createKnowledgeGraph({
      nodes: [
        createKnowledgeNode({ id: "m:a", kind: "module", label: "point", file: "src/point.ts" }),
        createKnowledgeNode({ id: "m:b", kind: "module", label: "other", file: "src/other.ts" }),
        createKnowledgeNode({ id: "m:c", kind: "module", file: "src/no-label.ts" }),
      ],
      edges: [],
      resolvedReferenceCount: 0,
      unresolvedReferenceCount: 0,
    });
    const evidence = collectExampleEvidence(raw("use point(x)"), { graph });
    expect(evidence.linkedNodes).toContain("m:a");
    expect(evidence.linkedNodes).not.toContain("m:b");
    expect(evidence.linkedNodes).not.toContain("m:c");
  });

  it("freezes all result collections", () => {
    const evidence = collectExampleEvidence(raw("x"), {});
    expect(Object.isFrozen(evidence.referencedSymbols)).toBe(true);
    expect(Object.isFrozen(evidence.referencedPackages)).toBe(true);
    expect(Object.isFrozen(evidence)).toBe(true);
  });
});
