import { describe, it, expect } from "vitest";
import {
  buildDocumentationIntelligence,
  createExampleContext,
  createExampleGapContext,
  createPageRelationshipContext,
  createLearningPathContext,
  createDocumentationPlanningContext,
  buildSkillIntelligenceManifest,
  SKILL_IDENTIFIER,
  SKILL_MANAGED_SECTIONS,
} from "./index.js";
import type { PageDescriptor } from "../documentation-relations/resolvers/index.js";
import {
  createExample,
  createExampleProvenance,
  createExampleGap,
} from "../examples/models/index.js";
import {
  createLearningPath,
  createDocumentationRecommendation,
} from "../documentation-relations/models/index.js";
import { buildExampleDiagnostics } from "../examples/diagnostics/index.js";
import { buildRelationshipDiagnostics } from "../documentation-relations/diagnostics/index.js";
import type { DocumentationIntelligence } from "./index.js";

function page(
  overrides: Partial<PageDescriptor> & { slug: string; title: string; path: string },
): PageDescriptor {
  return overrides;
}

const README = '# Demo\n\n## Usage\n\n```ts\nimport { greet } from "demo";\ngreet("Ada");\n```\n';

describe("buildDocumentationIntelligence", () => {
  it("aggregates example extraction and relationship derivation", () => {
    const intelligence = buildDocumentationIntelligence({
      files: [{ path: "README.md", content: README }],
      pages: [
        page({ slug: "api/greet", title: "Greet", path: "docs/api/greet.md", symbols: ["greet"] }),
      ],
      exampleOptions: { evidence: { knownSymbols: ["greet"], knownPackages: ["demo"] } },
    });

    expect(intelligence.examples.length).toBeGreaterThan(0);
    expect(intelligence.summary.examples).toBe(intelligence.examples.length);
    expect(intelligence.relationships.some((r) => r.kind === "exampleOf")).toBe(true);
    expect(intelligence.navigation.has("api/greet")).toBe(true);
    expect(intelligence.summary.filesScanned).toBe(1);
  });

  it("accepts pre-extracted examples", () => {
    const example = createExample({
      title: "Usage",
      type: "demo",
      language: "ts",
      provenance: createExampleProvenance({ kind: "examples", source: "examples/usage.ts" }),
      content: 'greet("Ada")',
      referencedSymbols: ["greet"],
    });
    const intelligence = buildDocumentationIntelligence({
      examples: [example],
      pages: [
        page({ slug: "api/greet", title: "Greet", path: "docs/api/greet.md", symbols: ["greet"] }),
      ],
    });
    expect(intelligence.examples).toHaveLength(1);
    expect(intelligence.relationships.some((r) => r.kind === "exampleOf")).toBe(true);
  });
});

describe("createExampleContext", () => {
  it("returns structured evidence, never prompts", () => {
    const example = createExample({
      title: "t",
      type: "cli",
      language: "bash",
      provenance: createExampleProvenance({ kind: "cli", source: "scripts/build.sh" }),
      content: "npm run build",
      referencedPackages: ["npm"],
    });
    const ctx = createExampleContext(example);
    expect(ctx.kind).toBe("example");
    expect(ctx.content).toBe("npm run build");
    expect(ctx.provenance.source).toBe("scripts/build.sh");
    expect(Object.isFrozen(ctx)).toBe(true);
  });
});

describe("createExampleGapContext", () => {
  it("wraps gap evidence", () => {
    const gap = createExampleGap({
      relatedNodeId: "PublicApi",
      evidence: ["no example covers PublicApi"],
    });
    const ctx = createExampleGapContext(gap);
    expect(ctx.kind).toBe("gap");
    expect(ctx.evidence[0]).toContain("PublicApi");
  });
});

describe("createPageRelationshipContext", () => {
  it("summarizes outgoing relationships", () => {
    const ctx = createPageRelationshipContext(
      page({ slug: "guide/a", title: "A", path: "docs/a.md" }),
      undefined,
      [
        {
          id: "rel:1",
          from: "guide/a",
          to: "guide/b",
          kind: "relatedTo",
          label: "Related to B",
          evidence: ["shares symbol x"],
          confidence: 0.8,
          weight: 0.6,
          source: "shared-entity",
        },
      ],
    );
    expect(ctx.related[0]?.to).toBe("guide/b");
    expect(ctx.evidence).toContain("shares symbol x");
  });

  it("sorts outgoing relationships, fills navigation and see-also", () => {
    const ctx = createPageRelationshipContext(
      page({ slug: "guide/a", title: "A", path: "docs/a.md" }),
      {
        previous: "guide/start",
        next: "guide/b",
        breadcrumbs: ["overview", "guide"],
      },
      [
        {
          id: "rel:low",
          from: "guide/a",
          to: "guide/c",
          kind: "relatedTo",
          label: "C",
          evidence: ["weak link"],
          confidence: 0.5,
          weight: 0.2,
          source: "shared-entity",
        },
        {
          id: "rel:high",
          from: "guide/a",
          to: "guide/d",
          kind: "relatedTo",
          label: "D",
          evidence: ["strong link"],
          confidence: 0.9,
          weight: 0.9,
          source: "shared-entity",
        },
      ],
    );
    expect(ctx.related[0]?.to).toBe("guide/d");
    expect(ctx.previous).toBe("guide/start");
    expect(ctx.next).toBe("guide/b");
    expect(ctx.breadcrumbs).toEqual(["overview", "guide"]);
    expect(ctx.seeAlso).toEqual(["guide/c", "guide/d"]);
  });
});

