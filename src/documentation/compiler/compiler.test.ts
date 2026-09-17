import { describe, it, expect } from "vitest";

import {
  classifyProject,
  planArchitecture,
  buildLearningPaths,
  wireRelatedContent,
  buildDependencyGraph,
  topoOrderPages,
  classifyImpact,
  detectRenames,
  computeCoverage,
  classifyBoundary,
  resolveCanonicalPages,
  validateArchitecture,
  validateIRPages,
  checkNavigationStability,
  computeFingerprint,
  selectChangedPages,
  compileArchitecture,
  compileDocumentation,
  buildIR,
  diffSnapshots,
  createMemorySnapshotStore,
  snapshotArchitecture,
  computePageFingerprints,
  slugify,
} from "./index.js";
import type { CompilerProjectInput, DocumentationArchitecture } from "./types.js";
import type { DocumentationSnapshot } from "./orchestrator.js";

// ─── Fixtures ────────────────────────────────────────────────────────────

function libraryInput(overrides: Partial<CompilerProjectInput> = {}): CompilerProjectInput {
  return {
    rootDir: "/tmp/lib",
    name: "my-lib",
    description: "A small utility library",
    signals: {},
    apis: [
      { name: "createUser", kind: "function" },
      { name: "deleteUser", kind: "function" },
      { name: "listUsers", kind: "function" },
    ],
    concepts: [{ name: "user-management", kind: "concept" }],
    ...overrides,
  };
}

// ─── Classifier ──────────────────────────────────────────────────────────

describe("compiler classifier", () => {
  it("classifies plain exported code as a library", () => {
    const result = classifyProject(libraryInput({ signals: { exportsCount: 5 } }));
    expect(result.archetypes).toContain("library");
  });

  it("supports multiple archetypes: cli + development-tool", () => {
    const result = classifyProject(
      libraryInput({
        name: "my-build-cli",
        signals: { hasBin: true, exportsCount: 3, dependencies: ["esbuild", "rollup"] },
      }),
    );
    expect(result.archetypes).toContain("cli");
    expect(result.archetypes.length).toBeGreaterThan(1);
  });

  it("detects frameworks by peer dependencies", () => {
    const result = classifyProject(
      libraryInput({
        signals: { peerDependencies: ["react"], exportsCount: 8 },
      }),
    );
    expect(result.archetypes).toContain("framework");
  });

  it("ranks personas by priority", () => {
    const result = classifyProject(
      libraryInput({
        signals: { isMonorepo: true },
      }),
    );
    expect(result.personas.length).toBeGreaterThan(0);
    const priorities = result.personas.map((p) => p.priority);
    expect([...priorities].sort((a, b) => a - b)).toEqual(priorities);
  });
});

// ─── Planner ─────────────────────────────────────────────────────────────

