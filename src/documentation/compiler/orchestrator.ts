/**
 * Documentation Orchestrator.
 *
 * The compiler entry point:
 *
 *   plan → stage → generate → validate → commit
 *
 * Deterministic intelligence plans and builds the architecture; AI is an
 * optional enrichment step behind validation. Generation is staged: the
 * previous valid snapshot is preserved until commit succeeds.
 */

import { hashString } from "../../utils/hash.js";
import type {
  ArchitectureOverrides,
  CompilerProjectInput,
  ComposedExample,
  DocumentationArchitecture,
  DocumentationCompilationResult,
  DocumentationPageDefinition,
} from "./types.js";
import { classifyProject } from "./classifier.js";
import { matchAdapters } from "./framework/adapters.js";
import { planArchitecture } from "./planner.js";
import { organizeNavigation, buildLearningPaths } from "./organizer.js";
import { computeCoverage } from "./coverage.js";
import { resolveCanonicalPages } from "./resolver.js";
import { validateArchitecture, validateIRPages, validateBreadcrumbs, sortDiagnostics } from "./validator.js";
import { diagnostic } from "./diagnostics.js";
import type { DocumentationDiagnostic } from "./diagnostics.js";
import type { DocumentationIR, IRBlock, IRPage, IRSection } from "./ir.js";
import { IR_SCHEMA_VERSION } from "./ir.js";

/** ─── Architecture Compilation ──────────────────────────────────────── */

/**
 * Compile the documentation architecture for a project.
 * Deterministic: identical input produces an identical architecture.
 */
export function compileArchitecture(
  input: CompilerProjectInput,
  overrides: ArchitectureOverrides = {},
): DocumentationArchitecture {
  const classification = classifyProject(input);

  // Framework adapters enrich concepts before planning.
  const enriched = enrichWithAdapters(input);

  const planned = planArchitecture(enriched, classification, overrides);

  // Navigation + journeys + breadcrumbs from the assembled architecture.
  const navigation = organizeNavigation({
    sections: planned.sections,
    pages: planned.pages,
    project: {
      name: input.name,
      archetypes: classification.archetypes,
      personas: classification.personas,
    },
  });
  const learningPaths = buildLearningPaths(navigation, classification.personas);

  const architecture: DocumentationArchitecture = {
    schemaVersion: 1,
    project: {
      name: input.name,
      description: input.description,
      archetypes: classification.archetypes,
      personas: classification.personas,
    },
    sections: planned.sections,
    pages: planned.pages,
    relationships: planned.relationships,
    navigation,
    learningPaths,
    coverage: computeCoverage(enriched, planned.pages),
  };

  // Mark canonical pages.
  const resolution = resolveCanonicalPages(planned.pages);
  if (Object.keys(resolution.canonicalMap).length > 0) {
    const canonicalSlugs = new Set(Object.values(resolution.canonicalMap));
    for (const page of architecture.pages) {
      (page as { canonical?: boolean }).canonical =
        canonicalSlugs.has(page.slug) || page.canonical === true;
    }
  }

  return architecture;
}

/** Merge adapter contributions into the compiler input. */
function enrichWithAdapters(input: CompilerProjectInput): CompilerProjectInput {
  const matching = matchAdapters(input);
  if (matching.length === 0) return input;

  const extraConcepts = matching.flatMap((a) => a.getImportantConcepts?.(input) ?? []);
  const existingConcepts = input.concepts ?? [];
  const seen = new Set(existingConcepts.map((c) => c.name.toLowerCase()));
  const mergedConcepts = [
    ...existingConcepts,
    ...extraConcepts.filter((c) => !seen.has(c.name.toLowerCase())),
  ];

  return { ...input, concepts: mergedConcepts };
}

/** ─── IR Generation ─────────────────────────────────────────────────── */

/**
 * Build the versioned Documentation IR from an architecture.
 * Deterministic content comes from evidence; empty pages are dropped
 * (with a diagnostic) rather than shipped as placeholders.
 */