describe("createLearningPathContext / createDocumentationPlanningContext", () => {
  it("builds planning context from the aggregate", () => {
    const intelligence = buildDocumentationIntelligence({
      pages: [
        page({
          slug: "overview",
          title: "Overview",
          path: "docs/overview.md",
          audience: "Beginner",
          stage: "discover",
        }),
      ],
    });
    const planning = createDocumentationPlanningContext(intelligence);
    expect(planning.kind).toBe("planning");
    expect(planning.summary.examples).toBeGreaterThanOrEqual(0);

    const path = createLearningPath({
      title: "Beginner learning path",
      audience: "Beginner",
      steps: [{ page: "overview", stage: "discover", label: "Overview" }],
    });
    const pathCtx = createLearningPathContext(path);
    expect(pathCtx.kind).toBe("learning-path");
  });

  it("ranks top examples and renders cycles, gaps and recommendations", () => {
    const examples = Array.from({ length: 12 }, (_, i) =>
      createExample({
        title: `Example ${i}`,
        type: "snippet",
        language: "ts",
        provenance: createExampleProvenance({ kind: "docs", source: `docs/e${i}.md` }),
        content: `const v${i} = ${i};`,
        importance: i / 12,
      }),
    );
    const base = buildDocumentationIntelligence({ examples, pages: [] });
    const exampleDiagnostics = buildExampleDiagnostics({ examples, duplicateGroups: [], gaps: [] });
    const relationshipDiagnostics = buildRelationshipDiagnostics({
      relationships: [],
      cycles: [],
      gaps: [],
    });
    const intelligence: DocumentationIntelligence = {
      ...base,
      exampleDiagnostics,
      relationshipDiagnostics,
      cycles: [
        {
          relationshipIds: ["r1", "r2"],
          pages: ["guide/a", "guide/b", "guide/a"],
          kind: "nextStep",
          severity: "hard",
        },
      ],
      recommendations: [
        createDocumentationRecommendation({ page: "guide/a", action: "link to guide/b" }),
      ],
      learningPaths: [
        createLearningPath({
          title: "Beginner path",
          audience: "Beginner",
          steps: [{ page: "guide/a", stage: "discover", label: "A" }],
        }),
      ],
      exampleGaps: [createExampleGap({ relatedNodeId: "PublicApi", evidence: ["no examples"] })],
      summary: {
        ...base.summary,
        cycles: 1,
        recommendations: 1,
        exampleGaps: 1,
      },
    };
    const planning = createDocumentationPlanningContext(intelligence);
    expect(planning.topExamples).toHaveLength(10);
    expect(planning.topExamples[0]?.id).toBe(examples[11]?.id);
    expect(planning.cycles).toEqual(["nextStep: guide/a → guide/b → guide/a"]);
    expect(planning.gaps[0]?.relatedNodeId).toBe("PublicApi");
    expect(planning.recommendations[0]?.action).toBe("link to guide/b");
    expect(planning.learningPaths[0]?.title).toBe("Beginner path");
  });
});

describe("buildSkillIntelligenceManifest", () => {
  it("produces an evidence-backed manifest without writing files", () => {
    const intelligence = buildDocumentationIntelligence({
      files: [{ path: "README.md", content: README }],
      pages: [],
    });
    const manifest = buildSkillIntelligenceManifest(intelligence, {
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(manifest.skill).toBe(SKILL_IDENTIFIER);
    expect(manifest.skill).toBe("vetwo-docs");
    expect(manifest.managedSections).toEqual([...SKILL_MANAGED_SECTIONS]);
    expect(manifest.artifacts.length).toBeGreaterThan(0);
    expect(manifest.artifacts[0]?.path).toContain("agent/reports");
    expect(manifest.facts.hasExamples).toBe(true);
  });

  it("ranks top referenced symbols across examples", () => {
    const examples = [
      createExample({
        title: "a",
        type: "demo",
        language: "ts",
        provenance: createExampleProvenance({ kind: "docs", source: "docs/a.md" }),
        content: "a()",
        referencedSymbols: ["Hot", "Warm"],
      }),
      createExample({
        title: "b",
        type: "demo",
        language: "ts",
        provenance: createExampleProvenance({ kind: "docs", source: "docs/b.md" }),
        content: "b()",
        referencedSymbols: ["Hot"],
      }),
      createExample({
        title: "c",
        type: "demo",
        language: "ts",
        provenance: createExampleProvenance({ kind: "docs", source: "docs/c.md" }),
        content: "c()",
        referencedSymbols: [],
      }),
    ];
    const intelligence = buildDocumentationIntelligence({ examples, pages: [] });
    const manifest = buildSkillIntelligenceManifest(intelligence, {
      generatedAt: "2026-01-01T00:00:00.000Z",
      reportDirectory: "agent/reports",
    });
    expect(manifest.facts.topSymbols).toEqual(["Hot", "Warm"]);
    expect(manifest.artifacts[0]?.path).toContain("agent/reports");
  });
});