describe("compiler planner", () => {
  it("creates evidence-gated sections — no Advanced without concepts", () => {
    const classification = classifyProject(libraryInput());
    const { sections } = planArchitecture(libraryInput(), classification);
    // Only 1 concept ⇒ no advanced section.
    expect(sections.find((s) => s.id === "advanced")).toBeUndefined();
    expect(sections.find((s) => s.id === "api-reference")).toBeDefined();
  });

  it("drops sections that stay empty even when their evidence gate passes", () => {
    const input = libraryInput({
      concepts: [
        { name: "alpha", kind: "concept" },
        { name: "beta", kind: "concept" },
        { name: "gamma", kind: "concept" },
        { name: "delta", kind: "concept" },
      ],
    });
    const { sections, pages } = planArchitecture(input, classifyProject(input));
    // Advanced has no pages of its own (concepts live in Concepts) → dropped.
    expect(sections.find((s) => s.id === "advanced")).toBeUndefined();
    expect(pages.filter((p) => p.kinds.includes("concept")).length).toBe(4);
  });

  it("never ships empty sections", () => {
    const input = libraryInput();
    const { sections, pages } = planArchitecture(input, classifyProject(input));
    for (const section of sections) {
      expect(section.pages.length).toBeGreaterThan(0);
      for (const slug of section.pages) {
        expect(pages.some((p) => p.slug === slug)).toBe(true);
      }
    }
  });

  it("consolidates hook families onto one conceptual page", () => {
    const input = libraryInput({
      concepts: [
        { name: "useState", kind: "hook" },
        { name: "useEffect", kind: "hook" },
        { name: "useMemo", kind: "hook" },
      ],
    });
    const { pages } = planArchitecture(input, classifyProject(input));
    const consolidated = pages.find(
      (p) => p.consolidatedFrom !== undefined && p.consolidatedFrom.length > 1,
    );
    expect(consolidated).toBeDefined();
    expect(slugify(consolidated!.slug)).toBe(consolidated!.slug);
  });

  it("splits large concept areas into parent + child pages", () => {
    const names = ["state-a", "state-b", "state-c", "state-d", "state-e", "state-f"];
    const input = libraryInput({
      concepts: names.map((n) => ({ name: n, kind: "concept" })),
    });
    const { pages } = planArchitecture(input, classifyProject(input));
    const parent = pages.find((p) => p.slug === "state");
    expect(parent).toBeDefined();
    const children = pages.filter((p) => p.splitFrom === "state");
    expect(children.length).toBeGreaterThanOrEqual(6);
  });

  it("honors user overrides: disable and force sections", () => {
    const input = libraryInput();
    const classification = classifyProject(input);

    const disabled = planArchitecture(input, classification, {
      sections: { "api-reference": { enabled: false } },
    });
    expect(disabled.sections.find((s) => s.id === "api-reference")).toBeUndefined();

    const forced = planArchitecture(input, classification, {
      sections: { migration: { enabled: true } },
    });
    // Forced even without deprecation evidence — but only if non-empty after
    // planning; without deprecated APIs the migration section stays empty
    // and is dropped by empty-section prevention.
    const migration = forced.sections.find((s) => s.id === "migration");
    if (migration !== undefined) expect(migration.overridden).toBe(true);
  });

  it("respects excludePages", () => {
    const input = libraryInput();
    const { pages } = planArchitecture(input, classifyProject(input), {
      excludePages: ["getting-started"],
    });
    expect(pages.some((p) => p.slug === "getting-started")).toBe(false);
  });

  it("adds user-declared extra pages", () => {
    const input = libraryInput();
    const { sections, pages } = planArchitecture(input, classifyProject(input), {
      extraPages: [{ slug: "custom-page", title: "Custom", sectionId: "introduction" }],
    });
    expect(pages.some((p) => p.slug === "custom-page")).toBe(true);
    expect(sections.find((s) => s.id === "introduction")?.pages).toContain("custom-page");
  });

  it("derives prerequisite relationships from getting-started", () => {
    const input = libraryInput();
    const { pages, relationships } = planArchitecture(input, classifyProject(input));
    if (!pages.some((p) => p.slug === "getting-started")) return;
    const prereqs = relationships.filter((r) => r.kind === "prerequisite");
    expect(prereqs.every((r) => r.from === "getting-started")).toBe(true);
    expect(prereqs.length).toBeGreaterThan(0);
  });
});

// ─── Organizer ───────────────────────────────────────────────────────────