export function buildIR(
  architecture: DocumentationArchitecture,
  options: {
    /** User-requested pages that may ship even without full evidence. */
    readonly allowPlaceholders?: boolean;
    /** Rich API symbols from the semantic analyzer (Phase 21). */
    readonly apiSymbols?: CompilerProjectInput["apiSymbols"];
    /** Validated, ranked examples for the examples/quick-start composers. */
    readonly examples?: readonly ComposedExample[];
  } = {},
): { ir: DocumentationIR; diagnostics: DocumentationDiagnostic[] } {
  const diagnostics: DocumentationDiagnostic[] = [];
  const irSections: IRSection[] = [];
  const irPages: IRPage[] = [];

  // Index API symbols by name for O(1) lookup
  type ApiSymbolEntry = NonNullable<CompilerProjectInput["apiSymbols"]>[number];
  const apiSymbolsByName = new Map<string, ApiSymbolEntry>();
  if (options.apiSymbols !== undefined) {
    for (const sym of options.apiSymbols) {
      apiSymbolsByName.set(sym.name, sym);
    }
  }

  for (const section of architecture.sections) {
    irSections.push({
      id: section.id,
      title: section.title,
      pageSlugs: [...section.pages],
    });

    for (const slug of section.pages) {
      const page = architecture.pages.find((p) => p.slug === slug);
      if (page === undefined) continue;

      const blocks = buildPageBlocks(
        page,
        architecture,
        options.allowPlaceholders === true,
        apiSymbolsByName,
        options.examples ?? [],
      );
      const meaningful = blocks.some((b) => b.kind !== "heading");

      if (!meaningful && options.allowPlaceholders !== true) {
        diagnostics.push(
          diagnostic(
            "DOC_EMPTY_PAGE",
            "warning",
            `"${page.title}" has no evidence-backed content; page skipped.`,
            page.slug,
            "Provide evidence (symbols/config/examples) or author this page manually.",
          ),
        );
        continue;
      }

      irPages.push({
        slug: page.slug,
        title: page.title,
        sectionId: page.sectionId,
        description: page.summary,
        blocks,
        examples: [],
        claims: [],
        references: architecture.relationships
          .filter((r) => r.from === page.slug)
          .map((r) => ({ sourcePage: page.slug, targetSlug: r.to, relationship: r.kind })),
        fingerprint: fingerprintPage(page),
        provenance: "compiler",
      });
    }
  }

  const navigation = {
    sidebar: architecture.navigation.sidebar.map((node) => ({
      label: node.label,
      slug: node.slug,
      children: node.children?.map((c) => ({ label: c.label, slug: c.slug ?? "" })),
    })),
    breadcrumbs: Object.fromEntries(
      Object.entries(architecture.navigation.breadcrumbs).map(([slug, trail]) => [
        slug,
        trail.map((t) => ({ label: t.label, ...(t.slug !== undefined ? { slug: t.slug } : {}) })),
      ]),
    ),
  };

  return {
    ir: {
      schemaVersion: IR_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      sections: irSections,
      pages: irPages,
      navigation,
    },
    diagnostics,
  };
}

/**
 * Deterministic evidence-backed blocks for one page.
 *
 * Page title and summary live in IR page metadata ONLY (rendered once by each
 * renderer from metadata). Composers must never emit a duplicate H1 or repeat
 * the summary — see DUPLICATE_TITLE regression coverage.
 */
