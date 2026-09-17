import { describe, it, expect } from "vitest";

import { createAIProviderRegistry } from "./registry.js";
import type { AIProviderFactory } from "./provider.js";
import type { AIProvider } from "./provider.js";
import type {
  AIDocumentationRequest,
  AIDocumentationResult,
  AIAnalysisRequest,
  AIAnalysisResult,
  AIUpdateRequest,
  AIUpdateResult,
} from "./types.js";
import { hasCapability, supportedCapabilities } from "./capabilities.js";
import { resolveAIConfig, DEFAULT_AI_CONFIG } from "./config.js";
import { buildAIContext, selectContextPacksForIntent } from "./context/context-builder.js";
import {
  prioritizeAPIs,
  prioritizeExamples,
  prioritizeConcepts,
  trimToBudget,
} from "./context/prioritizer.js";
import {
  detectTerminology,
  buildTerminologyDictionary,
  validateTerminology,
} from "./terminology/dictionary.js";
import { generateDocumentationPlan, inferProjectType } from "./planning/plan.js";
import { validateClaim, validateClaims, summarizeClaimValidation } from "./validation/claims.js";
import {
  validateLink,
  validateLinks,
  extractLinksFromContent,
  summarizeLinkValidation,
} from "./validation/links.js";
import { evaluatePage, evaluatePages, summarizeEvaluation } from "./evaluation/evaluator.js";
import { reviewPage, summarizeReview } from "./review/loop.js";
import { createAICache, buildCacheKey } from "./cache/cache.js";
import { analyzeImpact } from "./incremental/impact.js";
import {
  mergeAISkillContent,
  extractAIManagedSections,
  buildAISkillContent,
} from "./skill/ai-skill.js";

// ─── Test Fixtures ───────────────────────────────────────────────────────

function createFakeFactory(id: string): AIProviderFactory {
  const provider: AIProvider = {
    metadata: {
      id,
      displayName: id,
      version: "1.0.0",
      models: [{ id: `${id}-model`, name: `${id} model`, contextWindow: 128000 }],
      auth: { kind: "none" },
      aliases: [`${id}-alias`],
    },
    capabilities: { documentationGeneration: true },
    async initialize() {},
    async analyze(_request: AIAnalysisRequest): Promise<AIAnalysisResult> {
      return { summary: "ok" };
    },
    async generate(request: AIDocumentationRequest): Promise<AIDocumentationResult> {
      return {
        pages: [
          {
            slug: request.topic.toLowerCase().replace(/\s+/g, "-"),
            title: request.topic,
            content: `# ${request.topic}\n\n## Overview\n\nGenerated content for ${request.topic}.\n\n## Usage\n\n\`\`\`ts\nexample()\n\`\`\`\n`,
            intent: request.intent,
            audience: request.audience,
            language: "en",
            format: "markdown",
          },
        ],
      };
    },
    async update(_request: AIUpdateRequest): Promise<AIUpdateResult> {
      return { updated: [], unchanged: [] };
    },
    async dispose() {},
  };
  return {
    metadata: provider.metadata,
    capabilities: provider.capabilities,
    create: () => provider,
  };
}

// ─── Capabilities ────────────────────────────────────────────────────────

describe("ai capabilities", () => {
  it("detects supported capabilities", () => {
    const caps = { documentationGeneration: true, streaming: false };
    expect(hasCapability(caps, "documentationGeneration")).toBe(true);
    expect(hasCapability(caps, "streaming")).toBe(false);
  });

  it("lists supported capabilities", () => {
    const caps = { documentationGeneration: true, streaming: true, faq: false };
    const list = supportedCapabilities(caps);
    expect(list).toContain("documentationGeneration");
    expect(list).toContain("streaming");
    expect(list).not.toContain("faq");
  });
});

// ─── Registry ────────────────────────────────────────────────────────────