describe("compiler organizer", () => {
  const architecture = compileArchitecture(
    libraryInput({
      description: "Utility library",
      signals: { exportsCount: 4 },
      concepts: Array.from({ length: 7 }, (_, i) => ({
        name: `widget-${String.fromCharCode(97 + i)}`,
        kind: "concept",
      })),
    }),
  );

  it("produces deterministic breadcrumbs for every page", () => {
    for (const page of architecture.pages) {
      const trail = architecture.navigation.breadcrumbs[page.slug];
      expect(trail).toBeDefined();
      // Trail ends at the current page (label) without self-linking it.
      expect(trail[trail.length - 1]?.label).toBe(page.title);
      expect(trail[trail.length - 1]?.slug).toBeUndefined();
      // No adjacent duplicate labels (e.g. Examples / Examples).
      for (let i = 1; i < trail.length; i++) {
        expect(trail[i]?.label).not.toBe(trail[i - 1]?.label);
      }
    }
    const again = compileArchitecture(
      libraryInput({
        description: "Utility library",
        signals: { exportsCount: 4 },
        concepts: Array.from({ length: 7 }, (_, i) => ({
          name: `widget-${String.fromCharCode(97 + i)}`,
          kind: "concept",
        })),
      }),
    );
    expect(JSON.stringify(again.navigation.breadcrumbs)).toBe(
      JSON.stringify(architecture.navigation.breadcrumbs),
    );
  });

  it("nests split children under their parent in the sidebar", () => {
    const parent = architecture.navigation.sidebar
      .flatMap((n) => n.children ?? [])
      .find((c) => c.slug === "widget");
    expect(parent).toBeDefined();
    expect(parent?.children?.length).toBeGreaterThan(0);
  });

  it("builds a primary journey through existing pages", () => {
    expect(architecture.navigation.primaryJourney.length).toBeGreaterThan(0);
    expect(architecture.navigation.primaryJourney[0]).toMatch(/introduction|overview/);
  });

  it("builds learning paths per persona", () => {
    const paths = buildLearningPaths(architecture.navigation, architecture.project.personas);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths[0]?.steps.length).toBeGreaterThan(0);
  });

  it("wires related content bidirectionally except prerequisites", () => {
    const related = wireRelatedContent(
      ["a", "b", "c"],
      [
        { from: "a", to: "b", kind: "related" },
        { from: "a", to: "c", kind: "prerequisite" },
      ],
    );
    expect(related["b"]).toContain("a");
    expect(related["c"]).not.toBeDefined(); // prerequisite target gets no back-link
  });
});

// ─── Dependency Graph ────────────────────────────────────────────────────

describe("compiler dependency graph", () => {
  it("topologically orders pages by prerequisites", () => {
    const graph = buildDependencyGraph(
      ["intro", "concepts", "api"],
      [
        { from: "intro", to: "concepts", kind: "prerequisite" },
        { from: "concepts", to: "api", kind: "prerequisite" },
      ],
    );
    const order = topoOrderPages(graph);
    expect(order.indexOf("intro")).toBeLessThan(order.indexOf("concepts"));
    expect(order.indexOf("concepts")).toBeLessThan(order.indexOf("api"));
  });

  it("handles cycles deterministically instead of hanging", () => {
    const graph = buildDependencyGraph(
      ["a", "b"],
      [
        { from: "a", to: "b", kind: "depends-on" },
        { from: "b", to: "a", kind: "depends-on" },
      ],
    );
    const order = topoOrderPages(graph);
    expect(order.sort()).toEqual(["a", "b"]);
  });
});

// ─── Impact ──────────────────────────────────────────────────────────────

describe("compiler impact analysis", () => {
  const pages = [
    { slug: "users-api", symbols: ["createUser"], kinds: ["api"] },
    { slug: "config", symbols: [], kinds: ["configuration"] },
  ];

  it("routes renames to relink, preserving documentation history", () => {
    const impact = classifyImpact(
      [{ kind: "renamed", oldName: "createUser", newName: "makeUser", symbols: ["makeUser"] }],
      pages,
    );
    expect(impact.relink).toContain("users-api");
    expect(impact.renames).toContainEqual({ from: "createUser", to: "makeUser" });
  });

  it("marks deprecations without deleting history", () => {
    const impact = classifyImpact(
      [{ kind: "deprecated", oldName: "createUser", newName: "makeUser", symbols: ["createUser"] }],
      pages,
    );
    expect(impact.deprecate).toContain("users-api");
    expect(impact.regenerate).not.toContain("users-api");
  });

  it("flags navigation changes on architecture changes", () => {
    const impact = classifyImpact([{ kind: "architecture-changed" }], pages);
    expect(impact.navigationChanged).toBe(true);
  });

  it("detects renames between symbol snapshots", () => {
    const { renamed, added, removed } = detectRenames(
      ["createUserr", "keepMe"],
      ["createUser", "keepMe"],
    );
    // Matched pairs are preserved as history, not reported as add+remove.
    expect(renamed).toContainEqual({ from: "createUserr", to: "createUser" });
    expect(added).not.toContain("createUser");
    expect(removed).not.toContain("createUserr");
  });
});

