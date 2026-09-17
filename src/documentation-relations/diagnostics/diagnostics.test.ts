import { describe, it, expect } from "vitest";
import { detectRelationshipCycles, detectRelationshipGaps } from "./index.js";
import { createDocumentationRelationship } from "../models/index.js";

function rel(from: string, to: string, kind: "nextStep" | "relatedTo") {
  return createDocumentationRelationship({
    from,
    to,
    kind,
    label: `${from}->${to}`,
    source: "test",
  });
}

describe("detectRelationshipCycles", () => {
  it("detects hard cycles in directional kinds", () => {
    const cycles = detectRelationshipCycles([
      rel("a", "b", "nextStep"),
      rel("b", "c", "nextStep"),
      rel("c", "a", "nextStep"),
    ]);
    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles[0]?.severity).toBe("hard");
  });

  it("leaves acyclic directional chains alone", () => {
    const cycles = detectRelationshipCycles([rel("a", "b", "nextStep"), rel("b", "c", "nextStep")]);
    expect(cycles.filter((c) => c.severity === "hard")).toHaveLength(0);
  });

  it("reports soft cycles for undirected kinds", () => {
    const cycles = detectRelationshipCycles([
      rel("a", "b", "relatedTo"),
      rel("b", "a", "relatedTo"),
    ]);
    expect(cycles.length).toBeGreaterThan(0);
  });
});

describe("detectRelationshipGaps", () => {
  it("flags orphaned pages", () => {
    const gaps = detectRelationshipGaps(
      [
        { slug: "orphan", title: "Orphan", path: "docs/orphan.md" },
        { slug: "linked", title: "Linked", path: "docs/linked.md" },
      ],
      [rel("linked", "other", "relatedTo")],
    );
    const orphan = gaps.find((g) => g.page === "orphan");
    expect(orphan?.kind).toBe("orphan");
  });

  it("flags dead-ends (no outgoing)", () => {
    const gaps = detectRelationshipGaps(
      [{ slug: "end", title: "End", path: "docs/end.md" }],
      [rel("end", "other", "relatedTo")],
    );
    expect(gaps[0]?.kind).toBe("dead-end");
  });
});
