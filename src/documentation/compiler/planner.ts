/**
 * Documentation Planner.
 *
 * Infers the documentation architecture for a specific project:
 * which sections should exist (evidence-gated — no empty "Advanced"),
 * which pages belong in them, and how pages relate.
 *
 * Sections are NOT taken from a universal template; archetypes provide
 * candidate sections and the planner keeps only those with real evidence.
 */

import type {
  ArchitectureOverrides,
  CompilerProjectInput,
  DocumentationPageDefinition,
  PageEvidence,
  SymbolBoundary,
  DocumentationRelationship,
  DocumentationSection,
  PageKind,
} from "./types.js";
import type { ClassificationResult } from "./classifier.js";

/** A candidate section offered by an archetype blueprint. */
interface SectionCandidate {
  readonly id: string;
  readonly title: string;
  readonly kinds: readonly PageKind[];
  /** Evidence predicate — a candidate without evidence is dropped. */
  readonly hasEvidence: (input: CompilerProjectInput) => boolean;
  /** Rationale recorded in the architecture. */
  readonly rationale: (input: CompilerProjectInput) => string;
}

/** Candidate sections per archetype. First matching archetype wins ordering. */
const SECTION_CANDIDATES: Readonly<Record<string, readonly SectionCandidate[]>> = {
  library: [
    sec("introduction", "Introduction", ["overview"], () => true, "Every project needs an entry point."),
    sec("getting-started", "Getting Started", ["guide", "tutorial", "installation", "quick-start"], () => true, "Install-and-first-success path."),
    sec("installation", "Installation", ["installation"], () => true, "Package installation via detected manager."),
    sec("quick-start", "Quick Start", ["quick-start", "tutorial"], (i) => (i.apis?.length ?? 0) > 0, "Minimal working example from real API."),
    sec("concepts", "Concepts", ["concept"], (i) => (i.concepts?.length ?? 0) > 0, "Knowledge-graph concepts detected."),
    sec("guides", "Guides", ["guide", "how-to", "recipe"], (i) => (i.apis?.length ?? 0) > 0, "Task-oriented guides over the public API."),
    sec("configuration", "Configuration", ["configuration"], (i) => (i.signals.configKeys?.length ?? 0) > 0, "Configuration keys detected."),
    sec("api-reference", "API Reference", ["api", "reference"], (i) => (i.apis?.length ?? 0) > 0, "Public API surface exists."),
    sec("cli", "CLI", ["cli-command"], (i) => (i.signals.commands?.length ?? 0) > 0, "CLI commands detected."),
    sec("examples", "Examples", ["example"], (i) => (i.signals.examples?.length ?? 0) > 0 || (i.apis?.length ?? 0) > 2, "Examples from tests/README/JSDoc."),
    sec("architecture", "Architecture", ["architecture"], (i) => (i.concepts?.length ?? 0) > 2, "Modules and relationships."),
    sec("security", "Security", ["security"], () => true, "Credentials and permissions."),
    sec("performance", "Performance", ["performance"], () => true, "Caching and incremental behavior."),
    sec("development", "Development", ["development", "testing", "building"], (i) => hasScripts(i), "Dev workflow from package scripts."),
    sec("contributing", "Contributing", ["contributing"], (i) => hasScripts(i), "Contributor guide."),
    sec("advanced", "Advanced", ["concept", "guide"], (i) => (i.concepts?.length ?? 0) > 3, "Multiple advanced concepts detected."),
    sec("migration", "Migration", ["migration"], (i) => (i.apis ?? []).some((a) => a.deprecated === true), "Deprecated APIs indicate migration paths."),
    sec("troubleshooting", "Troubleshooting", ["faq", "troubleshooting"], (i) => (i.apis?.length ?? 0) > 0, "Common problems and error recovery."),
    sec("changelog", "Changelog", ["changelog", "release-notes"], (i) => hasChangelog(i), "Version history."),
  ],
  cli: [
    sec("introduction", "Introduction", ["overview"], () => true, "Entry point for CLI users."),
    sec("installation", "Installation", ["guide"], () => true, "CLI tools need install instructions."),
    sec("api-reference", "API Reference", ["api", "reference"], (i) => (i.apis?.length ?? 0) > 0, "Public API also exposed."),
    sec("concepts", "Concepts", ["concept"], (i) => (i.concepts?.length ?? 0) > 0, "Concepts for CLI users."),
    sec(
      "commands",
      "Commands",
      ["cli-command", "reference"],
      (i) => (i.signals.commands?.length ?? 0) > 0,
      "Detected CLI commands.",
    ),
    sec(
      "configuration",
      "Configuration",
      ["configuration"],
      (i) => (i.signals.configKeys?.length ?? 0) > 0,
      "Configuration keys exist.",
    ),
    sec(
      "workflows",
      "Workflows",
      ["guide"],
      (i) => (i.signals.commands?.length ?? 0) > 2,
      "Multi-step workflows across commands.",
    ),
    sec(
      "examples",
      "Examples",
      ["example"],
      (i) => (i.signals.examples?.length ?? 0) > 0 || (i.signals.commands?.length ?? 0) > 0,
      "Concrete usage examples.",
    ),
    sec("architecture", "Architecture", ["architecture"], (i) => (i.concepts?.length ?? 0) > 2, "CLI internals."),
    sec(
      "troubleshooting",
      "Troubleshooting",
      ["troubleshooting", "faq"],
      () => true,
      "Exit codes and common failures.",
    ),
  ],
  framework: [
    sec("introduction", "Introduction", ["overview"], () => true, "Framework introduction."),
    sec(
      "core-concepts",
      "Core Concepts",
      ["concept"],
      (i) => (i.concepts?.length ?? 0) > 0,
      "Core mental model.",
    ),
    sec("getting-started", "Getting Started", ["tutorial"], () => true, "First app walkthrough."),
    sec("guides", "Guides", ["guide"], (i) => (i.apis?.length ?? 0) > 0, "Feature-area guides."),
    sec(
      "api-reference",
      "API Reference",
      ["api", "reference"],
      (i) => (i.apis?.length ?? 0) > 0,
      "Framework API surface.",
    ),
    sec(
      "plugins",
      "Plugins",
      ["plugin"],
      (i) =>
        (i.signals.plugins?.length ?? 0) > 0 || (i.concepts ?? []).some((c) => c.kind === "plugin"),
      "Plugin system detected.",
    ),
    sec(
      "configuration",
      "Configuration",
      ["configuration"],
      (i) => (i.signals.configKeys?.length ?? 0) > 0,
      "Framework configuration.",
    ),
    sec(
      "architecture",
      "Architecture",
      ["architecture"],
      (i) => (i.concepts?.length ?? 0) > 3,
      "Internals for contributors.",
    ),
  ],
  backend: [
    sec(
      "architecture",
      "Architecture",
      ["architecture"],
      () => true,
      "Service structure and boundaries.",
    ),
    sec("setup", "Setup", ["guide"], () => true, "Environment setup."),
    sec(
      "configuration",
      "Configuration",
      ["configuration"],
      (i) => (i.signals.configKeys?.length ?? 0) > 0,
      "Service configuration keys.",
    ),
    sec("api", "API", ["api", "reference"], (i) => (i.apis?.length ?? 0) > 0, "HTTP/RPC surface."),
    sec(
      "data-model",
      "Data Model",
      ["concept", "reference"],
      (i) => (i.concepts ?? []).some((c) => c.kind === "model" || c.kind === "entity"),
      "Domain entities detected.",
    ),
    sec("operations", "Operations", ["guide"], (i) => s_hasServer(i), "Running in production."),
    sec(
      "troubleshooting",
      "Troubleshooting",
      ["troubleshooting"],
      () => true,
      "Operational failures.",
    ),
  ],
  monorepo: [
    sec("overview", "Overview", ["overview"], () => true, "Workspace map."),
    sec(
      "packages",
      "Packages",
      ["reference"],
      (i) => i.signals.isMonorepo === true,
      "Package catalog.",
    ),
    sec("architecture", "Architecture", ["architecture"], () => true, "How packages relate."),
    sec("development", "Development", ["guide"], () => true, "Local development workflows."),
    sec("publishing", "Publishing", ["guide"], () => true, "Release process."),
  ],
};

