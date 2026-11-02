/**
 * Documentation Materialization (Phase 22.2).
 *
 * Pipeline: ProjectKnowledge → CompilerInput → compileDocumentation (IR) →
 * OutputPlan → renderer-specific materialization (next/md/static, each with
 * its own output root) → validation gate.
 *
 * Hard boundaries: each renderer receives ONLY its own root and may only
 * write inside it (asserted per file). IR is semantic input; renderers own
 * path generation. Generation throws DocsError(BUILD_FAILED) when a
 * configured renderer fails validation — never reports success on broken
 * output.
 */

import { join, resolve, dirname, sep } from "node:path";
import {
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  rmSync,
} from "node:fs";
import type { DocsConfig } from "../config/types.js";
import type { Logger } from "../types/internal.js";
import { resolveOutputLayout } from "../config/resolve.js";
import { compileDocumentation, buildCompilerInput } from "../documentation/compiler/index.js";
import type {
  CompilerProjectInput,
  ComposedExample,
  DocumentationArchitecture,
} from "../documentation/compiler/types.js";
import { buildManifest } from "../documentation/compiler/manifest.js";
import type { DocumentationManifest } from "../documentation/compiler/manifest.js";
import { renderNextJsSite } from "../renderers/nextjs/adapter.js";
import { renderMarkdownSite } from "../renderers/markdown/renderer.js";
import { renderStaticSite } from "../renderers/static/renderer.js";
import { renderFumadocsSite } from "../renderers/fumadocs/renderer.js";
import { composeDesignCss, readDesignSources } from "../renderers/design/sources.js";
import type { RendererNavLink, RendererTheme } from "../renderers/types.js";
import { buildOutputPlan } from "../renderers/output-plan.js";
import { discoverImageSources } from "../renderers/assets.js";
import { writeAssetBytes, writeSiteFiles } from "../renderers/writer.js";
import {
  buildProjectKnowledge,
  knowledgeToCompilerInput,
} from "../intelligence/build-knowledge.js";
import { discoverEnvVars } from "../intelligence/discovery/env.js";
import { createIntegrationRegistry } from "../integrations/registry.js";
import { planIntegrations } from "../integrations/planner.js";
import { takumiIntegration } from "../integrations/takumi/index.js";
import { shikiIntegration } from "../integrations/shiki/index.js";
import { mermaidIntegration } from "../integrations/mermaid/index.js";
import { sigmaIntegration } from "../integrations/sigma/index.js";
import { twoslashIntegration } from "../integrations/twoslash/index.js";
import { classifyDependencies } from "../intelligence/discovery/dependencies.js";
import { detectFramework } from "../intelligence/discovery/framework.js";
import { discoverExamples } from "../intelligence/discovery/examples.js";
import { discoverCliCommands } from "../intelligence/discovery/cli.js";
import { DocsError } from "../errors/classes.js";
import { ErrorCode } from "../errors/codes.js";
import type { DocumentationIR } from "../documentation/compiler/ir.js";
import type { RenderedSite } from "../renderers/types.js";
import { discoverContentDocuments } from "../site/discovery.js";
import { buildSiteModel } from "../site/model.js";
import { siteModelToIR, siteManifest } from "../site/adapters.js";
import { toMDX } from "../site/mdx.js";
import type { CanonicalDocument, DocumentationSite } from "../site/types.js";

export interface MaterializeResult {
  readonly outputDir: string;
  readonly written: string[];
  readonly manifestPath?: string;
  readonly nextBuildable: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export interface ValidationIssue {
  readonly severity: "error" | "warning";
  readonly message: string;
}

/**
 * Resolve site chrome (theme, header links, logo) from configuration and
 * package metadata. Repository links come only from package.json metadata or
 * explicit config — never invented.
 */
export function resolveSiteChrome(
  rootDir: string,
  config: DocsConfig,
): { theme?: RendererTheme; navLinks: RendererNavLink[]; logoSvg?: string } {
  const theme = typeof config.theme === "object" ? (config.theme as RendererTheme) : undefined;
  const navLinks: RendererNavLink[] = [];
  const push = (label: string, href: string): void => {
    if (href.length > 0 && !navLinks.some((l) => l.href === href)) navLinks.push({ label, href });
  };

  // Explicit config navigation wins.
  for (const item of config.nav?.items ?? []) {
    push(item.label, item.href);
    for (const child of item.items ?? []) push(child.label, child.href);
  }

  // Fall back to repository metadata (evidence-based, generic).
  try {
    const pkg = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8")) as {
      name?: string;
      homepage?: string;
      repository?: string | { url?: string };
      bugs?: string | { url?: string };
    };
    const repoUrl = typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
    const bugsUrl = typeof pkg.bugs === "string" ? pkg.bugs : pkg.bugs?.url;
    if (repoUrl !== undefined) push("GitHub", repoUrl);
    if (typeof pkg.name === "string" && pkg.name.length > 0) {
      push("npm", `https://www.npmjs.com/package/${pkg.name}`);
    }
    if (bugsUrl !== undefined) push("Issues", bugsUrl);
    if (typeof pkg.homepage === "string" && pkg.homepage !== repoUrl) push("Website", pkg.homepage);
  } catch {
    // No package metadata — header renders without external links.
  }

