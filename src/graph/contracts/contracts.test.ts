import { describe, it, expect } from "vitest";
import { createGraphContributor } from "./index.js";
import type { GraphBuildContext, GraphContribution } from "./index.js";

describe("createGraphContributor", () => {
  it("builds a frozen contributor with defaulted metadata", () => {
    let seen: GraphBuildContext | undefined;
    const contributes = (context: GraphBuildContext): GraphContribution => {
      seen = context;
      return { nodes: [], edges: [] };
    };
    const contributor = createGraphContributor({
      id: "mine",
      capabilities: { nodeKinds: ["symbol"], edgeKinds: ["references"] },
      contributes,
    });

    expect(contributor.id).toBe("mine");
    expect(contributor.metadata).toEqual({});
    expect(contributor.capabilities).toEqual({ nodeKinds: ["symbol"], edgeKinds: ["references"] });
    expect(contributor.contributes).toBe(contributes);
    expect(Object.isFrozen(contributor)).toBe(true);
    expect(Object.isFrozen(contributor.capabilities.nodeKinds)).toBe(true);

    const context = { rootDir: "/p", symbols: new Map(), modules: new Map(), references: [] };
    contributor.contributes(context);
    expect(seen).toBe(context);
  });

  it("keeps supplied metadata and freezes nested arrays", () => {
    const contributor = createGraphContributor({
      id: "mine",
      metadata: { name: "Mine", description: "desc" },
      capabilities: { nodeKinds: ["module"], edgeKinds: ["imports"] },
      contributes: () => ({ nodes: [], edges: [] }),
    });
    expect(contributor.metadata).toEqual({ name: "Mine", description: "desc" });
    expect(() => {
      (contributor.capabilities.nodeKinds as string[]).push("project");
    }).toThrow();
  });
});
