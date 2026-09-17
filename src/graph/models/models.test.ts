import { describe, it, expect } from "vitest";
import {
  createKnowledgeNode,
  createKnowledgeEdge,
  createKnowledgeGraph,
  isKnowledgeNodeKind,
  isKnowledgeEdgeKind,
} from "./index.js";

describe("KnowledgeNode", () => {
  it("freezes a node and carries optional detail", () => {
    const node = createKnowledgeNode({
      id: "m:point",
      kind: "module",
      label: "point",
      file: "src/point.ts",
      detail: "point",
    });
    expect(node).toEqual({
      id: "m:point",
      kind: "module",
      label: "point",
      file: "src/point.ts",
      detail: "point",
    });
    expect(Object.isFrozen(node)).toBe(true);
    expect(() => {
      (node as { label: string }).label = "other";
    }).toThrow();
  });

  it("omits undefined fields and exposes symbolKind on symbol nodes", () => {
    const node = createKnowledgeNode({
      id: "c:Point",
      kind: "symbol",
      label: "Point",
      symbolKind: "class",
    });
    expect(node.file).toBeUndefined();
    expect(node.symbolKind).toBe("class");
  });
});

describe("KnowledgeEdge", () => {
  it("builds a deterministic id and freezes the edge", () => {
    const edge = createKnowledgeEdge({
      from: "m:a",
      to: "m:point",
      kind: "imports",
      label: "./point",
      referenceId: "ref:import:m:a:::0",
    });
    expect(edge.id).toBe("m:a|imports|m:point");
    expect(Object.isFrozen(edge)).toBe(true);
  });
});

describe("KnowledgeGraph", () => {
  it("indexes nodes and edges and computes statistics", () => {
    const node = createKnowledgeNode({ id: "m:a", kind: "module", label: "a" });
    const edge = createKnowledgeEdge({ from: "m:a", to: "m:point", kind: "imports" });
    const graph = createKnowledgeGraph({
      nodes: [node],
      edges: [edge],
      resolvedReferenceCount: 1,
      unresolvedReferenceCount: 1,
    });

    expect(graph.findNode("m:a")).toBe(node);
    expect(graph.findNode("missing")).toBeUndefined();
    expect(graph.findEdge("m:a", "imports", "m:point")).toBe(edge);
    expect(graph.findEdge("m:a", "imports", "other")).toBeUndefined();
    expect(graph.outgoing("m:a")).toEqual([edge]);
    expect(graph.incoming("m:point")).toEqual([edge]);
    expect(graph.neighbors("m:a")).toEqual(["m:point"]);
    expect(graph.nodesByKind.get("module")).toEqual([node]);
    expect(graph.statistics).toMatchObject({
      nodeCount: 1,
      edgeCount: 1,
      resolvedReferenceCount: 1,
      unresolvedReferenceCount: 1,
      nodeKinds: { module: 1 },
      edgeKinds: { imports: 1 },
    });
  });

  it("freezes edges and statistic maps", () => {
    const graph = createKnowledgeGraph({
      nodes: [],
      edges: [],
      resolvedReferenceCount: 0,
      unresolvedReferenceCount: 0,
    });
    expect(Object.isFrozen(graph.edges)).toBe(true);
    expect(Object.isFrozen(graph.statistics.nodeKinds)).toBe(true);
    expect(Object.isFrozen(graph.statistics.edgeKinds)).toBe(true);
  });

  it("deduplicates nodes by id (last wins) and groups by kind", () => {
    const graph = createKnowledgeGraph({
      nodes: [
        createKnowledgeNode({ id: "n", kind: "module", label: "first" }),
        createKnowledgeNode({ id: "n", kind: "symbol", label: "second" }),
        createKnowledgeNode({ id: "m", kind: "module", label: "m" }),
      ],
      edges: [],
      resolvedReferenceCount: 0,
      unresolvedReferenceCount: 0,
    });
    expect(graph.findNode("n")?.label).toBe("second");
    expect(graph.nodesByKind.get("module")).toHaveLength(1);
    expect(graph.nodesByKind.get("symbol")).toHaveLength(1);
  });
});

describe("kind guards", () => {
  it("recognizes node and edge kinds", () => {
    expect(isKnowledgeNodeKind("module")).toBe(true);
    expect(isKnowledgeNodeKind("nonsense")).toBe(false);
    expect(isKnowledgeEdgeKind("references")).toBe(true);
    expect(isKnowledgeEdgeKind("nonsense")).toBe(false);
  });
});
