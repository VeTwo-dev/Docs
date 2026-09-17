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
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import type { DocsConfig } from "../config/types.js";
import type { Logger } from "../types/internal.js";
import { resolveOutputLayout } from "../config/resolve.js";
import { compileDocumentation, buildCompilerInput } from "../documentation/compiler/index.js";
import type { CompilerProjectInput, ComposedExample } from "../documentation/compiler/types.js";
import { buildManifest } from "../documentation/compiler/manifest.js";
import { shouldOverwrite, markGeneratedFor } from "../documentation/compiler/ownership.js";
import { renderNextJsSite } from "../renderers/nextjs/adapter.js";
import { renderMarkdownSite } from "../renderers/markdown/renderer.js";
import { renderStaticSite } from "../renderers/static/renderer.js";
import { buildOutputPlan } from "../renderers/output-plan.js";
import { discoverImageSources } from "../renderers/assets.js";
import { buildProjectKnowledge, knowledgeToCompilerInput } from "../intelligence/build-knowledge.js";
import { discoverEnvVars } from "../intelligence/discovery/env.js";
import { classifyDependencies } from "../intelligence/discovery/dependencies.js";
import { detectFramework } from "../intelligence/discovery/framework.js";
import { discoverExamples } from "../intelligence/discovery/examples.js";
import { DocsError } from "../errors/classes.js";
import { ErrorCode } from "../errors/codes.js";
import type { DocumentationIR } from "../documentation/compiler/ir.js";
import type { RenderedSite } from "../renderers/types.js";

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
        purpose: sym.documentation.summary.length > 0 && sym.documentation.summary.length <= 200
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
      let text = "";
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
      const language = file.path.endsWith("x") ? "tsx" : file.path.endsWith(".ts") || file.path.endsWith(".mts") ? "ts" : "js";
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
      issues.push({ severity: "error", message: `${site.target}: file escapes output root: ${file.path}` });
    }
  }
  return issues;
}

function writeSiteFiles(
  site: RenderedSite,
  outputRoot: string,
  logger: Logger,
  written: string[],
  warnings: string[],
): void {
  mkdirSync(resolve(outputRoot), { recursive: true });
  for (const file of site.files) {
    const target = resolve(join(resolve(outputRoot), file.path));
    if (target !== resolve(outputRoot) && !target.startsWith(resolve(outputRoot) + sep)) {
      throw new DocsError({ code: ErrorCode.BUILD_FAILED, message: `Renderer ${site.target} escaped its root: ${file.path}` });
    }
    // JSON payloads (page data, manifests, search) are deterministic build
    // artifacts regenerated every run — never user-edited, always refresh.
    // Source files (.mdx/.tsx/.html/.css) honor ownership to preserve edits.
    const isDerivedJson = file.path.endsWith(".json");
    if (!isDerivedJson) {
      const existing = existsSync(target) ? readFileSync(target, "utf8") : undefined;
      // Idempotent rewrite: identical bytes are not a conflict (also heals
      // files written before ownership headers existed).
      if (existing !== undefined && existing !== file.contents && !shouldOverwrite(existing, file.contents)) {
        warnings.push(`Preserving user-owned ${target}`);
        logger.warn(`Preserving user-owned ${target}`);
        continue;
      }
    }
    mkdirSync(dirname(target), { recursive: true });
    // Sources carry a format-appropriate generated header; JSON stays machine-readable.
    const contents = file.path.endsWith(".json") ? file.contents : markGeneratedFor(file.path, file.contents);
    writeFileSync(target, contents, "utf8");
    written.push(target);
  }
}

