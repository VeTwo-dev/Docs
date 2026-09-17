/**
 * Documentation Coverage & Boundary Detection.
 *
 * Determines what is documented vs what should NOT be documented.
 * Symbols are classified into visibility boundaries; only public and
 * user-relevant semi-public subjects count toward coverage gaps.
 */

import type {
  AreaCoverage,
  CompilerProjectInput,
  CoverageArea,
  DocumentationCoverage,
  DocumentationPageDefinition,
  PageKind,
  SymbolBoundary,
} from "./types.js";

/**
 * Classify a symbol's documentation boundary from its metadata.
 * Exported + documented ⇒ public. Exported but marked internal ⇒ internal.
 */
export function classifyBoundary(api: {
  name: string;
  description?: string;
  sourceFile?: string;
  deprecated?: boolean;
}): SymbolBoundary {
  if (/^_/.test(api.name)) return "private";
  if (/\.(internal|private|impl)\./i.test(api.sourceFile ?? "")) return "implementation-detail";
  if (/(^|\W)@internal(\W|$)/i.test(api.description ?? "")) return "internal";
  if (/(^|\W)@publicapi(\W|$)/i.test(api.description ?? "")) return "public";
  if (/generated\//i.test(api.sourceFile ?? "")) return "generated";
  // Default: exported symbols are public API unless proven otherwise.
  return "public";
}

/** Boundary classes that default into documentation scope. */
const IN_SCOPE: readonly SymbolBoundary[] = ["public", "semi-public"];

/**
 * Compute coverage across all tracked areas for a compiled architecture.
 */
export function computeCoverage(
  input: CompilerProjectInput,
  pages: readonly DocumentationPageDefinition[],
): DocumentationCoverage {
  const documentedSymbols = new Set(pages.flatMap((p) => p.symbols));
  const hasPageWithKind = (kind: PageKind): boolean => pages.some((p) => p.kinds.includes(kind));

  const areas: AreaCoverage[] = [];

  // ── APIs ─────────────────────────────────────────────────────────
  const apis = input.apis ?? [];
  const inScopeApis = apis.filter((a) => IN_SCOPE.includes(a.boundary ?? classifyBoundary(a)));
  const apiDocumented = inScopeApis.filter((a) => documentedSymbols.has(a.name));
  const apiExcluded = apis.filter((a) => !IN_SCOPE.includes(a.boundary ?? classifyBoundary(a)));
  areas.push({
    area: "apis",
    documented: apiDocumented.map((a) => a.name),
    excluded: apiExcluded.map((a) => a.name),
    gaps: inScopeApis.filter((a) => !documentedSymbols.has(a.name)).map((a) => a.name),
  });

  // ── Configuration ────────────────────────────────────────────────
  const configKeys = input.signals.configKeys ?? [];
  if (configKeys.length > 0) {
    const covered = hasPageWithKind("configuration");
    areas.push({
      area: "configuration",
      documented: covered ? [...configKeys] : [],
      excluded: [],
      gaps: covered ? [] : [...configKeys],
    });
  }

  // ── CLI commands ─────────────────────────────────────────────────
  const commands = input.signals.commands ?? [];
  if (commands.length > 0) {
    const commandPages = pages.filter((p) => p.kinds.includes("cli-command"));
    const commandSymbols = new Set(commandPages.flatMap((p) => p.symbols));
    areas.push({
      area: "cli-commands",
      documented: commands.filter((c) => commandSymbols.has(c.name)).map((c) => c.name),
      excluded: [],
      gaps: commands.filter((c) => !commandSymbols.has(c.name)).map((c) => c.name),
    });
  }

  // ── Concepts ─────────────────────────────────────────────────────
  const concepts = input.concepts ?? [];
  if (concepts.length > 0) {
    const conceptPages = pages.filter((p) => p.kinds.includes("concept"));
    const conceptNames = new Set([
      ...conceptPages.map((p) => p.title.toLowerCase()),
      ...pages.flatMap((p) => p.consolidatedFrom ?? []).map((c) => c.toLowerCase()),
    ]);
    areas.push({
      area: "concepts",
      documented: concepts.filter((c) => conceptNames.has(c.name.toLowerCase())).map((c) => c.name),
      excluded: [],
      gaps: concepts.filter((c) => !conceptNames.has(c.name.toLowerCase())).map((c) => c.name),
    });
  }

  // ── Examples ─────────────────────────────────────────────────────
  const examples = input.signals.examples ?? [];
  if (examples.length > 0 || pages.some((p) => p.kinds.includes("example"))) {
    areas.push({
      area: "examples",
      documented: hasPageWithKind("example") ? examples : [],
      excluded: [],
      gaps: hasPageWithKind("example") ? [] : ["usage-examples"],
    });
  }

  // ── Architecture ─────────────────────────────────────────────────
  if ((input.concepts?.length ?? 0) >= 3) {
    areas.push({
      area: "architecture",
      documented: hasPageWithKind("architecture") ? ["overview"] : [],
      excluded: [],
      gaps: hasPageWithKind("architecture") ? [] : ["architecture-overview"],
    });
  }

  // ── Migration ────────────────────────────────────────────────────
  const deprecated = apis.filter((a) => a.deprecated === true);
  if (deprecated.length > 0) {
    areas.push({
      area: "migration",
      documented: hasPageWithKind("migration") ? deprecated.map((d) => d.name) : [],
      excluded: [],
      gaps: hasPageWithKind("migration") ? [] : deprecated.map((d) => d.name),
    });
  }

  // Installation / quick-start (project-type aware — not required for every project but scored when page exists)
  if (hasPageWithKind("installation")) {
    areas.push({ area: "installation", documented: ["installation"], excluded: [], gaps: [] });
  } else {
    areas.push({ area: "installation", documented: [], excluded: [], gaps: ["installation"] });
  }
  if (hasPageWithKind("quick-start") || hasPageWithKind("getting-started")) {
    areas.push({ area: "quick-start", documented: ["quick-start"], excluded: [], gaps: [] });
  } else {
    areas.push({ area: "quick-start", documented: [], excluded: [], gaps: ["quick-start"] });
  }
  // Development lifecycle (only scored when scripts exist — otherwise excluded)
  const hasDev = hasPageWithKind("development");
  areas.push({ area: "development", documented: hasDev ? ["development"] : [], excluded: hasDev ? [] : ["development"], gaps: hasDev ? [] : [] });
  const hasTesting = hasPageWithKind("testing");
  areas.push({ area: "testing", documented: hasTesting ? ["testing"] : [], excluded: hasTesting ? [] : ["testing"], gaps: hasTesting ? [] : [] });
  const hasBuilding = hasPageWithKind("building");
  areas.push({ area: "building", documented: hasBuilding ? ["building"] : [], excluded: hasBuilding ? [] : ["building"], gaps: hasBuilding ? [] : [] });

  // Overall score: share of in-scope items documented, project-type aware — excluded areas don't count
  let totalInScope = 0;
  let totalDocumented = 0;
  for (const area of areas) {
    if (area.excluded.length > 0 && area.documented.length === 0 && area.gaps.length === 0) continue;
    totalInScope += area.documented.length + area.gaps.length;
    totalDocumented += area.documented.length;
  }

  return {
    areas,
    score: totalInScope === 0 ? 1 : totalDocumented / totalInScope,
  };
}

/** Areas the compiler tracks (useful for CLI rendering). */
export const TRACKED_AREAS: readonly CoverageArea[] = [
  "apis",
  "symbols",
  "concepts",
  "features",
  "configuration",
  "cli-commands",
  "workflows",
  "examples",
  "integrations",
  "architecture",
  "plugins",
  "errors",
  "migration",
  "installation",
  "quick-start",
  "development",
  "testing",
  "building",
  "publishing",
  "contributing",
  "security",
  "performance",
  "deployment",
  "changelog",
];