// Fallbacks so composite archetypes still get sensible candidates.
const FALLBACK_CANDIDATES: readonly SectionCandidate[] = SECTION_CANDIDATES["library"]!;

function sec(
  id: string,
  title: string,
  kinds: readonly PageKind[],
  hasEvidence: (input: CompilerProjectInput) => boolean,
  rationale: string,
): SectionCandidate {
  return { id, title, kinds, hasEvidence, rationale: () => rationale };
}

function s_hasServer(input: CompilerProjectInput): boolean {
  return input.signals.hasServer === true;
}

function hasScripts(input: CompilerProjectInput): boolean {
  // Heuristic: if any signals indicate scripts exist, or if package has common scripts
  return (input.signals.commands?.length ?? 0) > 0 || (input.signals.configKeys?.length ?? 0) >= 0;
}

function hasChangelog(input: CompilerProjectInput): boolean {
  return (input.signals.examples?.length ?? 0) >= 0 && false;
  // Deterministic: only if CHANGELOG.md exists — caller should set via signals.examples or dedicated flag
}

/** Threshold above which one conceptual area is split into subpages. */
export const SPLIT_THRESHOLD = 6;

/**
 * Plan the documentation architecture from classification + project input.
 * Deterministic: same input ⇒ same architecture.
 */
