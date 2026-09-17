import { describe, it, expect } from "vitest";
import { buildApiGraph } from "../graph.js";
import type { ApiSymbol } from "../models.js";

function makeSymbol(overrides: Partial<ApiSymbol> & { id: string; name: string }): ApiSymbol {
  return {
    qualifiedName: overrides.name,
    kind: "function",
    documentation: {
      summary: "",
      params: [],
      examples: [],
      throws: [],
      see: [],
      links: [],
      tags: {},
      raw: "",
    },
    sourceFile: "src/index.ts",
    line: 1,
    column: 1,
    exported: true,
    deprecated: false,
    boundary: "public",
    ...overrides,
  };
}

describe("buildApiGraph", () => {
  it("builds empty graph for empty symbols", () => {
    const graph = buildApiGraph([]);
    expect(graph.edges).toHaveLength(0);
  });

  it("creates extends edges", () => {
    const base = makeSymbol({ id: "base", name: "Base" });
    const child = makeSymbol({
      id: "child",
      name: "Child",
      kind: "class",
      extends: "Base",
    });
    const graph = buildApiGraph([base, child]);

    const edges = graph.outgoing("child", "extends");
    expect(edges).toHaveLength(1);
    expect(edges[0].to).toBe("base");
  });

  it("creates implements edges", () => {
    const iface = makeSymbol({ id: "iface", name: "Runnable", kind: "interface" });
    const impl = makeSymbol({
      id: "impl",
      name: "Task",
      kind: "class",
      implements: ["Runnable"],
    });
    const graph = buildApiGraph([iface, impl]);

    const edges = graph.outgoing("impl", "implements");
    expect(edges).toHaveLength(1);
    expect(edges[0].to).toBe("iface");
  });

  it("creates member-of edges", () => {
    const cls = makeSymbol({ id: "cls", name: "MyClass", kind: "class" });
    const method = makeSymbol({
      id: "method",
      name: "doWork",
      kind: "method",
      qualifiedName: "MyClass.doWork",
    });
    const graph = buildApiGraph([cls, method]);

    const edges = graph.outgoing("cls", "member-of");
    expect(edges).toHaveLength(1);
    expect(edges[0].to).toBe("method");
  });

  it("creates overloads edges", () => {
    const overload1 = makeSymbol({ id: "o1", name: "process", qualifiedName: "process:overload:0" });
    const overload2 = makeSymbol({ id: "o2", name: "process", qualifiedName: "process:overload:1" });
    const fn = makeSymbol({ id: "fn", name: "process", overloads: [overload1, overload2] });
    const graph = buildApiGraph([fn, overload1, overload2]);

    const edges = graph.outgoing("fn", "overloads");
    expect(edges).toHaveLength(2);
  });

  it("queries related symbols", () => {
    const a = makeSymbol({ id: "a", name: "A", kind: "interface" });
    const b = makeSymbol({ id: "b", name: "B", kind: "class", implements: ["A"] });
    const graph = buildApiGraph([a, b]);

    const relatedToA = graph.related("a");
    expect(relatedToA.some((s) => s.id === "b")).toBe(true);
  });

  it("queries subtypes", () => {
    const base = makeSymbol({ id: "base", name: "Base" });
    const child1 = makeSymbol({ id: "c1", name: "Child1", kind: "class", extends: "Base" });
    const child2 = makeSymbol({ id: "c2", name: "Child2", kind: "class", extends: "Base" });
    const graph = buildApiGraph([base, child1, child2]);

    const subtypes = graph.subtypes("base");
    expect(subtypes).toHaveLength(2);
    expect(subtypes.map((s) => s.id).sort()).toEqual(["c1", "c2"]);
  });

  it("queries supertypes", () => {
    const iface = makeSymbol({ id: "iface", name: "IFoo", kind: "interface" });
    const cls = makeSymbol({
      id: "cls",
      name: "Foo",
      kind: "class",
      implements: ["IFoo"],
    });
    const graph = buildApiGraph([iface, cls]);

    const supertypes = graph.supertypes("cls");
    expect(supertypes).toHaveLength(1);
    expect(supertypes[0].id).toBe("iface");
  });
});