describe("ai registry", () => {
  it("registers and resolves providers", () => {
    const registry = createAIProviderRegistry();
    const factory = createFakeFactory("test-ai");
    registry.register(factory);

    expect(registry.has("test-ai")).toBe(true);
    expect(registry.get("test-ai")?.metadata.id).toBe("test-ai");
    expect(registry.resolve("test-ai")).toBeDefined();
  });

  it("resolves aliases", () => {
    const registry = createAIProviderRegistry();
    registry.register(createFakeFactory("test-ai"));
    expect(registry.resolve("test-ai-alias")?.metadata.id).toBe("test-ai");
  });

  it("returns undefined for unknown providers", () => {
    const registry = createAIProviderRegistry();
    expect(registry.resolve("nope")).toBeUndefined();
    expect(registry.has("nope")).toBe(false);
  });

  it("unregisters providers and cleans up aliases", () => {
    const registry = createAIProviderRegistry();
    registry.register(createFakeFactory("test-ai"));
    expect(registry.unregister("test-ai")).toBe(true);
    expect(registry.has("test-ai")).toBe(false);
    expect(registry.resolve("test-ai-alias")).toBeUndefined();
  });

  it("manages default provider", () => {
    const registry = createAIProviderRegistry();
    registry.register(createFakeFactory("a"), { priority: 10 });
    registry.register(createFakeFactory("b"), { priority: 5 });

    // Lowest priority number wins by default
    expect(registry.getDefault()?.metadata.id).toBe("b");

    registry.setDefault("a");
    expect(registry.getDefault()?.metadata.id).toBe("a");
  });

  it("creates instances via createProvider", () => {
    const registry = createAIProviderRegistry();
    registry.register(createFakeFactory("test-ai"));
    const instance = registry.createProvider("test-ai");
    expect(instance?.metadata.id).toBe("test-ai");
    expect(registry.createProvider("missing")).toBeUndefined();
  });
});

// ─── Config ──────────────────────────────────────────────────────────────

describe("ai config", () => {
  it("has disabled defaults", () => {
    expect(DEFAULT_AI_CONFIG.enabled).toBe(false);
  });

  it("merges user config over defaults", () => {
    const resolved = resolveAIConfig({ enabled: true });
    expect(resolved.enabled).toBe(true);
    expect(resolved.providers).toEqual(DEFAULT_AI_CONFIG.providers);
  });
});

// ─── Context Builder ─────────────────────────────────────────────────────

describe("ai context builder", () => {
  it("builds a context bundle from project intelligence", () => {
    const bundle = buildAIContext({
      rootDir: "/tmp/project",
      project: { name: "my-lib", description: "A library" },
      api: {
        exports: [{ name: "createUser", kind: "function", signature: "createUser(data)" }],
      },
      examples: [{ title: "Basic usage", code: "createUser()", language: "ts", source: "project" }],
    });

    expect(bundle.project?.name).toBe("my-lib");
    expect(bundle.api?.publicSymbols).toHaveLength(1);
    expect(bundle.examples).toHaveLength(1);
    expect(bundle.estimatedTokens).toBeGreaterThan(0);
  });

  it("handles empty input gracefully", () => {
    const bundle = buildAIContext({ rootDir: "/tmp" });
    expect(bundle.project).toBeUndefined();
    expect(bundle.api).toBeUndefined();
    expect(bundle.concepts).toEqual([]);
  });

  it("selects intent-specific context packs", () => {
    expect(selectContextPacksForIntent("api-reference")).toContain("api");
    expect(selectContextPacksForIntent("getting-started")).toContain("workflows");
    expect(selectContextPacksForIntent("troubleshooting")).toContain("troubleshooting");
  });
});

// ─── Prioritizer ─────────────────────────────────────────────────────────

describe("ai prioritizer", () => {
  const bundle = buildAIContext({
    rootDir: "/",
    api: {
      exports: [
        { name: "alpha", kind: "function" },
        { name: "beta", kind: "interface" },
      ],
    },
    examples: [
      { title: "e1", code: "a", language: "ts", source: "project" },
      { title: "e2", code: "b", language: "ts", source: "generated" },
    ],
  });

  it("prioritizes APIs with hints boosting relevance", () => {
    const ranked = prioritizeAPIs(bundle.api, {
      intent: "api-reference",
      audience: "api-consumer",
      maxTokens: 1000,
      hints: ["beta"],
    });
    expect(ranked.length).toBe(2);
    const beta = ranked.find((r) => (r.data as { name: string }).name === "beta");
    const alpha = ranked.find((r) => (r.data as { name: string }).name === "alpha");
    expect(beta!.score).toBeGreaterThan(alpha!.score);
  });

  it("prioritizes project-sourced examples over generated ones", () => {
    const ranked = prioritizeExamples(bundle.examples, {
      intent: "getting-started",
      audience: "beginner",
      maxTokens: 1000,
    });
    expect(
      ranked[0] !== undefined && (ranked[0].data as { source: string }).source === "project",
    ).toBe(true);
  });

  it("prioritizes concepts matching hints", () => {
    const concepts = [
      { name: "router", description: "", relatedApis: [] },
      { name: "cache", description: "", relatedApis: [] },
    ];
    const ranked = prioritizeConcepts(concepts, {
      intent: "concept",
      audience: "developer",
      maxTokens: 1000,
      hints: ["router"],
    });
    expect((ranked[0]?.data as { name: string }).name).toBe("router");
  });

  it("trims to token budget", () => {
    const elements = Array.from({ length: 20 }, (_, i) => ({
      data: { big: "x".repeat(100), i },
      score: 1,
      reason: "",
    }));
    const trimmed = trimToBudget(elements, 50, (item) => JSON.stringify(item));
    expect(trimmed.length).toBeLessThan(20);
    expect(trimmed.length).toBeGreaterThan(0);
  });
});

