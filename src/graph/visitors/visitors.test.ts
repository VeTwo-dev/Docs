import { describe, it, expect } from "vitest";
import { createKnowledgeNode, createKnowledgeEdge, createKnowledgeGraph } from "../models/index.js";
import { edgeOfKind } from "../filters/index.js";
import {
  visitNodes,
  collectNodes,
  neighborsOf,
  ancestorsOf,
  childrenOf,
  leavesOf,
} from "./index.js";

function fixture() {
  const node = (id: string, kind: "project" | "package" | "module" | "symbol", label: string) =>
    createKnowledgeNode({ id, kind, label });
  const edge = (from: string, to: string, kind: "owns" | "references" | "imports") =>
    createKnowledgeEdge({ from, to, kind });

  return createKnowledgeGraph({
    nodes: [
      node("p", "project", "p"),
      node("pk", "package", "pk"),
      node("m:a", "module", "a"),
      node("m:b", "module", "b"),
      node("c:Circle", "symbol", "Circle"),
      node("c:Point", "symbol", "Point"),
    ],
    edges: [
      edge("p", "pk", "owns"),
      edge("pk", "m:a", "owns"),
      edge("pk", "m:b", "owns"),
      edge("m:a", "c:Circle", "owns"),
      edge("m:b", "c:Point", "owns"),
      edge("c:Circle", "c:Point", "references"),
      edge("m:a", "m:b", "imports"),
    ],
    resolvedReferenceCount: 2,
    unresolvedReferenceCount: 0,
  });
}

describe("visitNodes", () => {
  it("walks the graph pre-order, deduplicating visited nodes", () => {
    const graph = fixture();
    const seen: string[] = [];
    visitNodes(graph, "p", (id) => {
      seen.push(id);
    });
    expect(seen).toEqual(["pk", "m:a", "c:Circle", "c:Point", "m:b"]);
  });

  it("prunes a subtree when the visitor returns false", () => {
    const graph = fixture();
    const seen: string[] = [];
    visitNodes(graph, "p", (id) => {
      seen.push(id);
      return id !== "m:a";
    });
    expect(seen).toEqual(["pk", "m:a", "m:b", "c:Point"]);
  });

  it("honours a kind filter", () => {
    const graph = fixture();
    const seen: string[] = [];
    visitNodes(
      graph,
      "c:Circle",
      (id) => {
        seen.push(id);
      },
      { filter: edgeOfKind("references") },
    );
    expect(seen).toEqual(["c:Point"]);
  });

  it("walks post-order", () => {
    const graph = fixture();
    const seen: string[] = [];
    visitNodes(
      graph,
      "p",
      (id) => {
        seen.push(id);
      },
      { order: "post-order" },
    );
    expect(seen).toEqual(["c:Point", "c:Circle", "m:b", "m:a", "pk"]);
  });
});

describe("collectNodes", () => {
  it("collects every reachable node id", () => {
    const graph = fixture();
    const nodes = collectNodes(graph, "p");
    expect(nodes).toHaveLength(6);
    expect(nodes).toEqual(expect.arrayContaining(["pk", "m:a", "m:b", "c:Circle", "c:Point"]));
  });

  it("supports a filter", () => {
    const graph = fixture();
    expect(collectNodes(graph, "c:Circle", edgeOfKind("references"))).toEqual([
      "c:Circle",
      "c:Point",
    ]);
  });
});

describe("neighborhood helpers", () => {
  it("finds neighbors, children, leaves and ancestors", () => {
    const graph = fixture();
    expect(neighborsOf(graph, "pk")).toEqual(expect.arrayContaining(["p", "m:a", "m:b"]));
    expect(childrenOf(graph, "m:b")).toEqual(["c:Point"]);
    expect(childrenOf(graph, "c:Point")).toEqual([]);
    expect(leavesOf(graph, "p")).toEqual(expect.arrayContaining(["c:Circle", "c:Point"]));
    expect(leavesOf(graph, "c:Point")).toEqual(["c:Point"]);
    expect(ancestorsOf(graph, "c:Point")).toEqual(expect.arrayContaining(["m:b", "pk", "p"]));
    expect(ancestorsOf(graph, "c:Point")).toContain("c:Circle");
  });
});