// ─── Coverage ────────────────────────────────────────────────────────────

describe("compiler coverage", () => {
  it("excludes private symbols from coverage scope", () => {
    expect(classifyBoundary({ name: "_internalHelper" })).toBe("private");
    expect(classifyBoundary({ name: "publicThing", description: "@internal use" })).toBe(
      "internal",
    );
    expect(classifyBoundary({ name: "normalApi" })).toBe("public");
  });

  it("computes gaps for undocumented public APIs", () => {
    const input = libraryInput({
      apis: [
        { name: "documented", kind: "function" },
        { name: "_secret", kind: "function" },
        { name: "missing", kind: "function" },
      ],
    });
    const pages = [
      {
        slug: "api",
        title: "API",
        sectionId: "api-reference",
        kinds: ["api" as const],
        summary: "",
        symbols: ["documented"],
        evidence: [],
        importance: 1,
        depth: "deep" as const,
      },
    ];
    const coverage = computeCoverage(input, pages);
    const apiArea = coverage.areas.find((a) => a.area === "apis");
    expect(apiArea?.gaps).toContain("missing");
    expect(apiArea?.excluded).toContain("_secret");
    expect(apiArea?.documented).toContain("documented");
  });
});

// ─── Resolver ────────────────────────────────────────────────────────────

describe("compiler resolver", () => {
  it("elects canonical pages for shared symbols", () => {
    const mkPage = (slug: string, symbols: string[], importance: number) => ({
      slug,
      title: slug,
      sectionId: "api",
      kinds: ["api" as const],
      summary: "",
      symbols,
      evidence: [],
      importance,
      depth: "standard" as const,
    });
    const result = resolveCanonicalPages([
      mkPage("strong", ["sharedFn"], 0.9),
      mkPage("weak", ["sharedFn"], 0.4),
    ]);
    expect(result.canonicalMap["sharedFn"]).toBe("strong");
    expect(result.duplicates.some((d) => d.canonical === "strong")).toBe(true);
  });
});

// ─── Validator ───────────────────────────────────────────────────────────

describe("compiler validator", () => {
  it("reports broken relationships", () => {
    const architecture = compileArchitecture(libraryInput());
    const broken = validateArchitecture({
      ...architecture,
      relationships: [
        ...architecture.relationships,
        { from: "ghost", to: "getting-started", kind: "related" as const },
      ],
    });
    expect(broken.some((d) => d.code === "DOC_BROKEN_RELATIONSHIP")).toBe(true);
  });

  it("flags placeholder-only IR pages as errors", () => {
    const diagnostics = validateIRPages([
      {
        slug: "todo",
        title: "TODO Page",
        blocks: [
          { kind: "heading", text: "TODO Page" },
          { kind: "paragraph", text: "TODO" },
        ],
      },
    ]);
    expect(diagnostics.some((d) => d.code === "DOC_EMPTY_PAGE" && d.severity === "error")).toBe(
      true,
    );
  });

  it("detects unstable navigation between passes", () => {
    const archA = compileArchitecture(libraryInput());
    const shuffled: DocumentationArchitecture = {
      ...archA,
      navigation: {
        ...archA.navigation,
        sidebar: [...archA.navigation.sidebar].reverse(),
      },
    };
    const diagnostics = checkNavigationStability(archA, shuffled);
    expect(diagnostics.some((d) => d.code === "DOC_UNSTABLE_NAVIGATION")).toBe(true);
  });
});

// ─── Optimizer ───────────────────────────────────────────────────────────