function buildPageBlocks(
  page: DocumentationPageDefinition,
  architecture: DocumentationArchitecture,
  allowPlaceholders: boolean,
  apiSymbolsByName: Map<string, ApiSymbolEntry>,
  composedExamples: readonly ComposedExample[],
): IRBlock[] {
  const blocks: IRBlock[] = [];

  // Introduction: purpose (summary metadata) + audience + journey, all from
  // architecture scope. No invented capabilities.
  if (page.kinds.includes("overview") && page.slug === "introduction") {
    const personas = [...architecture.project.personas]
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 3);
    if (personas.length > 0) {
      blocks.push({ kind: "heading", level: 2, text: "Who is it for" });
      blocks.push({
        kind: "list",
        ordered: false,
        items: personas.map((p) => humanizePersona(p.persona)),
      });
    }
    const journey = architecture.navigation.primaryJourney.filter((s) => s !== page.slug).slice(0, 4);
    if (journey.length > 0) {
      const titles = new Map(architecture.pages.map((p) => [p.slug, p.title] as const));
      blocks.push({ kind: "heading", level: 2, text: "Where to go next" });
      blocks.push({
        kind: "list",
        ordered: true,
        items: journey.map((s) => `\`${titles.get(s) ?? s}\``),
      });
    }
  }

  // API pages: rich per-symbol content when apiSymbols are available, thin list otherwise.
  if (page.symbols.length > 0) {
    const resolvedSymbols = page.symbols
      .map((name) => apiSymbolsByName.get(name))
      .filter((s): s is ApiSymbolEntry => s !== undefined);

    if (resolvedSymbols.length > 0) {
      // Rich API documentation — group by kind and render per-symbol
      const byKind = groupApiSymbolsByKind(resolvedSymbols);

      for (const [kind, kindLabel] of [
        ["function", "Functions"],
        ["class", "Classes"],
        ["interface", "Interfaces"],
        ["type-alias", "Types"],
        ["enum", "Enums"],
        ["variable", "Variables"],
        ["constant", "Constants"],
      ] as const) {
        const kindSymbols = byKind[kind];
        if (kindSymbols === undefined || kindSymbols.length === 0) continue;

        blocks.push({ kind: "heading", level: 2, text: kindLabel });
        for (const sym of kindSymbols) {
          blocks.push(...buildRichApiSymbolBlocks(sym));
        }
      }
    } else if (page.symbols.length > 0) {
      // Fallback: thin bullet list (no rich data available)
      blocks.push({ kind: "heading", level: 2, text: "Covered APIs" });
      blocks.push({
        kind: "list",
        ordered: false,
        items: page.symbols.map((symbol) => `\`${symbol}\``),
      });
    }
  }

  // Configuration pages enumerate keys.
  const configEvidence = page.evidence.filter((e) => e.kind === "config");
  if (configEvidence.length > 0) {
    blocks.push({ kind: "heading", level: 2, text: "Options" });
    blocks.push({
      kind: "table",
      headers: ["Option"],
      rows: configEvidence.map((e) => [`\`${e.value}\``]),
    });
  }

  // CLI command pages show usage line.
  if (page.kinds.includes("cli-command")) {
    blocks.push({ kind: "heading", level: 2, text: "Usage" });
    blocks.push({
      kind: "code",
      language: "bash",
      code: `npx ${architecture.project.name.toLowerCase()} ${page.slug.split("/").pop() ?? page.slug}`,
    });
  }

  // Installation pages: package manager commands.
  if (page.kinds.includes("installation")) {
    const pkg = architecture.project.name;
    blocks.push({ kind: "heading", level: 2, text: "Install" });
    blocks.push({ kind: "code", language: "bash", code: `npm install ${pkg}\n# or\npnpm add ${pkg}\n# or\nyarn add ${pkg}` });
    blocks.push({ kind: "heading", level: 2, text: "Requirements" });
    blocks.push({ kind: "paragraph", text: "Node.js >= 20 is required. Verify with `node -v`." });
  }

  // Getting started: narrative path across pages that actually exist in this
  // architecture (install → command/config → api). Distinct from the
  // installation reference and the quick-start minimal example.
  if (page.slug === "getting-started") {
    const bySlug = new Map(architecture.pages.map((p) => [p.slug, p] as const));
    const steps: string[] = [];
    const install = bySlug.get("installation");
    if (install !== undefined) steps.push(`Install — see \`${install.title}\``);
    const firstCommand = architecture.pages.find((p) => p.kinds.includes("cli-command"));
    if (firstCommand !== undefined) steps.push(`Run your first command — see \`${firstCommand.title}\``);
    const configuration = bySlug.get("configuration");
    if (configuration !== undefined) steps.push(`Configure — see \`${configuration.title}\``);
    const api = architecture.pages.find((p) => p.kinds.includes("api"));
    if (api !== undefined) steps.push(`Explore the API — see \`${api.title}\``);
    if (steps.length > 0) {
      blocks.push({ kind: "heading", level: 2, text: "Steps" });
      blocks.push({ kind: "list", ordered: true, items: steps });
    }
  }

  // Quick start: a real minimal path. Prefer a validated JSDoc example from an
  // exported symbol; otherwise show the honest structural import without
  // inventing calls, behavior, or output.
  if (page.kinds.includes("quick-start")) {
    const verified = composedExamples.find((e) => e.owner !== undefined);
    blocks.push({ kind: "heading", level: 2, text: "Install" });
    blocks.push({
      kind: "code",
      language: "bash",
      code: `npm install ${architecture.project.name}`,
    });
    blocks.push({ kind: "heading", level: 2, text: "Minimal example" });
    if (verified !== undefined) {
      if (verified.purpose !== undefined && verified.purpose.length > 0) {
        blocks.push({ kind: "paragraph", text: verified.purpose });
      }
      blocks.push({ kind: "code", language: verified.language, code: verified.code, title: verified.title });
      blocks.push({
        kind: "paragraph",
        text: `See \`${verified.owner}\` in the API reference for full signature and options.`,
      });
    } else if (page.symbols.length > 0) {
      blocks.push({
        kind: "code",
        language: "ts",
        code: `import { ${page.symbols[0]} } from "${architecture.project.name}";`,
      });
      blocks.push({
        kind: "paragraph",
        text: `Start from \`${page.symbols[0]}\` — its API reference documents parameters, return type, and options.`,
      });
    } else {
      blocks.push({
        kind: "callout",
        tone: "note",
        text: "No verified minimal example could be derived from this project's exports yet.",
      });
    }
  }

  // Architecture pages: real discovered modules only. Diagrams require edge
  // evidence (unavailable here) and are omitted rather than fabricated.
  if (page.kinds.includes("architecture")) {
    const modules = page.evidence.filter((e) => e.kind === "graph" && e.value !== "architecture");
    if (modules.length > 0) {
      const shown = modules.slice(0, 12);
      blocks.push({ kind: "heading", level: 2, text: "Modules" });
      blocks.push({
        kind: "table",
        headers: ["Module", "Responsibility"],
        rows: shown.map((e) => [`\`${e.value}\``, e.description ?? "Source module"]),
      });
      if (modules.length > shown.length) {
        blocks.push({
          kind: "paragraph",
          text: `…and ${modules.length - shown.length} more modules (see Concepts).`,
        });
      }
    }
    // No module evidence → no blocks: the page is evidence-gated out with a
    // diagnostic rather than shipped with filler.
  }

  // Security/performance pages: callouts with evidence.
  if (page.kinds.includes("security")) {
    blocks.push({ kind: "callout", tone: "warning", text: "Never commit secrets. Use environment variables and `.env` excluded from the scanner." });
    const envEvidence = page.evidence.filter((e) => e.kind === "config" && e.value.startsWith("env:"));
    if (envEvidence.length > 0) {
      blocks.push({ kind: "table", headers: ["Variable", "Purpose"], rows: envEvidence.map((e) => [e.value, "Secret — redacted at build"] ) });
    }
  }
  if (page.kinds.includes("performance")) {
    blocks.push({ kind: "list", ordered: false, items: ["Cache under `.vetwo/docs/` with integrity check", "Incremental builds via `fileHashes`", "Watch mode via chokidar", "Bounded concurrency for type formatting"] });
  }

  // Development / testing / building pages.
  if (page.kinds.includes("development")) {
    blocks.push({ kind: "code", language: "bash", code: "pnpm install\npnpm dev\npnpm test\npnpm build" });
  }
  if (page.kinds.includes("testing")) {
    blocks.push({ kind: "paragraph", text: "Tests use Vitest. Run `pnpm test` or `pnpm coverage`." });
  }
  if (page.kinds.includes("building")) {
    blocks.push({ kind: "paragraph", text: "Build via `tsup` to `dist/`; output is declared in `package.json#exports`." });
  }
  if (page.kinds.includes("contributing")) {
    blocks.push({ kind: "paragraph", text: "See repository for code style (Prettier + ESLint), PR workflow and release process." });
  }
  if (page.kinds.includes("changelog") || page.kinds.includes("release-notes")) {
    blocks.push({ kind: "paragraph", text: "See `CHANGELOG.md` and git tags for version history." });
  }
  // Concepts: member lists from graph evidence + related APIs from symbols.
  // Evidence-carried descriptions render; nothing is invented. The page's own
  // evidence description (e.g. a module responsibility) renders as the lead
  // paragraph; other members list beneath it. Self name-links are excluded.
  if (page.kinds.includes("concept")) {
    const selfKey = page.title.toLowerCase();
    const selfEvidence = page.evidence.find(
      (e) => e.kind === "graph" && (e.value.toLowerCase() === selfKey || e.value.toLowerCase() === page.slug.toLowerCase()),
    );
    if (selfEvidence?.description !== undefined && selfEvidence.description.length > 0) {
      blocks.push({ kind: "paragraph", text: selfEvidence.description });
    }
    const seen = new Set<string>();
    const members: { name: string; description?: string }[] = [];
    for (const e of page.evidence) {
      if (e.kind !== "graph") continue;
      const key = e.value.toLowerCase();
      if (key === selfKey || key === page.slug.toLowerCase() || seen.has(key)) continue;
      seen.add(key);
      members.push({ name: e.value, description: e.description });
    }
    if (members.length > 0) {
      blocks.push({ kind: "heading", level: 2, text: "In this concept" });
      blocks.push({
        kind: "list",
        ordered: false,
        items: members.map((m) =>
          m.description !== undefined ? `\`${m.name}\` — ${m.description}` : `\`${m.name}\``,
        ),
      });
    }
    if (page.symbols.length > 0) {
      blocks.push({ kind: "heading", level: 2, text: "Related APIs" });
      blocks.push({
        kind: "list",
        ordered: false,
        items: page.symbols.map((s) => `\`${s}\``),
      });
    }
  }

  // Examples: materialize real validated examples — never describe discovery.
  if (page.kinds.includes("example")) {
    const shown = composedExamples.slice(0, 8);
    if (shown.length === 0) {
      blocks.push({
        kind: "callout",
        tone: "note",
        text: "No validated examples were discovered in this project's JSDoc tags or example directories.",
      });
    }
    for (const example of shown) {
      blocks.push({ kind: "heading", level: 2, text: example.title });
      if (example.purpose !== undefined && example.purpose.length > 0) {
        blocks.push({ kind: "paragraph", text: example.purpose });
      }
      blocks.push({
        kind: "code",
        language: example.language,
        code: example.code,
        title: example.source,
      });
      if (example.owner !== undefined) {
        blocks.push({ kind: "paragraph", text: `Related API: \`${example.owner}\`.` });
      }
    }
  }
  if (page.kinds.includes("troubleshooting") || page.kinds.includes("faq")) {
    blocks.push({
      kind: "paragraph",
      text: "Run `docs doctor` to diagnose setup problems; its checks enumerate what was verified and what failed.",
    });
  }

  // Explicitly user-requested pages may ship thin; mark them clearly.
  if (allowPlaceholders && blocks.length === 0) {
    blocks.push({
      kind: "callout",
      tone: "note",
      text: "This page was requested explicitly and awaits content.",
    });
  }

  return blocks;
}

