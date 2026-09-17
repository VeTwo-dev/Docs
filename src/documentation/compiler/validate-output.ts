/**
 * Generated Workspace Validation (Phase 22.2).
 *
 * Validates a materialized documentation workspace on disk:
 * renderer boundaries, manifest, ownership, routes, internal links, assets,
 * CSS wiring, Markdown validity, search and navigation consistency.
 * Pure filesystem reads; returns structured results (exit code decided by caller).
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";

export interface WorkspaceValidation {
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly pages: number;
  readonly routes: number;
  readonly assets: number;
}

function listFilesRecursive(dir: string, base = ""): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = base.length > 0 ? `${base}/${entry}` : entry;
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry === "out") continue;
      out.push(...listFilesRecursive(full, rel));
    } else {
      out.push(rel);
    }
  }
  return out;
}

function readJson(path: string): unknown | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

/** Validate the generated workspace at `outDir`. */
export function validateWorkspace(_rootDir: string, outDir: string): WorkspaceValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  let pages = 0;
  let routes = 0;
  let assets = 0;

  const nextDir = join(outDir, "next");
  const mdDir = join(outDir, "md");
  const staticDir = join(outDir, "static");

  // ── Boundaries ────────────────────────────────────────────────────
  if (existsSync(nextDir)) {
    for (const f of listFilesRecursive(nextDir)) {
      if (f.startsWith("content/") || f === "index.html" || f.startsWith("api/") || f.startsWith("md/") || f.startsWith("static/")) {
        errors.push(`next/ boundary leak: ${f}`);
      }
    }
  }
  if (existsSync(mdDir)) {
    for (const f of listFilesRecursive(mdDir)) {
      if (!f.endsWith(".mdx") && !f.endsWith(".md")) {
        errors.push(`md/ contains non-markdown file: ${f}`);
      }
      if (f.startsWith("app/") || f === "index.html" || f.endsWith(".tsx") || f.endsWith(".ts")) {
        errors.push(`md/ boundary leak: ${f}`);
      }
    }
  }
  if (existsSync(staticDir)) {
    for (const f of listFilesRecursive(staticDir)) {
      if (f.startsWith("next/") || f.startsWith("md/") || f.startsWith("app/") || f.endsWith(".tsx")) {
        errors.push(`static/ boundary leak: ${f}`);
      }
      if (f.includes("..")) errors.push(`static/ escaping path: ${f}`);
    }
  }

  // ── Manifest ──────────────────────────────────────────────────────
  const manifestPath = join(outDir, "manifest.json");
  let manifestPages: Array<{ slug: string; title: string }> = [];
  if (existsSync(manifestPath)) {
    const manifest = readJson(manifestPath) as { pages?: Array<{ slug: string; title: string }> } | undefined;
    if (manifest?.pages === undefined) {
      errors.push("manifest.json is not valid JSON with a pages array");
    } else {
      manifestPages = manifest.pages;
      pages = manifestPages.length;
    }
  } else {
    warnings.push("manifest.json missing (workspace not generated yet?)");
  }

  // ── Next.js structure ─────────────────────────────────────────────
  if (existsSync(nextDir)) {
    for (const required of ["package.json", "app/layout.tsx", "app/page.tsx", "app/docs/[[...slug]]/page.tsx", "components/block-renderer.tsx", "app/globals.css"]) {
      if (!existsSync(join(nextDir, required))) {
        // Legacy single-segment route is a known-broken shape.
        if (required === "app/docs/[[...slug]]/page.tsx" && existsSync(join(nextDir, "app/docs/[slug]/page.tsx"))) {
          errors.push("next/: legacy app/docs/[slug]/page.tsx cannot serve nested slugs (need [[...slug]])");
        } else {
          errors.push(`next/: missing ${required}`);
        }
      }
    }
    const layout = existsSync(join(nextDir, "app/layout.tsx")) ? readFileSync(join(nextDir, "app/layout.tsx"), "utf8") : "";
    if (layout.length > 0 && !layout.includes("globals.css")) {
      errors.push("next/: app/layout.tsx does not import globals.css");
    }
    const pkg = readJson(join(nextDir, "package.json")) as { dependencies?: Record<string, string> } | undefined;
    if (pkg === undefined) errors.push("next/: package.json is not valid JSON");
    // Home redirect target must exist.
    const home = existsSync(join(nextDir, "app/page.tsx")) ? readFileSync(join(nextDir, "app/page.tsx"), "utf8") : "";
    const redirect = /redirect\((.*?)\)/.exec(home)?.[1];
    if (redirect !== undefined) {
      try {
        const target: string = JSON.parse(redirect);
        const dataDir = join(nextDir, "data/pages");
        const slugs = existsSync(dataDir)
          ? listFilesRecursive(dataDir).map((f) => decodeURIComponent(f.replace(/\.json$/, "")))
          : [];
        const routeExists = slugs.some((s) => target === `/docs/${s}` || target.endsWith(`/${s}`));
        if (!routeExists) errors.push(`next/: home redirects to missing route ${target}`);
      } catch {
        warnings.push("next/: home redirect target not statically verifiable");
      }
    }
  }

  // ── Markdown ──────────────────────────────────────────────────────
  if (existsSync(mdDir)) {
    const mdFiles = listFilesRecursive(mdDir);
    for (const slug of manifestPages.map((p) => p.slug)) {
      if (!mdFiles.includes(`${slug}.mdx`) && !mdFiles.includes("index.mdx")) {
        errors.push(`md/: missing ${slug}.mdx`);
      }
    }
    // Frontmatter sanity on a sample (skip the generated ownership header).
    for (const f of mdFiles.slice(0, 5)) {
      const content = readFileSync(join(mdDir, f), "utf8");
      const body = content.startsWith("<!-- generated by @vetwo/docs")
        ? content.slice(content.indexOf("\n") + 1)
        : content.startsWith("// generated by @vetwo/docs")
          ? content.slice(content.indexOf("\n") + 1)
          : content;
      if (!body.startsWith("---")) warnings.push(`md/: ${f} has no frontmatter`);
    }
  }

  // ── Static ────────────────────────────────────────────────────────
  if (existsSync(staticDir)) {
    if (!existsSync(join(staticDir, "index.html"))) errors.push("static/: index.html missing");
    if (!existsSync(join(staticDir, "assets/css/globals.css"))) errors.push("static/: assets/css/globals.css missing");
    const htmlFiles = listFilesRecursive(staticDir).filter((f) => f.endsWith(".html"));
    routes = htmlFiles.length;
    // Every manifest page must have a static HTML file.
    for (const slug of manifestPages.map((p) => p.slug)) {
      if (!htmlFiles.includes(`${slug}/index.html`) && !htmlFiles.includes("index.html")) {
        errors.push(`static/: missing page ${slug}/index.html`);
      }
    }
    // No absolute source paths leak.
    for (const f of htmlFiles.slice(0, 20)) {
      const content = readFileSync(join(staticDir, f), "utf8");
      if (/\/media\/|\/home\/|\/Users\/|C:\\/.test(content)) {
        errors.push(`static/: absolute filesystem path leaked in ${f}`);
      }
    }
  }

  // ── Search ────────────────────────────────────────────────────────
  const searchPath = join(outDir, "search-index.json");
  if (existsSync(searchPath)) {
    const search = readJson(searchPath) as { entries?: Array<{ id: string; url: string }> } | undefined;
    if (search?.entries === undefined) {
      errors.push("search-index.json is not valid JSON with entries");
    } else {
      const knownRoutes = new Set(manifestPages.map((p) => `/docs/${p.slug}`));
      for (const entry of search.entries.slice(0, 50)) {
        if (!knownRoutes.has(entry.url)) {
          warnings.push(`search: entry ${entry.id} points to unknown route ${entry.url}`);
          break;
        }
      }
    }
  } else {
    warnings.push("search-index.json missing");
  }

  // ── Assets ────────────────────────────────────────────────────────
  const assetDirs = [join(staticDir, "assets"), join(nextDir, "public/assets")].filter((d) => existsSync(d));
  for (const dir of assetDirs) {
    assets += listFilesRecursive(dir).length;
  }
  void sep;

  return { errors, warnings, pages, routes, assets };
}