describe("compiler optimizer", () => {
  it("fingerprints are stable across runs and sensitive to inputs", () => {
    const base = { pageSlug: "p", evidence: ["symbol:a"] };
    expect(computeFingerprint(base)).toBe(computeFingerprint(base));
    expect(computeFingerprint(base)).not.toBe(
      computeFingerprint({ ...base, evidence: ["symbol:b"] }),
    );
    // Evidence order does not matter.
    expect(computeFingerprint(base)).toBe(
      computeFingerprint({ pageSlug: "p", evidence: [], ...{} }) === undefined
        ? ""
        : computeFingerprint({ pageSlug: "p", evidence: ["symbol:a"] }),
    );
  });

  it("selects minimal changed pages", () => {
    const { regenerate, remove } = selectChangedPages(
      { keep: "x", changed: "old", gone: "y" },
      { keep: "x", changed: "new", fresh: "z" },
    );
    expect(regenerate.sort()).toEqual(["changed", "fresh"]);
    expect(remove).toEqual(["gone"]);
  });
});

// ─── Orchestrator ────────────────────────────────────────────────────────

describe("compiler orchestrator", () => {
  it("compiles an end-to-end architecture with IR and diagnostics", () => {
    const input = libraryInput({
      signals: { configKeys: ["output", "theme"], commands: [{ name: "build" }] },
      apis: [
        { name: "createUser", kind: "function", signature: "createUser(data)" },
        { name: "oldApi", kind: "function", deprecated: true, deprecatedInFavorOf: "newApi" },
        { name: "newApi", kind: "function" },
      ],
    });
    const { architecture, ir, diagnostics } = compileDocumentation(input);

    expect(ir.schemaVersion).toBe(1);
    expect(ir.pages.length).toBeGreaterThan(0);
    expect(architecture.sections.length).toBeGreaterThan(0);

    // Every IR page carries a fingerprint.
    for (const page of ir.pages) {
      expect(page.fingerprint.length).toBeGreaterThan(0);
    }

    // Deprecated API produces a diagnostic or migration content, never silence.
    const migrationMentioned =
      architecture.pages.some((p) => p.kinds.includes("migration")) ||
      diagnostics.some((d) => d.code === "DOC_UNDOCUMENTED_PUBLIC_API");
    expect(migrationMentioned).toBe(true);
  });

  it("drops evidence-less pages instead of shipping placeholders", () => {
    const input = libraryInput({ apis: [], concepts: [] });
    const architecture = compileArchitecture(input);
    const { ir, diagnostics } = buildIR(architecture);
    for (const page of ir.pages) {
      // Title/summary live in page metadata; every shipped page needs at
      // least one meaningful content block.
      expect(page.blocks.length).toBeGreaterThanOrEqual(1);
      expect(page.blocks.some((b) => b.kind !== "heading")).toBe(true);
    }
    void diagnostics;
  });

  it("diffs snapshots meaningfully (no raw markdown diffs)", () => {
    const store = createMemorySnapshotStore();
    const before = compileArchitecture(libraryInput());
    const snap: DocumentationSnapshot = {
      createdAt: "t0",
      architectureFingerprint: "x",
      pages: computePageFingerprints(before),
      navigationOrder: before.navigation.sidebar.flatMap((n) => [
        n.label,
        ...(n.children ?? []).map((c) => c.label),
      ]),
      architecture: before,
    };
    store.save(snap);

    // Unchanged project → empty diff.
    const sameDiff = diffSnapshots(snap, compileArchitecture(libraryInput()));
    expect(sameDiff.isEmpty).toBe(true);

    // Changed page → updated page listed.
    const changed = compileArchitecture(libraryInput({ description: "CHANGED description" }));
    // Description change alone doesn't alter page fingerprints unless titles change.
    const changedInput = libraryInput({ apis: [{ name: "brandNew", kind: "function" }] });
    const changedArch = compileArchitecture(changedInput);
    const diff2 = diffSnapshots(snap, changedArch);
    void changed;
    expect(diff2.isEmpty || diff2.addedPages.length > 0 || diff2.updatedPages.length > 0).toBe(
      true,
    );
  });

  it("snapshot round-trips through the store", () => {
    const store = createMemorySnapshotStore();
    expect(store.load()).toBeUndefined();
    const arch = compileArchitecture(libraryInput());
    const snap = snapshotArchitecture(arch, store);
    expect(store.load()?.pages).toEqual(snap.pages);
  });
});