  // Logo: explicit configured SVG file wins; otherwise the renderer derives
  // a monogram from the site name (no invented branding).
  let logoSvg: string | undefined;
  const logoPath =
    typeof config.theme === "object" ? (config.theme as { logo?: string }).logo : undefined;
  if (logoPath !== undefined) {
    try {
      const full = resolve(rootDir, logoPath);
      if (full.startsWith(resolve(rootDir) + sep)) logoSvg = readFileSync(full, "utf8");
    } catch {
      logoSvg = undefined;
    }
  }
  return { theme, navLinks, logoSvg };
}

/**
 * Discover workspace member packages from package.json workspaces patterns.
 * Expands simple `<dir>/*` globs by reading member package.json names.
 * Bounded and best-effort: unknown patterns resolve to no packages (the
 * packages page is evidence-gated and simply won't be planned).
 */
export function discoverWorkspacePackages(rootDir: string): string[] {
  try {
    const pkg = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8")) as {
      workspaces?: string[] | { packages?: string[] };
      name?: string;
    };
    const patterns = Array.isArray(pkg.workspaces)
      ? pkg.workspaces
      : (pkg.workspaces?.packages ?? []);
    const names: string[] = [];
    for (const pattern of patterns) {
      const star = pattern.indexOf("*");
      if (star < 0) {
        names.push(pattern);
        continue;
      }
      const baseDir = resolve(rootDir, pattern.slice(0, star));
      let entries: string[] = [];
      try {
        entries = readdirSync(baseDir).filter((e) => {
          try {
            return statSync(join(baseDir, e)).isDirectory();
          } catch {
            return false;
          }
        });
      } catch {
        continue;
      }
      for (const entry of entries.slice(0, 20)) {
        try {
          const member = JSON.parse(readFileSync(join(baseDir, entry, "package.json"), "utf8")) as {
            name?: string;
          };
          names.push(member.name ?? `${pattern.replace("*", entry)}`);
        } catch {
          names.push(`${pattern.replace("*", entry)}`);
        }
      }
    }
    return [...new Set(names)].slice(0, 30);
  } catch {
    return [];
  }
}

/**
 * Compose validated examples for the examples/quick-start composers.
 * JSDoc examples first (symbol-linked, highest confidence), then bounded
 * excerpts from discovered example files. Deterministic ordering, hard caps,
 * never invented. Returns [] when nothing validated exists.
 */
export function composeExamples(
  apiSymbols: NonNullable<CompilerProjectInput["apiSymbols"]>,
  discovered: readonly { title: string; path: string; source: string }[],
  rootDir: string,
): ComposedExample[] {
  const out: ComposedExample[] = [];

  const sorted = [...apiSymbols].sort((a, b) => a.qualifiedName.localeCompare(b.qualifiedName));
  for (const sym of sorted) {
    if (out.length >= 6) break;
    for (const [i, example] of (sym.documentation.examples ?? []).slice(0, 2).entries()) {
      if (example.code.trim().length === 0) continue;
      out.push({
        id: `jsdoc:${sym.qualifiedName}:${i}`,
        title: example.title ?? `${sym.name} example`,
        code: example.code,
        language: example.language || "ts",
        source: `JSDoc @example of \`${sym.qualifiedName}\``,
        owner: sym.name,
        purpose:
          sym.documentation.summary.length > 0 && sym.documentation.summary.length <= 200
            ? sym.documentation.summary
            : undefined,
      });
      if (out.length >= 6) break;
    }
  }

  if (out.length < 8) {
    const files = [...discovered].sort((a, b) => a.path.localeCompare(b.path));
    for (const file of files) {
      if (out.length >= 8) break;
      if (!/\.(ts|js|tsx|jsx|mts|mjs)$/.test(file.path)) continue;
      let text: string;
      try {
        const full = file.path.startsWith("/") ? file.path : join(rootDir, file.path);
        const resolved = resolve(full);
        if (!resolved.startsWith(resolve(rootDir) + sep)) continue;
        text = readFileSync(resolved, "utf8");
      } catch {
        continue;
      }
      const code = text.split("\n").slice(0, 60).join("\n").slice(0, 4000).trim();
      if (code.length < 20) continue;
      const language = file.path.endsWith("x")
        ? "tsx"
        : file.path.endsWith(".ts") || file.path.endsWith(".mts")
          ? "ts"
          : "js";
      out.push({
        id: `file:${file.path}`,
        title: file.title,
        code,
        language,
        source: file.path,
      });
    }
  }

  return out;
}