/** Human-readable audience label for a documentation persona (no invented claims). */
function humanizePersona(persona: string): string {
  const known: Record<string, string> = {
    "end-user": "End users",
    developer: "Developers",
    "api-consumer": "API consumers",
    "application-developer": "Application developers",
    "plugin-author": "Plugin authors",
    maintainer: "Maintainers",
    contributor: "Contributors",
    operator: "Operators",
    administrator: "Administrators",
    integrator: "Integrators",
  };
  return known[persona] ?? persona;
}

/** Fingerprint covering all inputs that should invalidate a page. */
function fingerprintPage(page: DocumentationPageDefinition): string {
  return hashString(
    JSON.stringify({
      title: page.title,
      summary: page.summary,
      symbols: [...page.symbols].sort(),
      kinds: [...page.kinds].sort(),
      evidence: page.evidence.map((e) => `${e.kind}:${e.value}:${e.description ?? ""}`).sort(),
    }),
  );
}

/** ─── Full Compilation ──────────────────────────────────────────────── */

/**
 * Compile a full result: architecture + IR + diagnostics.
 */
export function compileDocumentation(
  input: CompilerProjectInput,
  overrides: ArchitectureOverrides = {},
  extra: { examples?: readonly ComposedExample[] } = {},
): DocumentationCompilationResult {
  const architecture = compileArchitecture(input, overrides);
  const { ir, diagnostics: irDiagnostics } = buildIR(architecture, {
    apiSymbols: input.apiSymbols,
    examples: extra.examples,
  });
  const diagnostics = sortDiagnostics([
    ...validateArchitecture(architecture, input),
    ...validateIRPages(ir.pages),
    ...validateBreadcrumbs(ir.navigation.breadcrumbs),
    ...irDiagnostics,
  ]);

  return { architecture, ir, diagnostics };
}