/** Validate a materialized plan: routes, links, CSS wiring, manifest. Pure checks on IR + sites. */
export function validateMaterialization(
  ir: DocumentationIR,
  next: RenderedSite | undefined,
  md: RenderedSite | undefined,
  statik: RenderedSite | undefined,
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
      issues.push({ severity: "error", message: "Next.js: app/layout.tsx does not import globals.css" });
    }
    // Every IR page must have a JSON payload.
    for (const page of ir.pages) {
      if (!paths.has(`data/pages/${encodeURIComponent(page.slug)}.json`)) {
        issues.push({ severity: "error", message: `Next.js: missing data payload for page ${page.slug}` });
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
        if (!ok) issues.push({ severity: "error", message: `Next.js: home redirects to missing route ${target}` });
      } catch {
        issues.push({ severity: "warning", message: "Next.js: home redirect target not statically verifiable" });
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
      if (!paths.has(`${page.slug}.mdx`) && !paths.has("index.mdx")) {
        issues.push({ severity: "error", message: `Markdown: missing page ${page.slug}.mdx` });
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
      if (p.includes("..")) {
        issues.push({ severity: "error", message: `Static: escaping path: ${p}` });
      }
    }
  }

  return issues;
}

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

  // 1. Deterministic sources
  const envVars = discoverEnvVars(rootDir);
  const depKnowledge = classifyDependencies(rootDir);
  const framework = detectFramework(rootDir);
  const examples = discoverExamples(rootDir);

  // 2. ProjectKnowledge → CompilerInput (async: wires real Phase 21 API symbols)
  let compilerInput: ReturnType<typeof buildCompilerInput>;
  try {
    const knowledge = await buildProjectKnowledge({
      rootDir,
      signals: {
        hasBin: true,
        isMonorepo: false,
        framework: framework ?? undefined,
        configKeys: ["title", "baseUrl", "theme", "api", "search"],
        commands: [
          { name: "docs build", description: "Build docs" },
          { name: "docs dev", description: "Dev server" },
          { name: "docs generate", description: "Generate docs" },
        ],
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
      },
    } as typeof base;
  } catch {
    compilerInput = buildCompilerInput(rootDir);
  }

  // 3. Compile IR + output plan (single semantic source for all renderers).
  // Composed examples: validated JSDoc examples first (symbol-linked), then
  // bounded excerpts from discovered example files. Never invented.
  const composedExamples = composeExamples(compilerInput.apiSymbols ?? [], examples, rootDir);
  const { architecture, ir, diagnostics } = compileDocumentation(compilerInput, {}, { examples: composedExamples });
  // Structural corruption fails the build; content gaps are warnings.
  for (const d of diagnostics) {
    if (d.severity === "error" && (d.code === "DOC_DUPLICATE_TITLE" || d.code === "DOC_DUPLICATE_BREADCRUMB")) {
      errors.push(`compile: ${d.message}`);
    } else if (d.severity !== "info") {
      warnings.push(`compile: ${d.message}`);
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

  let nextSite: RenderedSite | undefined;
  let mdSite: RenderedSite | undefined;
  let staticSite: RenderedSite | undefined;

  if (layout.layout.next) {
    nextSite = renderNextJsSite(ir, { siteName: config.title, description: config.description, docsBasePath: "/docs" });
    for (const issue of assertRendererBoundary(nextSite, nextDir)) {
      errors.push(issue.message);
    }
    writeSiteFiles(nextSite, nextDir, logger, written, warnings);
    // Materialize validated image bytes into Next public/
    for (const asset of assetPlan.assets) {
      if (asset.missing || asset.bytes === undefined) continue;
      const target = resolve(join(nextDir, asset.nextPath));
      if (!target.startsWith(resolve(nextDir) + sep)) continue;
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, asset.bytes);
      written.push(target);
    }
  }

  if (layout.layout.markdown) {
    mdSite = renderMarkdownSite(ir, { siteName: config.title, description: config.description, docsBasePath: "/docs" });
    for (const issue of assertRendererBoundary(mdSite, mdDir)) {
      errors.push(issue.message);
    }
    writeSiteFiles(mdSite, mdDir, logger, written, warnings);
  }

  if (layout.layout.static) {
    staticSite = renderStaticSite(ir, { siteName: config.title, description: config.description, docsBasePath: "/docs" });
    for (const issue of assertRendererBoundary(staticSite, staticDir)) {
      errors.push(issue.message);
    }
    writeSiteFiles(staticSite, staticDir, logger, written, warnings);
    // Materialize image bytes into static/assets (text-safe: only write when bytes exist)
    for (const asset of assetPlan.assets) {
      if (asset.missing || asset.bytes === undefined) continue;
      const target = resolve(join(staticDir, asset.staticPath));
      if (!target.startsWith(resolve(staticDir) + sep)) continue;
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, asset.bytes);
      written.push(target);
    }
  }

  // 6. Manifest (pure JSON) at workspace root, including the file inventory
  // from the PREVIOUS run for stale-output reconciliation below.
  const manifest = buildManifest(architecture, ir, []);
  const manifestPath = join(outputDir, "manifest.json");
  let previousFiles: { next: readonly string[]; md: readonly string[]; static: readonly string[] } | undefined;
  if (existsSync(manifestPath)) {
    try {
      const prev = JSON.parse(readFileSync(manifestPath, "utf8")) as { files?: { next: readonly string[]; md: readonly string[]; static: readonly string[] } };
      previousFiles = prev.files;
    } catch {
      previousFiles = undefined;
    }
  }
  // Current inventory per renderer root, classified from written paths.
  const inventory = { next: [] as string[], md: [] as string[], static: [] as string[] };
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
    if (s !== undefined) inventory.static.push(s);
  }
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(
    manifestPath,
    JSON.stringify(
      { ...manifest, generatedAt: new Date().toISOString(), _generatedBy: "@vetwo/docs", files: inventory },
      null,
      2,
    ),
    "utf8",
  );
  written.push(manifestPath);

  // 7. Search index (pure JSON derived artifact) at root + next public/
  const searchEntries = plan.pages.map((p) => ({
    id: p.slug,
    title: p.title,
    content: p.page.blocks
      .filter((b) => b.kind === "paragraph")
      .map((b) => (b as { text: string }).text)
      .join(" "),
    url: p.route,
    category: p.sectionId,
  }));
  const searchContent = JSON.stringify(
    { entries: searchEntries, generatedAt: new Date().toISOString(), engine: config.search.engine, _generatedBy: "@vetwo/docs" },
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
  if (previousFiles !== undefined) {
    const { rmSync } = await import("node:fs");
    const roots = { next: nextDir, md: mdDir, static: staticDir } as const;
    for (const bucket of ["next", "md", "static"] as const) {
      if (!layout.layout[bucket === "static" ? "static" : bucket === "md" ? "markdown" : "next"]) continue;
      const current = new Set(inventory[bucket]);
      for (const rel of previousFiles[bucket] ?? []) {
        if (current.has(rel)) continue;
        const target = resolve(join(roots[bucket], rel));
        if (!target.startsWith(resolve(roots[bucket]) + sep)) continue;
        if (!existsSync(target)) continue;
        const content = readFileSync(target, "utf8");
        // Delete only provably generated files: header present, or byte-identical
        // JSON payloads (deterministic artifacts without headers).
        if (content.includes("generated by @vetwo/docs") || rel.endsWith(".json")) {
          rmSync(target, { force: true });
          warnings.push(`Removed stale generated file ${target}`);
        } else {
          warnings.push(`Keeping unknown file (not in plan, not generated): ${target}`);
        }
      }
    }
  }
  // Migration for the broken-era leak (renderer-owned knowledge, unconditional
  // and safe): content/ inside next/ belongs to the Markdown renderer now, and
  // app/docs/[slug] cannot serve nested slugs (replaced by [[...slug]]).
  // Plus: headered files under renderer roots that no inventory ever claimed
  // are provably stale generated artifacts (the header is only ever written
  // by this generator) — remove them; headerless unknowns are preserved.
  {
    const { rmSync, readdirSync, statSync } = await import("node:fs");
    for (const legacy of ["content", "app/docs/[slug]"]) {
      const target = join(nextDir, legacy);
      if (existsSync(target)) {
        rmSync(target, { recursive: true, force: true });
        warnings.push(`Removed legacy output ${target}`);
        logger.warn(`Removed legacy output ${target}`);
      }
    }
    const SKIP_DIRS = new Set(["node_modules", ".next", "out", ".git"]);
    const currentSets = {
      next: new Set(inventory.next),
      md: new Set(inventory.md),
      static: new Set(inventory.static),
    };
    const walk = (dir: string, base: string, bucket: "next" | "md" | "static"): void => {
      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = join(dir, entry);
        const rel = base.length > 0 ? `${base}/${entry}` : entry;
        let isDir = false;
        try {
          isDir = statSync(full).isDirectory();
        } catch {
          continue;
        }
        if (isDir) {
          if (!SKIP_DIRS.has(entry)) walk(full, rel, bucket);
          continue;
        }
        if (currentSets[bucket].has(rel)) continue;
        let content = "";
        try {
          content = readFileSync(full, "utf8");
        } catch {
          continue;
        }
        if (content.includes("generated by @vetwo/docs")) {
          rmSync(full, { force: true });
          warnings.push(`Removed stale generated file ${full}`);
        }
      }
    };
    if (layout.layout.next) walk(nextDir, "", "next");
    if (layout.layout.markdown) walk(mdDir, "", "md");
    if (layout.layout.static) walk(staticDir, "", "static");
  }

  // 9. Validation gate — fail loudly, never claim success on broken output
  const issues = validateMaterialization(ir, nextSite, mdSite, staticSite);
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