/** Assert every file of a rendered site stays inside its own root. */
export function assertRendererBoundary(site: RenderedSite, outputRoot: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const root = resolve(outputRoot);
  for (const file of site.files) {
    const target = resolve(join(root, file.path));
    if (target !== root && !target.startsWith(root + sep)) {
      issues.push({
        severity: "error",
        message: `${site.target}: file escapes output root: ${file.path}`,
      });
    }
  }
  return issues;
}

/**
 * Whether file content is provably generator-written.
 *
 * Recognizes the `generated by @vetwo/docs` marker (ownership headers,
 * scaffolds) and — for Markdown pages only — the machine-written
 * `generator: "@vetwo/docs"` frontmatter field (emitted solely by our md/mdx
 * renderers; never hand-authored content). Scoped by extension so JSON/HTML
 * payloads are unaffected.
 */
export function isGeneratedContent(content: string, rel: string): boolean {
  if (content.includes("generated by @vetwo/docs")) return true;
  if (rel.endsWith(".md") || rel.endsWith(".mdx")) {
    return content.includes('generator: "@vetwo/docs"');
  }
  return false;
}

/** Output roots participating in stale-output reconciliation. */
export type ReconcileBucket = "next" | "md" | "static" | "site" | "generated";

export interface ReconcileInputs {
  readonly roots: Record<ReconcileBucket, string>;
  readonly inventory: Record<ReconcileBucket, readonly string[]>;
  readonly previousFiles: Partial<Record<ReconcileBucket, readonly string[]>> | undefined;
  readonly enabled: Record<ReconcileBucket, boolean>;
  readonly warnings: string[];
}

/**
 * Delete previous-manifest files that are no longer generated.
 *
 * Only files the previous manifest inventory proves the generator owned
 * are candidates, and only provably generated content (ownership markers)
 * or deterministic `.json` payloads are actually removed. Unknown/user
 * files are preserved with a warning. Traversal outside the root is
 * refused. Pure filesystem reconciliation shared by every output bucket.
 */
export function reconcilePreviousFiles(inputs: ReconcileInputs): void {
  const { roots, inventory, previousFiles, enabled, warnings } = inputs;
  if (previousFiles === undefined) return;
  const buckets: readonly ReconcileBucket[] = ["next", "md", "static", "site", "generated"];
  for (const bucket of buckets) {
    if (enabled[bucket] !== true) continue;
    const root = roots[bucket];
    const current = new Set(inventory[bucket]);
    for (const rel of previousFiles[bucket] ?? []) {
      if (current.has(rel)) continue;
      const target = resolve(join(root, rel));
      if (!target.startsWith(resolve(root) + sep)) continue;
      if (!existsSync(target)) continue;
      let content: string;
      try {
        content = readFileSync(target, "utf8");
      } catch {
        // A directory (or unreadable node) replaced the file: not a
        // regular generated file, leave it alone.
        continue;
      }
      // Delete only provably generated files: marked content, or
      // byte-identical JSON payloads (deterministic artifacts).
      if (isGeneratedContent(content, rel) || rel.endsWith(".json")) {
        rmSync(target, { force: true });
        warnings.push(`Removed stale generated file ${target}`);
      } else {
        warnings.push(`Keeping unknown file (not in plan, not generated): ${target}`);
      }
    }
  }
}

const ORPHAN_SKIP_DIRS = new Set(["node_modules", ".next", "out", ".source", ".git"]);

/**
 * Sweep headered orphan files that no inventory ever claimed.
 *
 * Walks each enabled output root; files carrying generator ownership
 * markers are provably stale artifacts (the header is only ever written
 * by this generator) and are removed. Headerless unknowns are preserved.
 * Directories in `ORPHAN_SKIP_DIRS` are never descended into.
 */
export function sweepOrphanedFiles(inputs: ReconcileInputs): void {
  const { roots, inventory, enabled, warnings } = inputs;
  const currentSets: Record<ReconcileBucket, Set<string>> = {
    next: new Set(inventory.next),
    md: new Set(inventory.md),
    static: new Set(inventory.static),
    site: new Set(inventory.site),
    generated: new Set(inventory.generated),
  };
  const walk = (dir: string, base: string, bucket: ReconcileBucket): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry);
      const rel = base.length > 0 ? `${base}/${entry}` : entry;
      let isDir: boolean;
      try {
        isDir = statSync(full).isDirectory();
      } catch {
        continue;
      }
      if (isDir) {
        if (!ORPHAN_SKIP_DIRS.has(entry)) walk(full, rel, bucket);
        continue;
      }
      if (currentSets[bucket].has(rel)) continue;
      let content: string;
      try {
        content = readFileSync(full, "utf8");
      } catch {
        continue;
      }
      if (isGeneratedContent(content, rel)) {
        rmSync(full, { force: true });
        warnings.push(`Removed stale generated file ${full}`);
      }
    }
  };
  const buckets: readonly ReconcileBucket[] = ["next", "md", "static", "site", "generated"];
  for (const bucket of buckets) {
    if (enabled[bucket] !== true) continue;
    walk(roots[bucket], "", bucket);
  }
}