export function planArchitecture(
  input: CompilerProjectInput,
  classification: ClassificationResult,
  overrides: ArchitectureOverrides = {},
): {
  sections: DocumentationSection[];
  pages: DocumentationPageDefinition[];
  relationships: DocumentationRelationship[];
} {
  // Collect candidates from all matched archetypes (deduped by id).
  const seen = new Set<string>();
  const candidates: SectionCandidate[] = [];
  for (const archetype of classification.archetypes) {
    for (const candidate of SECTION_CANDIDATES[archetype] ?? []) {
      if (!seen.has(candidate.id)) {
        seen.add(candidate.id);
        candidates.push(candidate);
      }
    }
  }
  if (candidates.length === 0) candidates.push(...FALLBACK_CANDIDATES);

  // Evidence gate + user overrides decide final sections.
  const sections: DocumentationSection[] = [];
  for (const candidate of candidates) {
    const override = overrides.sections?.[candidate.id];
    if (override?.enabled === false) continue;
    const enabledByUser = override?.enabled === true;
    if (!enabledByUser && !candidate.hasEvidence(input)) continue; // empty-section prevention

    const title = override?.title ?? candidate.title;
    sections.push({
      id: candidate.id,
      title,
      kinds: candidate.kinds,
      rationale: candidate.rationale(input),
      pages: [],
      overridden: override !== undefined,
    });
  }

  // ── Pages ────────────────────────────────────────────────────────
  const pages: DocumentationPageDefinition[] = [];
  const ensureSection = (id: string): DocumentationSection | undefined =>
    sections.find((s) => s.id === id);

  const addPage = (
    sectionId: string,
    slug: string,
    title: string,
    kinds: readonly PageKind[],
    summary: string,
    symbols: readonly string[],
    evidence: DocumentationPageDefinition["evidence"],
    importance: number,
    extra?: Partial<
      Pick<DocumentationPageDefinition, "canonical" | "consolidatedFrom" | "splitFrom" | "depth">
    >,
  ): void => {
    if (overrides.excludePages?.includes(slug)) return;
    const section = ensureSection(sectionId);
    if (section === undefined) return;
    pages.push({
      slug,
      title,
      sectionId,
      kinds,
      summary,
      symbols,
      evidence,
      importance,
      depth: extra?.depth ?? "standard",
      canonical: extra?.canonical,
      consolidatedFrom: extra?.consolidatedFrom,
      splitFrom: extra?.splitFrom,
    });
    (section.pages as string[]).push(slug);
  };

  // Introduction / overview page always first when its section survived.
  const introSection = ensureSection("introduction") ?? ensureSection("overview") ?? sections[0];
  if (introSection !== undefined) {
    addPage(
      introSection.id,
      introSection.id === "overview" ? "overview" : "introduction",
      introSection.title,
      ["overview"],
      input.description ?? `Documentation for ${input.name}.`,
      [],
      [{ kind: "file", value: "package.json" }],
      1,
      { depth: "summary" },
    );
  }

  // Getting started / setup / installation. The page keeps its canonical slug
  // title ("Getting Started") even inside an "Installation" section so two
  // pages never share a title.
  const startSection =
    ensureSection("getting-started") ?? ensureSection("setup") ?? ensureSection("installation");
  if (startSection !== undefined) {
    addPage(
      startSection.id,
      "getting-started",
      "Getting Started",
      ["guide", "tutorial"],
      "Installation and first success.",
      [],
      [{ kind: "file", value: "package.json" }],
      0.95,
    );
  }

  // Concept pages — consolidate small concepts, split large ones.
  const conceptSection =
    ensureSection("concepts") ?? ensureSection("core-concepts") ?? ensureSection("data-model");
  if (conceptSection !== undefined && input.concepts !== undefined) {
    const groups = consolidateConcepts(input.concepts);
    for (const group of groups) {
      if (group.members.length >= SPLIT_THRESHOLD && group.sharedPrefix !== undefined) {
        // Split into overview + per-member child pages.
        const parentSlug = slugify(group.name);
        addPage(
          conceptSection.id,
          parentSlug,
          titleize(group.name),
          ["concept"],
          `Overview of ${group.name}.`,
          [],
          group.evidence,
          0.8,
          { depth: "summary" },
        );
        for (const member of group.members.slice(0, SPLIT_THRESHOLD * 2)) {
          addPage(
            conceptSection.id,
            `${parentSlug}/${slugify(member.name)}`,
            titleize(member.name),
            ["concept"],
            member.description ?? "",
            member.relatedApis ?? [],
            [
              {
                kind: "graph",
                value: member.name,
                ...(member.description !== undefined ? { description: member.description } : {}),
              },
            ],
            0.55,
            { splitFrom: parentSlug, depth: "standard" },
          );
        }
      } else {
        addPage(
          conceptSection.id,
          slugify(group.name),
          titleize(group.name),
          ["concept"],
          `Explains ${group.members.map((m) => m.name).join(", ")}.`,
          group.relatedApis ?? [],
          group.evidence,
          group.members.length > 1 ? 0.75 : 0.65,
          {
            consolidatedFrom:
              group.members.length > 1 ? group.members.map((m) => m.name) : undefined,
          },
        );
      }
    }
  }

  // Guides section: task-oriented pages derived from concept clusters.
  const guidesSection = ensureSection("guides") ?? ensureSection("workflows");
  if (guidesSection !== undefined && (input.apis?.length ?? 0) >= 4) {
    addPage(
      guidesSection.id,
      "common-tasks",
      "Common Tasks",
      ["guide"],
      "Recipes for frequent tasks.",
      [],
      [{ kind: "adapter", value: "task-clusters" }],
      0.7,
    );
  }

  // API reference: consolidated by module prefix, deprecated noted.
  const apiSection =
    ensureSection("api-reference") ?? ensureSection("api") ?? ensureSection("commands");
  if (apiSection !== undefined) {
    const apis = (input.apis ?? []).filter((a) =>
      a.boundary !== undefined ? isDocumentable(a.boundary) : true,
    );
    const groups = groupApisByModule(apis);
    if (groups.size <= 1) {
      addPage(
        apiSection.id,
        apiSection.id === "commands" ? "commands-reference" : "api",
        apiSection.title,
        apiSection.id === "commands" ? ["cli-command", "reference"] : ["api", "reference"],
        `Complete reference (${apis.length} exported symbols).`,
        apis.map((a) => a.name),
        apis.slice(0, 20).map((a) => ({ kind: "symbol" as const, value: a.name })),
        0.9,
        { canonical: true, depth: "deep" },
      );
    } else {
      for (const [module, members] of groups) {
        addPage(
          apiSection.id,
          `api/${slugify(module)}`,
          `${titleize(module)} API`,
          ["api", "reference"],
          `APIs from ${module}.`,
          members.map((m) => m.name),
          members.slice(0, 10).map((m) => ({ kind: "symbol" as const, value: m.name })),
          Math.min(0.85, 0.4 + members.length / 20),
        );
      }
    }
  }

  // Configuration page.
  const configSection =
    ensureSection("configuration") ??
    ensureSection("config") ??
    sections.find((s) => s.kinds.includes("configuration"));
  if (configSection !== undefined && (input.signals.configKeys?.length ?? 0) > 0) {
    addPage(
      configSection.id,
      "configuration",
      configSection.title,
      ["configuration", "reference"],
      "All supported configuration options.",
      [],
      (input.signals.configKeys ?? [])
        .slice(0, 30)
        .map((k) => ({ kind: "config" as const, value: k })),
      0.75,
      { canonical: true },
    );
  }

  // Commands pages (CLI archetype).
  if (ensureSection("commands") !== undefined && (input.signals.commands?.length ?? 0) > 0) {
    for (const command of input.signals.commands ?? []) {
      addPage(
        "commands",
        `commands/${slugify(command.name)}`,
        command.name,
        ["cli-command", "reference"],
        command.description ?? `Usage of \`${command.name}\`.`,
        [command.name],
        [{ kind: "command", value: command.name }],
        0.7,
      );
    }
  }

  // Migration page only when meaningful deprecations exist.
  const migrationSection = ensureSection("migration");
  if (migrationSection !== undefined) {
    const deprecated = (input.apis ?? []).filter((a) => a.deprecated === true);
    if (deprecated.length > 0) {
      addPage(
        "migration",
        "migration",
        "Migration Guide",
        ["migration"],
        "Breaking changes and how to migrate.",
        deprecated.map((d) => d.name),
        deprecated.slice(0, 15).map((d) => ({ kind: "symbol" as const, value: d.name })),
        0.6,
      );
    }
  }

  // Installation.
  const installationSection = ensureSection("installation");
  if (installationSection !== undefined) {
    addPage("installation", "installation", "Installation", ["installation", "guide"], "Install with your package manager and verify requirements.", [], [{ kind: "file", value: "package.json" }], 0.9);
  }

  // Quick start.
  const quickStartSection = ensureSection("quick-start");
  if (quickStartSection !== undefined) {
    addPage("quick-start", "quick-start", "Quick Start", ["quick-start", "tutorial"], "Minimal working example using real project APIs.", [], [{ kind: "adapter", value: "quick-start" }], 0.85);
  }

  // Examples.
  const examplesSection = ensureSection("examples");
  if (examplesSection !== undefined) {
    addPage("examples", "examples", "Examples", ["example"], "Curated examples from tests, README and JSDoc.", [], [{ kind: "adapter", value: "examples" }], 0.65);
  }

  // Architecture: module evidence comes from real discovered concepts —
  // never a hardcoded module list.
  const archSection = ensureSection("architecture");
  if (archSection !== undefined) {
    const moduleEvidence: PageEvidence[] = (input.concepts ?? [])
      .filter((c) => c.kind === "module")
      .slice(0, 24)
      .map((c) => ({
        kind: "graph" as const,
        value: c.name,
        ...(c.description !== undefined ? { description: c.description } : {}),
      }));
    addPage(
      "architecture",
      "architecture",
      "Architecture",
      ["architecture"],
      "Modules, responsibilities and data flow.",
      [],
      moduleEvidence.length > 0 ? moduleEvidence : [{ kind: "graph", value: "architecture" }],
      0.7,
    );
    addPage(
      "architecture",
      "architecture/directory-structure",
      "Directory Structure",
      ["architecture"],
      "What each directory does.",
      [],
      moduleEvidence.length > 0
        ? moduleEvidence
        : [{ kind: "file", value: "src/" }],
      0.55,
    );
  }

  // Security.
  const secSection = ensureSection("security");
  if (secSection !== undefined) {
    addPage("security", "security", "Security", ["security"], "Credentials, permissions and secret handling.", [], [{ kind: "config", value: "env:secret" }], 0.5);
  }

  // Performance.
  const perfSection = ensureSection("performance");
  if (perfSection !== undefined) {
    addPage("performance", "performance", "Performance", ["performance"], "Caching, incremental builds and resource limits.", [], [{ kind: "adapter", value: "performance" }], 0.5);
  }

  // Development.
  const devSection = ensureSection("development");
  if (devSection !== undefined) {
    addPage("development", "development", "Development", ["development"], "Local setup, scripts and workflows.", [], [{ kind: "file", value: "package.json#scripts" }], 0.6);
    addPage("development", "development/testing", "Testing", ["testing"], "How to run tests.", [], [{ kind: "file", value: "vitest.config" }], 0.55);
    addPage("development", "development/building", "Building", ["building"], "How to build and where output goes.", [], [{ kind: "file", value: "build" }], 0.55);
  }

  // Contributing.
  const contribSection = ensureSection("contributing");
  if (contribSection !== undefined) {
    addPage("contributing", "contributing", "Contributing", ["contributing"], "How to contribute, code style and PRs.", [], [{ kind: "file", value: "CONTRIBUTING.md" }], 0.5);
  }

  // Changelog.
  const changelogSection = ensureSection("changelog");
  if (changelogSection !== undefined) {
    addPage("changelog", "changelog", "Changelog", ["changelog", "release-notes"], "Version history and migration notes.", [], [{ kind: "file", value: "CHANGELOG.md" }], 0.45);
  }

  // Troubleshooting/FAQ.
  const troubleshootingSection = ensureSection("troubleshooting");
  if (troubleshootingSection !== undefined) {
    addPage(
      "troubleshooting",
      "troubleshooting",
      "Troubleshooting",
      ["troubleshooting", "faq"],
      "Common problems and resolutions.",
      [],
      [{ kind: "adapter", value: "failure-modes" }],
      0.5,
    );
    addPage("troubleshooting", "troubleshooting/faq", "FAQ", ["faq"], "Frequently asked questions.", [], [{ kind: "adapter", value: "faq" }], 0.45);
  }

  // User-declared extra pages win their slot.
  for (const extra of overrides.extraPages ?? []) {
    const section = ensureSection(extra.sectionId);
    if (section === undefined) continue;
    if (overrides.excludePages?.includes(extra.slug)) continue;
    pages.push({
      slug: extra.slug,
      title: extra.title,
      sectionId: extra.sectionId,
      kinds: extra.kinds ?? ["reference"],
      summary: "User-defined page.",
      symbols: [],
      evidence: [],
      importance: 1,
      depth: "standard",
      canonical: true,
    });
    (section.pages as string[]).push(extra.slug);
  }

  // Drop sections that ended up with zero pages (never ship empty shells).
  const populatedSections = sections.filter((s) => s.pages.length > 0);

  // ── Relationships ────────────────────────────────────────────────
  const relationships = deriveRelationships(pages);

  return { sections: populatedSections, pages, relationships };
}

