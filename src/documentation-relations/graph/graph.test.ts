import { describe, it, expect } from "vitest";
import { createRelationshipGraph } from "./index.js";
import { createDocumentationRelationship } from "../models/index.js";

function rel(from: string, to: string, kind: "relatedTo" | "nextStep" | "uses" = "relatedTo") {
  return createDocumentationRelationship({
    from,
    to,
    kind,
    label: `${from}->${to}`,
    source: "test",
  });
}

describe("createRelationshipGraph", () => {
  const relationships = [rel("a", "b"), rel("b", "c", "nextStep"), rel("c", "a", "uses")];
  const graph = createRelationshipGraph(relationships);

  it("exposes nodes, edges and lookups", () => {
    expect(graph.nodes).toEqual(expect.arrayContaining(["a", "b", "c"]));
    expect(graph.size).toBe(3);
    expect(graph.outgoing("a")[0]?.to).toBe("b");
    expect(graph.incoming("c").map((r) => r.from)).toContain("b");
    expect(graph.find("a", "relatedTo", "b")).toBeDefined();
    expect(graph.find("a", "nextStep", "b")).toBeUndefined();
  });

  it("computes neighbors", () => {
    expect(graph.neighbors("b")).toEqual(expect.arrayContaining(["a", "c"]));
  });

  it("filters by kind", () => {
    expect(graph.relationshipsOf("nextStep")).toHaveLength(1);
  });

  it("detects orphans", () => {
    const orphan = createRelationshipGraph([rel("a", "b")]);
    expect(orphan.connected()).toContain("a");
    const lonely = createRelationshipGraph([]);
    expect(lonely.orphans()).toHaveLength(0);
  });
});