/** Validate a materialized plan: routes, links, CSS wiring, manifest. Pure checks on IR + sites. */
export function validateMaterialization(
  ir: DocumentationIR,
  next: RenderedSite | undefined,
  md: RenderedSite | undefined,
  statik: RenderedSite | undefined,
  site?: RenderedSite | undefined,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (next !== undefined) {
    const paths = new Set(next.files.map((f) => f.path));
    // CSS must exist and be imported by the root layout.
    if (!paths.has("app/globals.css")) {
      issues.push({ severity: "error", message: "Next.js: app/globals.css missing" });
    }
    const layout = next.files.find((f) => f.path === "app/layout.tsx")?.contents ?? "";
    if (!layout.includes("globals.css")) {
      issues.push({
        severity: "error",
        message: "Next.js: app/layout.tsx does not import globals.css",
      });
    }
    // Every IR page must have a JSON payload.
    for (const page of ir.pages) {
      if (!paths.has(`data/pages/${encodeURIComponent(page.slug)}.json`)) {
        issues.push({
          severity: "error",
          message: `Next.js: missing data payload for page ${page.slug}`,
        });
      }
    }
    // No content leak: md-owned .mdx must not live inside next/ (except content/ legacy — forbidden).
    for (const p of paths) {
      if (p.startsWith("content/") || p.startsWith("md/") || p.startsWith("static/")) {
        issues.push({ severity: "error", message: `Next.js: cross-renderer leak: ${p}` });
      }
    }
    // Home route must resolve to an existing page payload.
    const home = next.files.find((f) => f.path === "app/page.tsx")?.contents ?? "";
    const redirect = /redirect\((.*?)\)/.exec(home)?.[1];
    if (redirect !== undefined) {
      try {
        const target: string = JSON.parse(redirect);
        const ok = next.routes.some((r) => r.route === target);
        if (!ok)
          issues.push({
            severity: "error",
            message: `Next.js: home redirects to missing route ${target}`,
          });
      } catch {
        issues.push({
          severity: "warning",
          message: "Next.js: home redirect target not statically verifiable",
        });
      }
    }
  }

  if (md !== undefined) {
    const paths = new Set(md.files.map((f) => f.path));
    for (const p of paths) {
      if (!p.endsWith(".mdx") && !p.endsWith(".md")) {
        issues.push({ severity: "error", message: `Markdown: non-markdown file in md/: ${p}` });
      }
      if (p.startsWith("app/") || p.startsWith("next/") || p === "index.html") {
        issues.push({ severity: "error", message: `Markdown: cross-renderer leak: ${p}` });
      }
    }
    for (const page of ir.pages) {
      const hasMd = paths.has(`${page.slug}.mdx`) || paths.has(`${page.slug}.md`);
      const hasIndex = paths.has("index.mdx") || paths.has("index.md");
      if (!hasMd && !hasIndex) {
        issues.push({ severity: "error", message: `Markdown: missing page ${page.slug}.md(x)` });
      }
    }
  }

  if (statik !== undefined) {
    const paths = new Set(statik.files.map((f) => f.path));
    if (!paths.has("index.html")) {
      issues.push({ severity: "error", message: "Static: index.html missing" });
    }
    if (!paths.has("assets/css/globals.css")) {
      issues.push({ severity: "error", message: "Static: assets/css/globals.css missing" });
    }
    for (const p of paths) {
      if (p.startsWith("next/") || p.startsWith("md/") || p.startsWith("app/")) {
        issues.push({ severity: "error", message: `Static: cross-renderer leak: ${p}` });
      }
      if (p.split("/").includes("..")) {
        issues.push({ severity: "error", message: `Static: escaping path: ${p}` });
      }
    }
  }

  if (site !== undefined) {
    const paths = new Set(site.files.map((f) => f.path));
    for (const required of [
      "package.json",
      "source.config.ts",
      "next.config.mjs",
      "postcss.config.mjs",
      "tsconfig.json",
      "app/layout.tsx",
      "app/[[...slug]]/page.tsx",
      "app/api/search/route.ts",
      "app/graph/page.tsx",
      "components/graph-view.tsx",
      "mdx-components.tsx",
      "lib/source.ts",
      "app/globals.css",
      "public/graph.json",
    ]) {
      if (!paths.has(required)) {
        issues.push({ severity: "error", message: `Fumadocs: missing ${required}` });
      }
    }
    // No legacy custom-renderer artifacts inside site/.
    for (const p of paths) {
      if (
        p.startsWith("next/") ||
        p === "index.html" ||
        p.startsWith("md/") ||
        p.startsWith("static/")
      ) {
        issues.push({ severity: "error", message: `Fumadocs: cross-renderer leak: ${p}` });
      }
      if (p.split("/").includes("..")) {
        issues.push({ severity: "error", message: `Fumadocs: escaping path: ${p}` });
      }
    }
    // Every IR page must have Fumadocs content.
    for (const page of ir.pages) {
      if (!paths.has(`content/docs/${page.slug}.mdx`)) {
        issues.push({
          severity: "error",
          message: `Fumadocs: missing content for page ${page.slug}`,
        });
      }
    }
    // Navigation meta files must exist.
    if (!paths.has("content/docs/meta.json")) {
      issues.push({ severity: "error", message: "Fumadocs: missing content/docs/meta.json" });
    }
    // CSS wiring: layout imports globals.css; static CSS is Tailwind-based.
    const layout = site.files.find((f) => f.path === "app/layout.tsx")?.contents ?? "";
    if (!layout.includes("globals.css")) {
      issues.push({
        severity: "error",
        message: "Fumadocs: app/layout.tsx does not import globals.css",
      });
    }
    const css = site.files.find((f) => f.path === "app/globals.css")?.contents ?? "";
    if (!css.includes("tailwindcss")) {
      issues.push({ severity: "error", message: "Fumadocs: globals.css is not Tailwind-based" });
    }
    if (!css.includes("fumadocs-ui")) {
      issues.push({
        severity: "error",
        message: "Fumadocs: globals.css does not include Fumadocs UI styles",
      });
    }
  }

  return issues;
}

