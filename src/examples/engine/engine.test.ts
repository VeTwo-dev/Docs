import { describe, it, expect } from "vitest";
import { extractExamples } from "./index.js";
import { createExampleExtractorRegistry } from "../registry/index.js";
import { createDefaultExtractors } from "../extractors/index.js";
import { createExampleCache, contentHash } from "../cache/index.js";
import { createKnowledgeNode, createKnowledgeGraph } from "../../graph/models/index.js";

function registry(): ReturnType<typeof createExampleExtractorRegistry> {
  const registry = createExampleExtractorRegistry();
  for (const extractor of createDefaultExtractors()) registry.register(extractor);
  return registry;
}

describe("extractExamples", () => {
  it("extracts, classifies, validates and scores examples end to end", () => {
    const result = extractExamples(
      [
        {
          path: "README.md",
          content:
            '# My Package\n\n## Usage\n\n```ts\nimport { greet } from "my-package";\ngreet("Ada");\n```\n',
        },
        {
          path: "docs/install.md",
          content: "```sh\nnpm install my-package\n```\n",
        },
      ],
      registry(),
      {
        evidence: {
          knownPackages: ["my-package"],
          knownSymbols: ["greet"],
        },
      },
    );

    expect(result.examples).toHaveLength(2);
    const usage = result.examples.find((e) => e.language === "ts");
    expect(usage?.type).toBe("snippet");
    expect(usage?.referencedPackages).toContain("my-package");
    expect(usage?.referencedSymbols).toContain("greet");
    expect(usage?.validation).toBe("valid");
    expect(usage?.importance).toBeGreaterThan(0);
    expect(Object.isFrozen(usage)).toBe(true);
  });

  it("flags invalid examples without removing them", () => {
    const result = extractExamples(
      [{ path: "docs/bad.md", content: "```ts\nfunction f() {\n```\n" }],
      registry(),
    );
    expect(result.examples[0]?.validation).toBe("invalid");
    expect(result.diagnostics.summary.invalid).toBe(1);
    expect(result.stats.invalid).toBe(1);
  });

  it("marks stale examples and reports findings", () => {
    const result = extractExamples(
      [{ path: "docs/old.md", content: "```ts\nconst x = 1;\n```\n" }],
      registry(),
      {
        currentState: { existingFiles: new Set(), existingSymbols: new Set() },
      },
    );
    expect(result.examples[0]?.validation).toBe("stale");
    expect(result.diagnostics.staleExamples).toHaveLength(1);
    expect(result.diagnostics.staleFindings[0]?.missingFile).toBe("docs/old.md");
  });

  it("detects gaps from user-facing candidates", () => {
    const result = extractExamples([], registry(), {
      gapCandidates: [{ id: "PublicApi", label: "PublicApi", userFacing: true, importance: 0.9 }],
    });
    expect(result.gaps[0]?.relatedNodeId).toBe("PublicApi");
  });

  it("serves unchanged files from the cache", () => {
    const cache = createExampleCache();
    const files = [{ path: "README.md", content: "# T\n\n```ts\nconst x = 1;\n```\n" }];
    const first = extractExamples(files, registry(), { cache });
    expect(first.stats.filesExtractedFromCache).toBe(0);

    const second = extractExamples(files, registry(), { cache });
    expect(second.stats.filesExtractedFromCache).toBe(1);
    expect(second.examples[0]?.id).toBe(first.examples[0]?.id);
  });

  it("invalidates the cache when content changes", () => {
    const cache = createExampleCache();
    extractExamples([{ path: "a.md", content: "one" }], registry(), { cache });
    expect(cache.isFresh("a.md", contentHash("one"))).toBe(true);
    expect(cache.isFresh("a.md", contentHash("two"))).toBe(false);
  });

  it("links examples to knowledge graph nodes", () => {
    const graph = createKnowledgeGraph({
      nodes: [
        createKnowledgeNode({
          id: "m:point",
          kind: "module",
          label: "point",
          file: "src/point.ts",
        }),
        createKnowledgeNode({
          id: "m:other",
          kind: "module",
          label: "otherthing",
          file: "src/other.ts",
        }),
      ],
      edges: [],
      resolvedReferenceCount: 0,
      unresolvedReferenceCount: 0,
    });

    const result = extractExamples(
      [
        {
          path: "README.md",
          content: '# Point\n\n```ts\nimport { point } from "./point";\n```\n',
        },
      ],
      registry(),
      { evidence: { graph } },
    );
    expect(result.examples[0]?.linkedNodes).toContain("m:point");
    expect(result.examples[0]?.linkedNodes).not.toContain("m:other");
  });

  it("skips duplicate, gap and stale diagnostics when disabled", () => {
    const result = extractExamples(
      [{ path: "docs/old.md", content: "```ts\nconst x = 1;\n```\n" }],
      registry(),
      {
        diagnostics: false,
        currentState: { existingFiles: new Set(), existingSymbols: new Set() },
        gapCandidates: [{ id: "PublicApi", label: "PublicApi", userFacing: true, importance: 0.9 }],
      },
    );
    expect(result.examples[0]?.validation).toBe("stale");
    expect(result.duplicateGroups).toEqual([]);
    expect(result.gaps).toEqual([]);
  });

  it("defaults confidence for extractors that omit it", () => {
    const bare = createExampleExtractorRegistry();
    bare.register({
      id: "bare",
      name: "Bare",
      provenanceKinds: ["docs"],
      supports: () => true,
      extract: () => [
        {
          title: "t",
          language: "ts",
          content: "const x = 1;",
          provenance: { kind: "docs", source: "docs/bare.md" },
        },
      ],
    });
    const result = extractExamples([{ path: "docs/bare.md", content: "const x = 1;" }], bare);
    expect(result.examples[0]?.confidence).toBeGreaterThan(0);
  });
});