// ─── Terminology ─────────────────────────────────────────────────────────

describe("ai terminology", () => {
  it("detects terms from symbols, packages, and config keys", () => {
    const detected = detectTerminology({
      symbols: ["createUser"],
      packages: ["@vetwo/docs"],
      configKeys: ["output.directory"],
    });
    expect(detected.some((t) => t.canonical === "createUser")).toBe(true);
    expect(detected.some((t) => t.canonical === "docs")).toBe(true);
  });

  it("builds a dictionary with custom precedence", () => {
    const detected = detectTerminology({ symbols: ["foo"] });
    const dict = buildTerminologyDictionary(detected, [
      { canonical: "foo", category: "custom", aliases: ["Foo"] },
    ]);
    expect(dict.find((d) => d.canonical === "foo")?.category).toBe("custom");
  });

  it("validates used terms against the dictionary with alias suggestions", () => {
    const dict = buildTerminologyDictionary(
      [],
      [{ canonical: "workspace", aliases: ["work-space"] }],
    );
    const result = validateTerminology(["Workspace", "work-space", "unknown-term"], dict);
    expect(result.valid).toContain("Workspace");
    expect(result.suggestions.get("unknown-term")).toBeUndefined();
    expect(result.unknown).toContain("unknown-term");
    expect(result.suggestions.get("work-space")).toBe("workspace");
  });
});

// ─── Planning ────────────────────────────────────────────────────────────

describe("ai planning", () => {
  it("infers project types from characteristics", () => {
    expect(inferProjectType({ hasCli: true })).toBe("cli");
    expect(inferProjectType({ hasServer: true })).toBe("backend");
    expect(inferProjectType({ framework: "react" })).toBe("framework");
    expect(inferProjectType({ type: "library" })).toBe("library");
  });

  it("generates an adaptive plan per project type", () => {
    const plan = generateDocumentationPlan({
      projectName: "my-cli",
      projectType: "cli",
    });
    expect(plan.pages.length).toBeGreaterThan(0);
    expect(plan.projectType).toBe("cli");
  });

  it("marks pages that already exist", () => {
    const plan = generateDocumentationPlan({
      projectName: "lib",
      projectType: "library",
      existingPages: [{ slug: "overview", title: "Overview" }],
    });
    expect(plan.pages.find((p) => p.slug === "overview")?.existing).toBe(true);
    expect(plan.pages.find((p) => p.slug === "installation")?.existing).toBe(false);
  });
});

// ─── Claim Validation ────────────────────────────────────────────────────

describe("ai claim validation", () => {
  const evidence = {
    symbols: ["createUser", "deleteUser"],
    files: ["src/users.ts"],
    configKeys: ["output"],
  };

  it("verifies claims referencing known symbols", () => {
    const result = validateClaim(
      { text: "createUser() creates a user.", evidence: [], confidence: 0.9 },
      evidence,
    );
    expect(result.valid).toBe(true);
    expect(result.status).toBe("verified");
  });

  it("rejects claims referencing unknown symbols", () => {
    const result = validateClaim(
      { text: "destroyUniverse() destroys things.", evidence: [], confidence: 0.9 },
      evidence,
    );
    expect(result.valid).toBe(false);
    expect(result.status).toBe("unsupported");
  });

  it("validates asserted evidence against reality", () => {
    const result = validateClaim(
      {
        text: "Something.",
        evidence: [{ kind: "symbol", value: "nonexistentFn", confidence: "verified" }],
        confidence: 0.9,
      },
      evidence,
    );
    expect(result.valid).toBe(false);
    expect(result.status).toBe("contradicted");
  });

  it("summarizes validation results", () => {
    const results = validateClaims(
      [
        { text: "createUser() works.", evidence: [], confidence: 1 },
        { text: "missingFn() fails.", evidence: [], confidence: 1 },
      ],
      evidence,
    );
    const summary = summarizeClaimValidation(results);
    expect(summary.total).toBe(2);
    expect(summary.unsupported).toBe(1);
  });
});