/**
 * Materializes compiled documentation to the configured workspace directory.
 *
 * @param rootDir - Absolute path of the analyzed project.
 * @param config - Resolved documentation configuration (output layout).
 * @param logger - Logger for progress, warnings and errors.
 * @returns Paths written, manifest location, Next.js buildability and diagnostics.
 */
export async function materializeDocumentation(
  rootDir: string,
  config: DocsConfig,
  logger: Logger,
): Promise<MaterializeResult> {
  const layout = resolveOutputLayout(config);
  const outputDir = resolve(rootDir, layout.directory);
  const written: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const chrome = resolveSiteChrome(rootDir, config);
  // Persistent design sources: read (never regenerate) `<root>/design/`.
  const designSources = readDesignSources(rootDir);
  const missingDesign = designSources.filter((s) => s.defaulted).map((s) => s.path);
  if (missingDesign.length === designSources.length) {
    logger.info(
      "No design/ sources found — using the built-in VeTwo design kit. Run `docs init` to materialize an editable design directory.",
    );
  } else if (missingDesign.length > 0) {
    logger.warn(
      `Missing design sources: ${missingDesign.join(", ")} — falling back to embedded defaults for those files.`,
    );
  }
  const sharedRendererOptions = {
    siteName: config.title,
    description: config.description,
    docsBasePath: "/docs",
    theme: chrome.theme,
    navLinks: chrome.navLinks,
    logoSvg: chrome.logoSvg,
    designCss: composeDesignCss(designSources),
  };

  // Content source selection (strangler): the canonical content-driven
  // pipeline builds IR from user Markdown/MDX without source-code
  // intelligence; otherwise the legacy knowledge/inference path runs.
  const canonicalMode = config.content?.pipeline === "canonical";
  let ir: DocumentationIR;
  let architecture: DocumentationArchitecture | undefined;
  let site: DocumentationSite | undefined;
  let canonicalDocuments: readonly CanonicalDocument[] = [];

  if (canonicalMode) {
    // 1c. Canonical content: discover → normalize → site model → IR.
    const documents = await discoverContentDocuments(
      { rootDir, sourceDir: resolve(rootDir, config.source) },
      { ignore: config.ignore, gfm: config.markdown.gfm },
    );
    const github = chrome.navLinks.find((link) => link.href.includes("github.com"))?.href;
    site = buildSiteModel(documents, {
      siteName: config.title,
      title: config.title,
      description: config.description,
      baseUrl: config.baseUrl,
      ...(github !== undefined ? { github } : {}),
    });
    canonicalDocuments = documents;
    ir = siteModelToIR(site);
    logger.info(
      `Canonical content: ${documents.length} documents, ${site.pages.length} pages, ${site.blog.length} posts.`,
    );
  } else {
    // 1. Deterministic sources
    const envVars = discoverEnvVars(rootDir);
    const depKnowledge = classifyDependencies(rootDir);
    const framework = detectFramework(rootDir);
    const examples = discoverExamples(rootDir);

    // 2. ProjectKnowledge → CompilerInput (async: wires real Phase 21 API symbols)
    let compilerInput: ReturnType<typeof buildCompilerInput>;
    const discoveredCommands = discoverCliCommands(rootDir);
    const workspacePackages = discoverWorkspacePackages(rootDir);
    let knowledge: Awaited<ReturnType<typeof buildProjectKnowledge>>;
    try {
      knowledge = await buildProjectKnowledge({
        rootDir,
        signals: {
          hasBin: discoveredCommands.length > 0,
          isMonorepo: workspacePackages.length > 0,
          framework: framework ?? undefined,
          configKeys: ["title", "baseUrl", "theme", "api", "search"],
          commands: discoveredCommands,
          examples: examples.map((e) => e.title),
        },
        packageJson: {} as Record<string, unknown>,
      });
      const base = knowledgeToCompilerInput(knowledge, rootDir);
      compilerInput = {
        ...base,
        signals: {
          ...base.signals,
          dependencies: depKnowledge.runtime,
          peerDependencies: depKnowledge.peer,
          configKeys: [...(base.signals.configKeys ?? []), ...envVars.map((e) => `env:${e.name}`)],
          examples: examples.map((e) => e.title),
          framework: framework ?? base.signals.framework,
          packages: workspacePackages,
        },
      } as typeof base;
    } catch (err) {
      logger.warn(
        `Project knowledge build failed, falling back to compiler input: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      compilerInput = buildCompilerInput(rootDir);
      knowledge = await buildProjectKnowledge({
        rootDir,
        signals: {},
        packageJson: {} as Record<string, unknown>,
      });
    }

    // 2b. Ecosystem integration planning (capability-driven, deterministic)
    const integrationRegistry = createIntegrationRegistry();
    for (const integration of [
      takumiIntegration,
      shikiIntegration,
      mermaidIntegration,
      sigmaIntegration,
      twoslashIntegration,
    ]) {
      integrationRegistry.register(integration);
    }
    let integrationPlan: Awaited<ReturnType<typeof planIntegrations>> | undefined;
    try {
      integrationPlan = await planIntegrations(integrationRegistry, {
        projectKnowledge: knowledge,
        rootDir,
        config: {},
      });
      for (const sel of integrationPlan.selected) {
        logger.info(`[integrations] selected: ${sel.id} (${sel.capabilities.join(", ")})`);
      }
      for (const skip of integrationPlan.skipped) {
        logger.info(`[integrations] skipped: ${skip.integration.id} (${skip.reason})`);
      }
    } catch (err) {
      logger.warn(
        `Integration planning failed (continuing without integrations): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    // 3. Compile IR + output plan (single semantic source for all renderers).
    // Composed examples: validated JSDoc examples first (symbol-linked), then
    // bounded excerpts from discovered example files. Never invented.
    const composedExamples = composeExamples(compilerInput.apiSymbols ?? [], examples, rootDir);
    const compiled = compileDocumentation(compilerInput, {}, { examples: composedExamples });
    architecture = compiled.architecture;
    ir = compiled.ir;
    // Structural corruption fails the build; content gaps are warnings.
    for (const d of compiled.diagnostics) {
      if (
        d.severity === "error" &&
        (d.code === "DOC_DUPLICATE_TITLE" || d.code === "DOC_DUPLICATE_BREADCRUMB")
      ) {
        errors.push(`compile: ${d.message}`);
      } else if (d.severity !== "info") {
        warnings.push(`compile: ${d.message}`);
      }
    }
  }
  const plan = buildOutputPlan(ir, { workspaceRoot: outputDir, docsBasePath: "/docs" });

  // 4. Assets: discover from IR image blocks, validate against source boundary
  const imageSrcs = ir.pages.flatMap((p) =>
    p.blocks.filter((b) => b.kind === "image").map((b) => (b as { src: string }).src),
  );
  const assetPlan = discoverImageSources(imageSrcs, [rootDir]);
  for (const missing of assetPlan.missing) {
    warnings.push(`Missing image asset (not materialized): ${missing}`);
    logger.warn(`Missing image asset: ${missing}`);
  }

  // 5. Render each target into its OWN root
  const nextDir = join(outputDir, "next");
  const mdDir = join(outputDir, "md");
  const staticDir = join(outputDir, "static");
  const siteDir = join(outputDir, "site");
  const generatedDir = join(outputDir, "generated");

  let nextSite: RenderedSite | undefined;
  let mdSite: RenderedSite | undefined;
  let staticSite: RenderedSite | undefined;
  let fumadocsSite: RenderedSite | undefined;

  // 5a. Previous manifest inventory: files it lists under our own
  // `_generatedBy` marker are provably generated, even marker-less ones.
  const manifestPath = join(outputDir, "manifest.json");
  let previousFiles:
    | {
        next: readonly string[];
        md: readonly string[];
        static: readonly string[];
        site?: readonly string[];
        generated?: readonly string[];
      }
    | undefined;
  const previouslyGenerated = new Set<string>();
  if (existsSync(manifestPath)) {
    try {
      const prev = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        _generatedBy?: string;
        files?: {
          next: readonly string[];
          md: readonly string[];
          static: readonly string[];
          site?: readonly string[];
          generated?: readonly string[];
        };
      };
      if (prev._generatedBy === "@vetwo/docs") {
        previousFiles = prev.files;
        for (const [bucket, root] of [
          ["next", nextDir],
          ["md", mdDir],
          ["static", staticDir],
          ["site", siteDir],
          ["generated", generatedDir],
        ] as const) {
          for (const rel of prev.files?.[bucket] ?? []) {
            previouslyGenerated.add(resolve(join(root, rel)));
          }
        }
      }
    } catch {
      previousFiles = undefined;
    }
  }
  const isPreviouslyGenerated = (absPath: string): boolean => previouslyGenerated.has(absPath);

  if (layout.layout.next) {
    nextSite = renderNextJsSite(ir, { ...sharedRendererOptions, docsBasePath: "/docs" });
    for (const issue of assertRendererBoundary(nextSite, nextDir)) {
      errors.push(issue.message);
    }
    writeSiteFiles(nextSite, nextDir, logger, written, warnings, isPreviouslyGenerated);
    // Materialize validated image bytes into Next public/
    for (const asset of assetPlan.assets) {
      if (asset.missing || asset.bytes === undefined) continue;
      writeAssetBytes(
        nextDir,
        asset.nextPath,
        asset.bytes,
        isPreviouslyGenerated,
        written,
        warnings,
        logger,
      );
    }
  }

  if (layout.layout.markdown) {
    mdSite = renderMarkdownSite(ir, {
      ...sharedRendererOptions,
      docsBasePath: "/docs",
      markdownExtension: config.markdown.extension ?? ".mdx",
    });
    for (const issue of assertRendererBoundary(mdSite, mdDir)) {
      errors.push(issue.message);
    }
    writeSiteFiles(mdSite, mdDir, logger, written, warnings, isPreviouslyGenerated);
  }

  if (layout.layout.static) {
    staticSite = renderStaticSite(ir, { ...sharedRendererOptions, docsBasePath: "/docs" });
    for (const issue of assertRendererBoundary(staticSite, staticDir)) {
      errors.push(issue.message);
    }
    writeSiteFiles(staticSite, staticDir, logger, written, warnings, isPreviouslyGenerated);
    // Materialize image bytes into static/assets (text-safe: only write when bytes exist)
    for (const asset of assetPlan.assets) {
      if (asset.missing || asset.bytes === undefined) continue;
      writeAssetBytes(
        staticDir,
        asset.staticPath,
        asset.bytes,
        isPreviouslyGenerated,
        written,
        warnings,
        logger,
      );
    }
  }

  // 5b. Fumadocs site (primary platform): real Fumadocs + Next.js project.
  if (layout.layout.site === true) {
    fumadocsSite = renderFumadocsSite(ir, { ...sharedRendererOptions, docsBasePath: "/" });
    for (const issue of assertRendererBoundary(fumadocsSite, siteDir)) {
      errors.push(issue.message);
    }
    writeSiteFiles(fumadocsSite, siteDir, logger, written, warnings, isPreviouslyGenerated);
  }

  // 5c. Canonical MDX artifacts (canonical pipeline only): deterministic
  // `.mdx` per source document under `generated/`. User sources are only
  // read, never moved; ownership markers make artifacts reconciliable.
  if (canonicalMode) {
    const artifacts = canonicalDocuments.map((doc) => toMDX(doc));
    writeSiteFiles(
      {
        target: "markdown",
        files: artifacts.map((artifact) => ({
          path: artifact.path,
          contents: artifact.contents,
        })),
        routes: [],
        entrypoint: "",
      },
      generatedDir,
      logger,
      written,
      warnings,
      isPreviouslyGenerated,
    );
  }

  // 6. Manifest (pure JSON) at workspace root, including the file inventory
  // for stale-output reconciliation below. `previousFiles` /
  // `isPreviouslyGenerated` were loaded in step 5a and prove generator
  // ownership even for marker-less files. Canonical mode builds the same
  // manifest shape from the site model instead of inferred architecture.
  let manifest: DocumentationManifest;
  if (architecture !== undefined) {
    manifest = buildManifest(architecture, ir, []);
  } else if (site !== undefined) {
    manifest = siteManifest(site, plan, config.title, rootDir);
  } else {
    throw new DocsError({
      code: ErrorCode.BUILD_FAILED,
      message: "Canonical content pipeline produced no site model.",
    });
  }
  // Current inventory per renderer root, classified from written paths.
  const inventory = {
    next: [] as string[],
    md: [] as string[],
    static: [] as string[],
    site: [] as string[],
    generated: [] as string[],
  };
  const relOf = (abs: string, root: string): string | undefined => {
    const prefix = root + sep;
    if (!abs.startsWith(prefix)) return undefined;
    return abs.slice(prefix.length).replace(/\\/g, "/");
  };
  for (const abs of written) {
    const n = relOf(abs, nextDir);
    if (n !== undefined) {
      inventory.next.push(n);
      continue;
    }
    const m = relOf(abs, mdDir);
    if (m !== undefined) {
      inventory.md.push(m);
      continue;
    }
    const s = relOf(abs, staticDir);
    if (s !== undefined) {
      inventory.static.push(s);
      continue;
    }
    const f = relOf(abs, siteDir);
    if (f !== undefined) {
      inventory.site.push(f);
      continue;
    }
    const g = relOf(abs, generatedDir);
    if (g !== undefined) inventory.generated.push(g);
  }
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        ...manifest,
        generatedAt: new Date().toISOString(),
        _generatedBy: "@vetwo/docs",
        files: inventory,
      },
      null,
      2,
    ),
    "utf8",
  );
  written.push(manifestPath);

  // 7. Search index (pure JSON derived artifact) at root + next public/
  // Canonical mode uses the site model's search records (same schema).
  const searchById = new Map((site?.search ?? []).map((entry) => [entry.id, entry] as const));
  const searchEntries = plan.pages.map((p) => {
    const canonical = searchById.get(p.slug);
    if (canonical !== undefined) {
      return {
        id: p.slug,
        title: p.title,
        content: canonical.content,
        url: p.route,
        category: p.sectionTitle,
      };
    }
    return {
      id: p.slug,
      title: p.title,
      content: p.page.blocks
        .filter((b) => b.kind === "paragraph")
        .map((b) => (b as { text: string }).text)
        .join(" "),
      url: p.route,
      category: p.sectionId,
    };
  });
  const searchContent = JSON.stringify(
    {
      entries: searchEntries,
      generatedAt: new Date().toISOString(),
      engine: config.search.engine,
      _generatedBy: "@vetwo/docs",
    },
    null,
    2,
  );
  writeFileSync(join(outputDir, "search-index.json"), searchContent, "utf8");
  written.push(join(outputDir, "search-index.json"));
  if (layout.layout.next) {
    const nextSearchPath = join(nextDir, "public", "search-index.json");
    mkdirSync(dirname(nextSearchPath), { recursive: true });
    writeFileSync(nextSearchPath, searchContent, "utf8");
    written.push(nextSearchPath);
  }

  // 8. Stale-output reconciliation (§20): remove only files that the PREVIOUS
  // manifest proves the generator owned and that are no longer generated.
  // Unknown/user files (never inventoried) are always preserved.
  reconcilePreviousFiles({
    roots: {
      next: nextDir,
      md: mdDir,
      static: staticDir,
      site: siteDir,
      generated: generatedDir,
    },
    inventory,
    previousFiles,
    enabled: {
      next: layout.layout.next,
      md: layout.layout.markdown,
      static: layout.layout.static,
      site: layout.layout.site === true,
      generated: canonicalMode,
    },
    warnings,
  });
  // Migration for the broken-era leak (renderer-owned knowledge, unconditional
  // and safe): content/ inside next/ belongs to the Markdown renderer now, and
  // app/docs/[slug] cannot serve nested slugs (replaced by [[...slug]]).
  // Plus: headered files under renderer roots that no inventory ever claimed
  // are provably stale generated artifacts (the header is only ever written
  // by this generator) — remove them; headerless unknowns are preserved.
  {
    const { rmSync } = await import("node:fs");
    for (const legacy of ["content", "app/docs/[slug]"]) {
      const target = join(nextDir, legacy);
      if (existsSync(target)) {
        rmSync(target, { recursive: true, force: true });
        warnings.push(`Removed legacy output ${target}`);
        logger.warn(`Removed legacy output ${target}`);
      }
    }
    sweepOrphanedFiles({
      roots: {
        next: nextDir,
        md: mdDir,
        static: staticDir,
        site: siteDir,
        generated: generatedDir,
      },
      inventory,
      previousFiles: undefined,
      enabled: {
        next: layout.layout.next,
        md: layout.layout.markdown,
        static: layout.layout.static,
        site: layout.layout.site === true,
        generated: canonicalMode,
      },
      warnings,
    });
  }

  // 9. Validation gate — fail loudly, never claim success on broken output
  const issues = validateMaterialization(ir, nextSite, mdSite, staticSite, fumadocsSite);
  for (const issue of issues) {
    if (issue.severity === "error") {
      errors.push(issue.message);
      logger.error(issue.message);
    } else {
      warnings.push(issue.message);
      logger.warn(issue.message);
    }
  }
  logger.success(`Materialized ${written.length} files to ${layout.directory}/`);
  if (errors.length > 0) {
    throw new DocsError({
      code: ErrorCode.BUILD_FAILED,
      message: `Documentation output validation failed with ${errors.length} error(s):\n- ${errors.slice(0, 10).join("\n- ")}`,
    });
  }
  return { outputDir, written, manifestPath, nextBuildable: layout.layout.next, errors, warnings };
}
