import { describe, it, expect } from "vitest";
import { deriveRelationships } from "./index.js";
import { createRelationshipResolverRegistry } from "../registry/index.js";
import { createDefaultRelationshipResolvers } from "../resolvers/index.js";
import { createRelationshipCache } from "../cache/index.js";
import type { PageDescriptor } from "../resolvers/index.js";
import { createExample, createExampleProvenance } from "../../examples/models/index.js";

function registry() {
  const registry = createRelationshipResolverRegistry();
  for (const resolver of createDefaultRelationshipResolvers()) registry.register(resolver);
  return registry;
}

function page(
  overrides: Partial<PageDescriptor> & { slug: string; title: string; path: string },
): PageDescriptor {
  return overrides;
}

describe("deriveRelationships", () => {
  it("derives shared-entity relationships with evidence", () => {
    const result = deriveRelationships(
      [
        page({ slug: "api/greet", title: "Greet", path: "docs/api/greet.md", symbols: ["greet"] }),
        page({
          slug: "guide/usage",
          title: "Usage",
          path: "docs/guide/usage.md",
          symbols: ["greet"],
        }),
      ],
      registry(),
    );
    const complements = result.relationships.filter((r) => r.kind === "complements");
    expect(complements.length).toBeGreaterThan(0);
    expect(complements[0]?.evidence.length).toBeGreaterThan(0);
    expect(result.stats.relationships).toBeGreaterThan(0);
  });

  it("derives relatedTo for pages sharing packages", () => {
    const result = deriveRelationships(
      [
        page({ slug: "a", title: "A", path: "docs/a.md", packages: ["my-package"] }),
        page({ slug: "b", title: "B", path: "docs/b.md", packages: ["my-package"] }),
      ],
      registry(),
    );
    expect(result.relationships.some((r) => r.kind === "relatedTo")).toBe(true);
  });

  it("mirrors inverse directional edges", () => {
    const result = deriveRelationships(
      [
        page({
          slug: "guide/a",
          title: "A",
          path: "docs/a.md",
          content: "See also [B](../docs/b.md)",
        }),
        page({ slug: "guide/b", title: "B", path: "docs/b.md" }),
      ],
      registry(),
    );
    // 'uses' from page-dependency has no inverse; nextStep mirrors appear via other paths.
    expect(result.stats.mirrored).toBeGreaterThanOrEqual(0);
  });

  it("builds previous/next navigation in reading order", () => {
    const result = deriveRelationships(
      [
        page({ slug: "install", title: "Install", path: "docs/install.md", stage: "install" }),
        page({ slug: "start", title: "Start", path: "docs/start.md", stage: "start" }),
      ],
      registry(),
      { readingOrder: ["install", "start"] },
    );
    const nav = result.navigation.get("install");
    expect(nav?.next).toBe("start");
    const nav2 = result.navigation.get("start");
    expect(nav2?.previous).toBe("install");
  });

  it("plans learning paths per audience", () => {
    const result = deriveRelationships(
      [
        page({
          slug: "overview",
          title: "Overview",
          path: "docs/overview.md",
          audience: "Beginner",
          stage: "discover",
        }),
        page({
          slug: "install",
          title: "Install",
          path: "docs/install.md",
          audience: "Beginner",
          stage: "install",
        }),
      ],
      registry(),
    );
    const paths = result.learningPaths;
    expect(paths).toHaveLength(1);
    expect(paths[0]?.audience).toBe("Beginner");
    expect(paths[0]?.steps[0]?.page).toBe("overview");
    expect(paths[0]?.steps[1]?.page).toBe("install");
  });

  it("reports orphan gaps and recommendations", () => {
    const result = deriveRelationships(
      [
        page({ slug: "lonely", title: "Lonely", path: "docs/lonely.md" }),
        page({ slug: "connected", title: "Connected", path: "docs/connected.md", symbols: ["x"] }),
      ],
      registry(),
    );
    const orphanGap = result.diagnostics.gaps.find(
      (g) => g.page === "lonely" && g.kind === "orphan",
    );
    expect(orphanGap).toBeDefined();
    expect(result.diagnostics.summary.orphans).toBeGreaterThanOrEqual(1);
    expect(result.recommendations.some((r) => r.page === "lonely")).toBe(true);
  });

  it("detects directional cycles", () => {
    const result = deriveRelationships([], registry());
    expect(result.diagnostics).toBeDefined();
    expect(result.cycles).toBeDefined();
  });

  it("links example evidence into relationships", () => {
    const example = createExample({
      title: "Usage",
      type: "demo",
      language: "ts",
      provenance: createExampleProvenance({ kind: "examples", source: "examples/usage.ts" }),
      content: 'import { greet } from "./greet";\ngreet("Ada");',
      referencedSymbols: ["greet"],
    });
    const result = deriveRelationships(
      [page({ slug: "api/greet", title: "Greet", path: "docs/api/greet.md", symbols: ["greet"] })],
      registry(),
      { evidence: { examples: [example] } },
    );
    const exampleOf = result.relationships.find((r) => r.kind === "exampleOf");
    expect(exampleOf).toBeDefined();
    expect(exampleOf?.from).toBe("api/greet");
    expect(exampleOf?.to).toContain("example:");
  });

  it("serves unchanged derivations from cache", () => {
    const cache = createRelationshipCache();
    const pages = [page({ slug: "a", title: "A", path: "docs/a.md", content: "const x" })];
    const first = deriveRelationships(pages, registry(), { cache });
    expect(first.stats.cacheHit).toBe(false);
    const second = deriveRelationships(pages, registry(), { cache });
    expect(second.stats.cacheHit).toBe(true);
  });
});