// ─── Link Validation ─────────────────────────────────────────────────────

describe("ai link validation", () => {
  const model = {
    slugs: ["getting-started", "configuration"],
    apiNames: ["createUser"],
    conceptNames: ["state"],
  };

  it("accepts valid page links", () => {
    const result = validateLink(
      { text: "Guide", target: "getting-started", sourcePage: "index", kind: "page" },
      model,
    );
    expect(result.valid).toBe(true);
  });

  it("rejects broken page links with suggestions", () => {
    const result = validateLink(
      { text: "Guide", target: "getting-startedd", sourcePage: "index", kind: "page" },
      model,
    );
    expect(result.valid).toBe(false);
    expect(result.suggestion).toBe("getting-started");
  });

  it("extracts markdown links and classifies them", () => {
    const links = extractLinksFromContent(
      "[guide](getting-started) [site](https://example.com) [section](#intro)",
      "index",
    );
    expect(links).toHaveLength(3);
    expect(links[0]?.kind).toBe("page");
    expect(links[1]?.kind).toBe("external");
    expect(links[2]?.kind).toBe("anchor");
  });

  it("summarizes link validation", () => {
    const results = validateLinks(
      [
        { text: "a", target: "getting-started", sourcePage: "i", kind: "page" },
        { text: "b", target: "nope", sourcePage: "i", kind: "page" },
      ],
      model,
    );
    const summary = summarizeLinkValidation(results);
    expect(summary.total).toBe(2);
    expect(summary.broken).toBe(1);
  });
});

// ─── Evaluation ──────────────────────────────────────────────────────────

describe("ai evaluation", () => {
  const goodPage = {
    slug: "p",
    title: "P",
    intent: "overview" as const,
    audience: "developer" as const,
    language: "en",
    format: "markdown" as const,
    content: [
      "# P",
      "## Overview",
      "word ".repeat(60),
      "## Usage",
      "```ts\nfoo()\n```",
      "- item one",
      "- item two",
    ].join("\n"),
    claims: [{ text: "foo works", evidence: [], confidence: 1 }],
  };

  it("scores well-structured pages higher than thin ones", () => {
    const thin = evaluatePage({ ...goodPage, content: "# P\n\nTODO" });
    const full = evaluatePage(goodPage);
    expect(full.score).toBeGreaterThan(thin.score);
  });

  it("reports issues for shallow content", () => {
    const result = evaluatePage({ ...goodPage, content: "# P\n\nShort." });
    expect(result.issues.some((i) => i.kind === "shallow-content")).toBe(true);
  });

  it("summarizes batches", () => {
    const summary = summarizeEvaluation(evaluatePages([goodPage, { ...goodPage, slug: "q" }]));
    expect(summary.total).toBe(2);
  });
});

// ─── Review Loop ─────────────────────────────────────────────────────────

describe("ai review loop", () => {
  it("accepts high-quality pages on the first iteration", async () => {
    const factory = createFakeFactory("loop-test");
    const provider = factory.create();
    await provider.initialize({ rootDir: "/", stateRoot: "/" });

    const result = await reviewPage(
      provider,
      {
        slug: "usage",
        title: "Usage",
        intent: "overview",
        audience: "developer",
        estimatedWords: 300,
        priority: 1,
        existing: false,
      },
      {},
      { acceptThreshold: 0.01 },
    );
    expect(result.iterations).toBe(0);
    expect(result.accepted).toBe(true);
  });

  it("summarizes batch reviews", async () => {
    const factory = createFakeFactory("loop-test");
    const provider = factory.create();
    await provider.initialize({ rootDir: "/", stateRoot: "/" });

    const results = [
      await reviewPage(
        provider,
        {
          slug: "a",
          title: "A",
          intent: "overview",
          audience: "developer",
          estimatedWords: 300,
          priority: 1,
          existing: false,
        },
        {},
        { acceptThreshold: 0.01 },
      ),
      await reviewPage(
        provider,
        {
          slug: "b",
          title: "B",
          intent: "overview",
          audience: "developer",
          estimatedWords: 300,
          priority: 1,
          existing: false,
        },
        {},
        { acceptThreshold: 0.99 },
      ),
    ];
    const summary = summarizeReview(results);
    expect(summary.accepted).toBe(1);
    expect(summary.rejected).toBe(1);
  });
});