/** Derive semantic relationships between planned pages. */
export function deriveRelationships(
  pages: readonly DocumentationPageDefinition[],
): DocumentationRelationship[] {
  const rels: DocumentationRelationship[] = [];
  const slugs = new Set(pages.map((p) => p.slug));
  const bySlug = new Map(pages.map((p) => [p.slug, p]));

  const push = (
    from: string,
    to: string,
    kind: DocumentationRelationship["kind"],
    reason?: string,
  ) => {
    if (slugs.has(from) && slugs.has(to)) rels.push({ from, to, kind, reason });
  };

  for (const page of pages) {
    // Prerequisite chain: getting-started precedes everything conceptual/api.
    if (
      page.slug !== "getting-started" &&
      (page.kinds.includes("concept") || page.kinds.includes("api"))
    ) {
      push("getting-started", page.slug, "prerequisite", "Start here before this topic.");
    }

    // Symbol overlap ⇒ related.
    if (page.symbols.length > 0) {
      for (const other of pages) {
        if (other.slug === page.slug || other.symbols.length === 0) continue;
        const overlap = page.symbols.some((sym) => other.symbols.includes(sym));
        if (overlap) {
          const [a, b] = [page.slug, other.slug].sort();
          if (a !== undefined && b !== undefined) {
            push(a, b, "related", "Shares documented symbols.");
          }
        }
      }
    }

    // Split children: next-step chain between siblings.
    if (page.splitFrom !== undefined) {
      const siblings = pages.filter((p) => p.splitFrom === page.splitFrom);
      const idx = siblings.indexOf(page);
      if (idx > 0) {
        const prev = siblings[idx - 1];
        if (prev !== undefined) push(prev.slug, page.slug, "next-step");
      }
      push(page.splitFrom, page.slug, "extends", "Part of the parent concept.");
    }

    // Example-for links: only when the example page actually covers symbols
    // also documented on the target page (evidence-based, never automatic).
    if (page.kinds.includes("example") && page.symbols.length > 0) {
      const target = bySlug.get("getting-started");
      if (
        target !== undefined &&
        page.slug !== "getting-started" &&
        target.symbols.some((sym) => page.symbols.includes(sym))
      ) {
        push(page.slug, "getting-started", "example-for");
      }
    }
  }

  // Dedupe.
  const seenRels = new Set<string>();
  return rels.filter((r) => {
    const key = `${r.from}|${r.to}|${r.kind}`;
    if (seenRels.has(key)) return false;
    seenRels.add(key);
    return true;
  });
}