/** ─── Staging, Snapshots & Diffs ────────────────────────────────────── */

/** A stored compilation snapshot (before/after comparison support). */
export interface DocumentationSnapshot {
  readonly createdAt: string;
  readonly architectureFingerprint: string;
  readonly pages: Readonly<Record<string, string>>; // slug → page fingerprint
  readonly navigationOrder: readonly string[];
  readonly architecture: DocumentationArchitecture;
}

/** Storage interface for snapshots (in-memory default; fs-backed in CLI). */
export interface SnapshotStore {
  load(): DocumentationSnapshot | undefined;
  save(snapshot: DocumentationSnapshot): void;
  history(limit?: number): readonly DocumentationSnapshot[];
}

/** Create an in-memory snapshot store (tests / ephemeral use). */
export function createMemorySnapshotStore(): SnapshotStore {
  let current: DocumentationSnapshot | undefined;
  const history: DocumentationSnapshot[] = [];
  return {
    load: () => current,
    save: (snapshot) => {
      current = snapshot;
      history.unshift(snapshot);
    },
    history: (limit = 10) => history.slice(0, limit),
  };
}

/**
 * Plan stage: compile architecture and compare against the last snapshot.
 */
export function planCompilation(
  input: CompilerProjectInput,
  store: SnapshotStore,
  overrides: ArchitectureOverrides = {},
): {
  architecture: DocumentationArchitecture;
  changes: DocumentationDiff;
} {
  const architecture = compileArchitecture(input, overrides);
  const previous = store.load();
  return {
    architecture,
    changes: diffSnapshots(previous, architecture),
  };
}