// ─── Cache ───────────────────────────────────────────────────────────────

describe("ai cache", () => {
  it("round-trips entries by key", () => {
    const cache = createAICache();
    const key = buildCacheKey({
      intent: "overview",
      audience: "developer",
      topic: "Intro",
      contextFingerprint: "abc",
      provider: "p",
      model: "m",
    });
    expect(cache.has(key)).toBe(false);
    cache.set({
      key,
      provider: "p",
      model: "m",
      createdAt: "now",
      output: "hello",
      configHash: "c",
    });
    expect(cache.get(key)?.output).toBe("hello");

    expect(cache.invalidate(key)).toBe(true);
    expect(cache.has(key)).toBe(false);
  });

  it("invalidates by provider", () => {
    const cache = createAICache();
    cache.set({ key: "k1", provider: "p1", model: "m", createdAt: "", output: "", configHash: "" });
    cache.set({ key: "k2", provider: "p2", model: "m", createdAt: "", output: "", configHash: "" });
    expect(cache.invalidateProvider("p1")).toBe(1);
    expect(cache.keys()).toEqual(["k2"]);
  });

  it("produces stable keys for identical input", () => {
    const input = {
      intent: "overview",
      audience: "developer",
      topic: "T",
      contextFingerprint: "f",
      provider: "p",
      model: "m",
    };
    expect(buildCacheKey(input)).toBe(buildCacheKey(input));
    expect(buildCacheKey({ ...input, topic: "U" })).not.toBe(buildCacheKey(input));
  });
});

// ─── Incremental Impact ──────────────────────────────────────────────────

describe("ai incremental impact", () => {
  const existingPages = [
    {
      slug: "users",
      title: "Users",
      content: "About createUser in src/users.ts",
      intent: "api-reference" as const,
      audience: "developer" as const,
      language: "en",
      format: "markdown" as const,
    },
    {
      slug: "intro",
      title: "Intro",
      content: "Welcome to the docs.",
      intent: "overview" as const,
      audience: "developer" as const,
      language: "en",
      format: "markdown" as const,
    },
  ];
  const plan = [
    {
      slug: "users",
      title: "Users",
      intent: "api-reference" as const,
      audience: "developer" as const,
      estimatedWords: 300,
      priority: 1,
      existing: true,
      apis: ["createUser"],
    },
  ];

  it("marks only affected pages", () => {
    const impact = analyzeImpact(
      [{ filePath: "src/users.ts", kind: "modified", symbols: ["createUser"] }],
      existingPages,
      plan,
    );
    expect(impact.affected).toContain("users");
    expect(impact.unchanged).toContain("intro");
    expect(impact.orphaned).toHaveLength(0);
  });

  it("orphanes pages whose subject was deleted", () => {
    const impact = analyzeImpact(
      [{ filePath: "src/users.ts", kind: "deleted", symbols: ["createUser"] }],
      existingPages,
      plan,
    );
    expect(impact.orphaned).toContain("users");
  });
});

// ─── Skill Content ───────────────────────────────────────────────────────

describe("ai skill content", () => {
  it("builds managed sections with markers", () => {
    const content = buildAISkillContent({});
    expect(content).toContain("@vetwo-managed:ai-intelligence");
    expect(content).toContain("@vetwo-managed:ai-workflow");
  });

  it("merges into existing content preserving user sections", () => {
    const existing = "# My skill\n\nMy custom notes.";
    const aiSections = buildAISkillContent({});
    const merged = mergeAISkillContent(existing, aiSections);

    expect(merged).toContain("My custom notes.");
    expect(merged).toContain("@vetwo-managed:ai-intelligence");

    const extracted = extractAIManagedSections(merged);
    expect(extracted.has("ai-intelligence")).toBe(true);
  });

  it("replaces previously merged sections instead of duplicating", () => {
    const once = mergeAISkillContent("# Skill", buildAISkillContent({}));
    const twice = mergeAISkillContent(once, buildAISkillContent({}));
    const marker = "<!-- @vetwo-managed:ai-intelligence -->";
    expect(twice.split(marker)).toHaveLength(2);
    expect(once.split(marker)).toHaveLength(2);
  });
});
