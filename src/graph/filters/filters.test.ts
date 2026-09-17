import { describe, it, expect } from "vitest";
import { nodeOfKind, edgeOfKind, symbolOfKind, acceptAllEdges, rejectAllEdges } from "./index.js";
import { createKnowledgeNode } from "../models/index.js";
import { createKnowledgeEdge } from "../models/index.js";

describe("node filters", () => {
  it("matches nodes by knowledge kind", () => {
    const module = createKnowledgeNode({ id: "m", kind: "module", label: "m" });
    const symbol = createKnowledgeNode({ id: "s", kind: "symbol", label: "s" });
    const filter = nodeOfKind("symbol");
    expect(filter(symbol)).toBe(true);
    expect(filter(module)).toBe(false);
  });

  it("matches multiple kinds", () => {
    const filter = nodeOfKind("project", "package");
    expect(filter(createKnowledgeNode({ id: "p", kind: "project", label: "p" }))).toBe(true);
    expect(filter(createKnowledgeNode({ id: "m", kind: "module", label: "m" }))).toBe(false);
  });

  it("matches nodes by backing symbol kind", () => {
    const filter = symbolOfKind("class");
    expect(
      filter(createKnowledgeNode({ id: "c", kind: "symbol", label: "C", symbolKind: "class" })),
    ).toBe(true);
    expect(
      filter(createKnowledgeNode({ id: "f", kind: "symbol", label: "F", symbolKind: "function" })),
    ).toBe(false);
    expect(filter(createKnowledgeNode({ id: "m", kind: "module", label: "m" }))).toBe(false);
  });
});

describe("edge filters", () => {
  it("matches edges by kind", () => {
    const edge = createKnowledgeEdge({ from: "a", to: "b", kind: "imports" });
    expect(edgeOfKind("imports")(edge)).toBe(true);
    expect(edgeOfKind("exports")(edge)).toBe(false);
  });

  it("acceptAllEdges matches everything", () => {
    const edge = createKnowledgeEdge({ from: "a", to: "b", kind: "references" });
    expect(acceptAllEdges(edge)).toBe(true);
  });

  it("rejectAllEdges matches nothing", () => {
    const edge = createKnowledgeEdge({ from: "a", to: "b", kind: "references" });
    expect(rejectAllEdges(edge)).toBe(false);
  });
});