/** A meaningful (non-markdown) documentation diff. */
export interface DocumentationDiff {
  readonly addedPages: readonly string[];
  readonly removedPages: readonly string[];
  readonly updatedPages: readonly string[];
  readonly navigationChanged: boolean;
  readonly architectureChanged: boolean;
  readonly isEmpty: boolean;
}

/** Diff the previous snapshot against a newly compiled architecture. */
export function diffSnapshots(
  previous: DocumentationSnapshot | undefined,
  next: DocumentationArchitecture,
): DocumentationDiff {
  const currentFingerprints: Record<string, string> = {};
  for (const page of next.pages) {
    currentFingerprints[page.slug] = fingerprintPage(page);
  }

  const prev = previous?.pages ?? {};
  const addedPages = Object.keys(currentFingerprints).filter((s) => !(s in prev));
  const removedPages = Object.keys(prev).filter((s) => !(s in currentFingerprints));
  const updatedPages = Object.keys(currentFingerprints).filter(
    (s) => s in prev && prev[s] !== currentFingerprints[s],
  );

  const nextNavOrder = next.navigation.sidebar.flatMap((n) => [
    n.label,
    ...(n.children ?? []).map((c) => c.label),
  ]);
  const navigationChanged =
    previous !== undefined &&
    JSON.stringify(previous.navigationOrder) !== JSON.stringify(nextNavOrder);

  const architectureChanged =
    previous !== undefined &&
    JSON.stringify(previous.architecture.project.archetypes) !==
      JSON.stringify(next.project.archetypes);

  return {
    addedPages,
    removedPages,
    updatedPages,
    navigationChanged,
    architectureChanged,
    isEmpty:
      addedPages.length === 0 &&
      removedPages.length === 0 &&
      updatedPages.length === 0 &&
      !navigationChanged &&
      !architectureChanged,
  };
}

