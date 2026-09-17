import { describe, it, expect } from "vitest";
import { createRelationshipResolverRegistry } from "./index.js";
import { createSharedEntityResolver } from "../resolvers/index.js";

describe("createRelationshipResolverRegistry", () => {
  it("registers, lists and gets resolvers", () => {
    const registry = createRelationshipResolverRegistry();
    const resolver = createSharedEntityResolver();
    registry.register(resolver);
    expect(registry.size).toBe(1);
    expect(registry.get("shared-entity")).toBe(resolver);
    expect(registry.list().map((r) => r.id)).toEqual(["shared-entity"]);
  });

  it("unregisters by id", () => {
    const registry = createRelationshipResolverRegistry();
    registry.register(createSharedEntityResolver());
    expect(registry.unregister("shared-entity")).toBe(true);
    expect(registry.unregister("nope")).toBe(false);
    expect(registry.size).toBe(0);
  });

  it("runs all resolvers over input", () => {
    const registry = createRelationshipResolverRegistry();
    registry.register(createSharedEntityResolver());
    const result = registry.resolve({
      pages: [
        { slug: "a", title: "A", path: "docs/a.md", symbols: ["x"] },
        { slug: "b", title: "B", path: "docs/b.md", symbols: ["x"] },
      ],
    });
    expect(result.length).toBeGreaterThan(0);
    expect(Object.isFrozen(result)).toBe(true);
  });
});
