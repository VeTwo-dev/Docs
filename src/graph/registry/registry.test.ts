import { describe, it, expect } from "vitest";
import { createGraphContributor } from "../contracts/index.js";
import { createGraphContributorRegistry, MAX_GRAPH_CONTRIBUTORS } from "./index.js";

const contributor = (id: string) =>
  createGraphContributor({
    id,
    capabilities: { nodeKinds: ["symbol"], edgeKinds: ["references"] },
    contributes: () => ({ nodes: [], edges: [] }),
  });

describe("GraphContributorRegistry", () => {
  it("registers, resolves, lists and unregisters contributors", () => {
    const registry = createGraphContributorRegistry();
    registry.register(contributor("a"));
    registry.register(contributor("b"));

    expect(registry.size).toBe(2);
    expect(registry.resolve("a")?.id).toBe("a");
    expect(registry.resolve("missing")).toBeUndefined();
    expect(registry.list().map((c) => c.id)).toEqual(["a", "b"]);

    expect(registry.unregister("a")).toBe(true);
    expect(registry.unregister("a")).toBe(false);
    expect(registry.resolve("a")).toBeUndefined();
    expect(registry.list().map((c) => c.id)).toEqual(["b"]);
  });

  it("rejects duplicate ids", () => {
    const registry = createGraphContributorRegistry();
    registry.register(contributor("a"));
    expect(() => registry.register(contributor("a"))).toThrow(
      "Graph contributor already registered: a",
    );
  });

  it("rejects registration beyond the cap", () => {
    const registry = createGraphContributorRegistry();
    for (let index = 0; index < MAX_GRAPH_CONTRIBUTORS; index += 1) {
      registry.register(contributor(`c${index}`));
    }
    expect(() => registry.register(contributor("overflow"))).toThrow(
      `Too many graph contributors (max ${MAX_GRAPH_CONTRIBUTORS})`,
    );
  });

  it("clears all contributors", () => {
    const registry = createGraphContributorRegistry();
    registry.register(contributor("a"));
    registry.clear();
    expect(registry.size).toBe(0);
    expect(registry.list()).toEqual([]);
  });
});