/** Compute slug → fingerprint map for an architecture (used by snapshots). */
export function computePageFingerprints(
  architecture: DocumentationArchitecture,
): Record<string, string> {
  const pages: Record<string, string> = {};
  for (const page of architecture.pages) {
    pages[page.slug] = fingerprintPage(page);
  }
  return pages;
}

/** Snapshot the staged result (call after successful validation). */
export function snapshotArchitecture(
  architecture: DocumentationArchitecture,
  store: SnapshotStore,
): DocumentationSnapshot {
  const pages: Record<string, string> = {};
  for (const page of architecture.pages) {
    pages[page.slug] = fingerprintPage(page);
  }
  const snapshot: DocumentationSnapshot = {
    createdAt: new Date().toISOString(),
    architectureFingerprint: hashString(JSON.stringify(architecture.project)),
    pages,
    navigationOrder: architecture.navigation.sidebar.flatMap((n) => [
      n.label,
      ...(n.children ?? []).map((c) => c.label),
    ]),
    architecture,
  };
  store.save(snapshot);
  return snapshot;
}

// ─── Rich API Symbol Helpers (Phase 21) ──────────────────────────────────

type ApiSymbolEntry = NonNullable<CompilerProjectInput["apiSymbols"]>[number];

/** Group API symbols by kind. */
function groupApiSymbolsByKind(
  symbols: readonly ApiSymbolEntry[],
): Readonly<Record<string, ApiSymbolEntry[]>> {
  const groups: Record<string, ApiSymbolEntry[]> = {};
  for (const sym of symbols) {
    (groups[sym.kind] ??= []).push(sym);
  }
  return groups;
}

/** Build rich IR blocks for a single API symbol. */
function buildRichApiSymbolBlocks(
  sym: ApiSymbolEntry,
): IRBlock[] {
  const blocks: IRBlock[] = [];

  // Signature block
  blocks.push({
    kind: "custom",
    component: "ApiSignature",
    props: {
      name: sym.name,
      kind: sym.kind,
      signature: buildSymbolSignature(sym),
      returnType: sym.returnType,
      typeParameters: sym.typeParameters,
      deprecated: sym.deprecated,
      sourceFile: sym.sourceFile,
      line: sym.line,
      anchor: `${sym.kind}-${sym.name}`,
    },
  });

  // Deprecation callout
  if (sym.deprecated !== false) {
    const message =
      typeof sym.deprecated === "string" ? sym.deprecated : "Use the replacement API instead.";
    blocks.push({
      kind: "callout",
      tone: "deprecated",
      text: `**Deprecated.** ${message}`,
    });
  }

  // Description
  if (sym.documentation.summary.length > 0) {
    blocks.push({ kind: "paragraph", text: sym.documentation.summary });
  }

  // Type parameters
  if (sym.typeParameters !== undefined && sym.typeParameters.length > 0) {
    blocks.push({
      kind: "custom",
      component: "TypeParameterTable",
      props: { typeParameters: sym.typeParameters },
    });
  }

  // Parameters table
  if (sym.parameters !== undefined && sym.parameters.length > 0) {
    blocks.push({
      kind: "custom",
      component: "ParameterTable",
      props: {
        parameters: sym.parameters.map((p) => ({
          name: p.name,
          type: p.type,
          description: p.description,
          required: p.required,
          defaultValue: p.defaultValue,
          rest: p.rest,
        })),
      },
    });
  }

  // Return type
  if (sym.returnType !== undefined && sym.returnType !== "void") {
    blocks.push({
      kind: "custom",
      component: "TypeDisplay",
      props: { label: "Returns", type: sym.returnType },
    });
  }

  // Heritage (extends/implements)
  if (sym.extends !== undefined || (sym.implements !== undefined && sym.implements.length > 0)) {
    blocks.push({
      kind: "custom",
      component: "HeritageDisplay",
      props: { extends: sym.extends, implements: sym.implements },
    });
  }

  // Members (classes/interfaces)
  if (sym.members !== undefined && sym.members.length > 0) {
    blocks.push({
      kind: "custom",
      component: "ApiMemberList",
      props: {
        members: sym.members.map((m) => ({
          name: m.name,
          kind: m.kind,
          signature: m.signature,
          description: m.description,
          required: m.required,
          static: m.static,
          readonly: m.readonly,
          access: m.access,
          deprecated: m.deprecated,
        })),
      },
    });
  }

  // Enum members
  if (sym.enumMembers !== undefined && sym.enumMembers.length > 0) {
    blocks.push({
      kind: "table",
      headers: ["Member", "Value", "Description"],
      rows: sym.enumMembers.map((m) => [
        `\`${m.name}\``,
        `\`${String(m.value)}\``,
        m.description,
      ]),
    });
  }

  // Examples
  if (sym.documentation.examples.length > 0) {
    for (const example of sym.documentation.examples) {
      blocks.push({
        kind: "code",
        language: example.language,
        code: example.code,
        title: example.title,
      });
    }
  }

  // Throws documentation
  if (sym.documentation.throws !== undefined && sym.documentation.throws.length > 0) {
    blocks.push({ kind: "heading", level: 3, text: "Throws" });
    for (const t of sym.documentation.throws) {
      const text = t.type !== undefined ? `\`${t.type}\`: ${t.description}` : t.description;
      blocks.push({ kind: "paragraph", text });
    }
  }

  // See also
  if (sym.documentation.see !== undefined && sym.documentation.see.length > 0) {
    blocks.push({
      kind: "list",
      ordered: false,
      items: sym.documentation.see.map((s) =>
        s.url !== undefined ? `[${s.text}](${s.url})` : `\`${s.text}\``,
      ),
    });
  }

  blocks.push({ kind: "horizontal-rule" });
  return blocks;
}