// ─── Consolidation & Grouping ────────────────────────────────────────────

interface ConceptGroup {
  readonly name: string;
  readonly sharedPrefix?: string;
  readonly members: readonly {
    name: string;
    kind: string;
    description?: string;
    relatedApis?: readonly string[];
  }[];
  readonly relatedApis?: readonly string[];
  readonly evidence: DocumentationPageDefinition["evidence"];
}

/** Consolidate related concepts onto single pages using shared prefixes. */
export function consolidateConcepts(
  concepts: readonly { name: string; kind: string; relatedApis?: readonly string[]; description?: string }[],
): readonly ConceptGroup[] {
  const groups: ConceptGroup[] = [];
  const used = new Set<number>();

  for (let i = 0; i < concepts.length; i++) {
    if (used.has(i)) continue;
    const concept = concepts[i];
    if (concept === undefined) continue;
    used.add(i);

    const prefix = detectSharedPrefix(concept.name);
    const members = [
      {
        name: concept.name,
        kind: concept.kind,
        // No invented description: undefined stays undefined and renders as a bare name.
        description: concept.description,
        relatedApis: concept.relatedApis,
      },
    ];
    let sharedPrefix: string | undefined;

    if (prefix !== undefined) {
      for (let j = i + 1; j < concepts.length; j++) {
        if (used.has(j)) continue;
        const other = concepts[j];
        if (other === undefined) continue;
        if (other.name.startsWith(prefix)) {
          used.add(j);
          members.push({
            name: other.name,
            kind: other.kind,
            description: other.description,
            relatedApis: other.relatedApis,
          });
        }
      }
      if (members.length > 1) sharedPrefix = prefix;
    }

    const relatedApis = [...new Set(members.flatMap((m) => m.relatedApis ?? []))];
    groups.push({
      name: sharedPrefix !== undefined ? sharedPrefix.replace(/-$/, "") : concept.name,
      sharedPrefix,
      members,
      relatedApis: relatedApis.length > 0 ? relatedApis : undefined,
      evidence: members.map((m) => ({ kind: "graph" as const, value: m.name, description: m.description })),
    });
  }

  return groups;
}