/** Build a human-readable signature string for a symbol. */
function buildSymbolSignature(
  sym: ApiSymbolEntry,
): string {
  switch (sym.kind) {
    case "function": {
      const params =
        sym.parameters
          ?.map((p) => {
            const parts = [p.rest ? "..." : "", p.name];
            if (!p.required) parts.push("?");
            if (p.type !== "any") parts.push(`: ${p.type}`);
            return parts.join("");
          })
          .join(", ") ?? "";
      const typeParams =
        sym.typeParameters !== undefined && sym.typeParameters.length > 0
          ? `<${sym.typeParameters.map((t) => t.name).join(", ")}>`
          : "";
      return `function ${sym.name}${typeParams}(${params}): ${sym.returnType ?? "void"}`;
    }
    case "class": {
      const typeParams =
        sym.typeParameters !== undefined && sym.typeParameters.length > 0
          ? `<${sym.typeParameters.map((t) => t.name).join(", ")}>`
          : "";
      const heritage = sym.extends !== undefined ? ` extends ${sym.extends}` : "";
      const implements_ =
        sym.implements !== undefined && sym.implements.length > 0
          ? ` implements ${sym.implements.join(", ")}`
          : "";
      return `class ${sym.name}${typeParams}${heritage}${implements_}`;
    }
    case "interface": {
      const typeParams =
        sym.typeParameters !== undefined && sym.typeParameters.length > 0
          ? `<${sym.typeParameters.map((t) => t.name).join(", ")}>`
          : "";
      const heritage = sym.extends !== undefined ? ` extends ${sym.extends}` : "";
      return `interface ${sym.name}${typeParams}${heritage}`;
    }
    case "type-alias": {
      const typeParams =
        sym.typeParameters !== undefined && sym.typeParameters.length > 0
          ? `<${sym.typeParameters.map((t) => t.name).join(", ")}>`
          : "";
      return `type ${sym.name}${typeParams} = ${sym.returnType ?? "unknown"}`;
    }
    case "enum":
      return `enum ${sym.name}`;
    case "variable":
    case "constant":
      return `const ${sym.name}: ${sym.returnType ?? "unknown"}`;
    default:
      return sym.name;
  }
}