/**
 * Group APIs by source module (directory or file stem) so that related
 * functions land on one reference page instead of N tiny ones.
 */
export function groupApisByModule(
  apis: readonly { name: string; sourceFile?: string }[],
): Map<string, { name: string; sourceFile?: string }[]> {
  const groups = new Map<string, { name: string; sourceFile?: string }[]>();
  for (const api of apis) {
    const module = moduleOf(api.sourceFile);
    const existing = groups.get(module) ?? [];
    existing.push(api);
    groups.set(module, existing);
  }
  return groups;
}

function moduleOf(sourceFile?: string): string {
  if (sourceFile === undefined) return "";
  const parts = sourceFile.split("/");
  parts.pop(); // drop filename
  return parts.join("/") || ".";
}

/** Detect a meaningful shared prefix like `use` in useState/useEffect. */
function detectSharedPrefix(name: string): string | undefined {
  const camelMatch = /^([a-z]{3,})(?=[A-Z])/.exec(name);
  if (camelMatch?.[1] !== undefined && !STOP_PREFIXES.has(camelMatch[1])) {
    return camelMatch[1];
  }
  const kebabMatch = /^([a-z]{3,})-/.exec(name);
  if (kebabMatch?.[1] !== undefined && !STOP_PREFIXES.has(kebabMatch[1])) {
    return kebabMatch[1];
  }
  return undefined;
}

const STOP_PREFIXES = new Set(["get", "set", "has", "is", "on", "the"]);

// ─── Boundary & String Helpers ───────────────────────────────────────────

/** Which boundary classes default into documentation. */
export function isDocumentable(boundary: SymbolBoundary): boolean {
  return boundary === "public" || boundary === "semi-public";
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function titleize(slugOrName: string): string {
  return slugOrName
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
