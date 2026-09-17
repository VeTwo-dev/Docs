/**
 * Safe Content Regeneration Pipeline.
 *
 * The end-to-end flow behind `docs generate --dry-run`:
 *
 *   load authored content → compile generated pages → compose per page →
 *   audit ownership → plan → stage → validate → commit (unless dry-run)
 *
 * User-authored files are never written; conflicts are persisted to
 * `.vetwo/docs/conflicts/` for `docs content conflicts`.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { compileArchitecture } from "../documentation/compiler/orchestrator.js";
import type { DocumentationArchitecture } from "../documentation/compiler/types.js";
import type { CompilerProjectInput } from "../documentation/compiler/types.js";
import type { DocumentationDiagnostic } from "../documentation/compiler/diagnostics.js";
import type { IRBlock } from "../documentation/compiler/ir.js";

import { parseMarkdown } from "./parser/markdown.js";
import { parseMdx } from "./parser/mdx.js";
import { createComponentRegistry } from "./components/registry.js";
import type { DocumentationComponentRegistry } from "./components/registry.js";
import {
  auditOwnership,
  createOwnershipManifest,
  hashContent,
  planRegeneration,
} from "./manifest.js";
import type {
  ContentOwnershipManifest,
  OwnedFileEntry,
  RegenerationPlan,
} from "./manifest.js";
import { composePage } from "./composition/engine.js";
import type { ContentLayer } from "./composition/engine.js";
import type { AuthoredDocument } from "./types.js";

/** Where the project's content lives. */
export interface ContentRegenerationOptions {
  readonly rootDir: string;
  /** Compiler input for the deterministic generator. */
  readonly input: CompilerProjectInput;
  /** Authored-content directory (default `<root>/docs/content`). */
  readonly contentDir?: string;
  /** Component map from config: name → module path. */
  readonly components?: Readonly<Record<string, string>>;
  readonly dryRun?: boolean;
  readonly force?: boolean;
}

/** The outcome of one regeneration pass. */
export interface RegenerationResult {
  readonly plan: RegenerationPlan;
  readonly conflicts: readonly DocumentationDiagnostic[];
  readonly audit: ReturnType<typeof auditOwnership>;
  readonly registry: DocumentationComponentRegistry;
  /** Files actually written (empty in dry-run). */
  readonly written: readonly string[];
}

/**
 * Execute the safe regeneration pipeline.
 * Never writes user-authored files; only files it owns under
 * `generatedDir` and internal state under `.vetwo/docs/`.
 */
export function runContentRegeneration(options: ContentRegenerationOptions): RegenerationResult {
  const rootDir = resolve(options.rootDir);
  const contentDir = options.contentDir ?? join(rootDir, "docs", "content");

  // ── 1. Load authored content ────────────────────────────────────────
  const authored = loadAuthored(contentDir);

  // Component registry from config.
  const registry = createComponentRegistry(
    Object.entries(options.components ?? {}).map(([name, module]) => ({
      name,
      module,
    })),
  );

  // ── 2. Compile the deterministic architecture ────────────────────────
  const architecture = compileArchitecture(options.input);
  const generatedLayers = generatedLayersOf(architecture);

  // ── 3. Compose each page ─────────────────────────────────────────────
  const conflicts: DocumentationDiagnostic[] = [];
  const composedFiles: { path: string; slug: string; contents: string }[] = [];
  const candidates: { slug: string; path: string; desiredFingerprint: string; existsOnDisk: boolean }[] = [];
  const candidateFingerprints = new Map<string, string>();

  for (const [slug, layer] of generatedLayers) {
    const userDoc = authored.get(slug);
    const protectedPage = userDoc?.frontmatter.protected === true;

    const composition = composePage({
      slug,
      generated: layer,
      ...(userDoc !== undefined
        ? {
            user: {
              ownership: "user-authored" as const,
              title: userDoc.frontmatter.title,
              blocks: userDoc.blocks.map((b) => b.block),
            },
          }
        : {}),
      protectedPage,
    });
    conflicts.push(...composition.conflicts);

    // Markdown serialization of composed blocks (deterministic).
    const contents = serializeComposed(composition.title, composition.blocks);
    const relPath = join("docs", "generated", `${slug}.md`);
    const fingerprint = fingerprintBlocksOf(composition.blocks);
    candidates.push({
      slug,
      path: relPath,
      desiredFingerprint: fingerprint,
      existsOnDisk: existsSync(join(rootDir, relPath)),
    });
    candidateFingerprints.set(slug, fingerprint);
    composedFiles.push({ path: relPath, slug, contents });
  }

  // Pages that exist only as user-authored content are never planned.

  // ── 4. Audit ownership + load/create manifest ────────────────────────
  const manifestPath = join(rootDir, ".vetwo", "docs", "manifests", "content.json");
  const manifest = loadManifest(manifestPath);

  const currentHashes: Record<string, string> = {};
  for (const candidate of candidates) {
    const abs = join(rootDir, candidate.path);
    if (existsSync(abs)) {
      currentHashes[candidate.path] = hashContent(readFileSync(abs, "utf-8"));
    }
  }

  const protectedFromFrontmatter: string[] = [];
  for (const [slug, doc] of authored) {
    if (doc.frontmatter.protected === true) protectedFromFrontmatter.push(slug);
  }
  const audit = auditOwnership(manifest, currentHashes, protectedFromFrontmatter);

  // ── 5. Plan ─────────────────────────────────────────────────────────
  const conflictedSlugs = new Set(conflicts.map((c) => c.subject ?? ""));
  const protectedSlugs = [...protectedFromFrontmatter];

  const plan = planRegeneration({
    manifest,
    candidates,
    currentHashes,
    protectedSlugs,
    conflictedSlugs: [...conflictedSlugs],
    force: options.force === true,
  });

  // ── 6. Stage & commit ────────────────────────────────────────────────
  const written: string[] = [];
  if (options.dryRun !== true) {
    const actionBySlug = new Map(plan.entries.map((e) => [e.slug, e.action]));
    const updatedFiles: OwnedFileEntry[] = [];

    for (const file of composedFiles) {
      const action = actionBySlug.get(file.slug);
      if (action !== "create" && action !== "update") continue;
      const abs = join(rootDir, file.path);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, file.contents, "utf-8");
      written.push(file.path);
      updatedFiles.push({
        path: file.path,
        slug: file.slug,
        owner: "generated",
        contentHash: hashContent(file.contents),
        fingerprint: candidateFingerprints.get(file.slug),
        generatorVersion: "1.0.0",
      });
    }

    // Deletions: only previously-owned generated files that disappeared.
    // A file whose contents were manually changed is adopted as protected
    // instead of deleted — user work is never destroyed.
    for (const entry of plan.entries) {
      if (entry.action !== "delete") continue;
      const path = Object.keys(manifest.files).find(
        (p) => manifest.files[p]?.slug === entry.slug,
      );
      if (path === undefined) continue;
      const abs = join(rootDir, path);
      try {
        if (!existsSync(abs)) continue;
        const onDisk = readFileSync(abs, "utf-8");
        const recorded = manifest.files[path];
        if (recorded !== undefined && hashContent(onDisk) !== recorded.contentHash) {
          updatedFiles.push({
            path,
            slug: entry.slug,
            owner: "protected",
            contentHash: hashContent(onDisk),
          });
          continue;
        }
        unlinkSync(abs);
        written.push(`${path} (deleted)`);
      } catch {
        // best-effort cleanup
      }
    }

    // Merge manifest: keep user entries, refresh regenerated ones.
    const merged: Record<string, OwnedFileEntry> = {
      ...Object.fromEntries(Object.entries(manifest.files)),
    };
    for (const updated of updatedFiles) {
      merged[updated.path] = updated;
    }
    for (const entry of plan.entries) {
      if (entry.action !== "delete") continue;
      const path = Object.keys(merged).find((p) => merged[p]?.slug === entry.slug);
      if (path !== undefined && merged[path]?.owner === "generated") delete merged[path];
    }

    saveManifest(manifestPath, { schemaVersion: 1, files: merged });

    // Persist conflicts for `docs content conflicts`.
    const conflictsDir = join(rootDir, ".vetwo", "docs", "conflicts");
    mkdirSync(conflictsDir, { recursive: true });
    writeFileSync(
      join(conflictsDir, "conflicts.json"),
      JSON.stringify(conflicts, null, 2),
      "utf-8",
    );

    // Persist a content snapshot for `docs content diff`.
    const snapshotsDir = join(rootDir, ".vetwo", "docs", "snapshots");
    mkdirSync(snapshotsDir, { recursive: true });
    const contentSnapshot: Record<
      string,
      { title: string; blocks: { index: number; block: IRBlock }[] }
    > = {};
    for (const [slug, layer] of generatedLayers) {
      const userDoc = authored.get(slug);
      const composition = composePage({
        slug,
        generated: layer,
        ...(userDoc !== undefined
          ? {
              user: {
                ownership: "user-authored" as const,
                title: userDoc.frontmatter.title,
                blocks: userDoc.blocks.map((b) => b.block),
              },
            }
          : {}),
        protectedPage: userDoc?.frontmatter.protected === true,
      });
      contentSnapshot[slug] = {
        title: composition.title,
        blocks: composition.blocks.map((b) => ({ index: b.index, block: b.block })),
      };
    }
    writeFileSync(
      join(snapshotsDir, "content.json"),
      JSON.stringify(contentSnapshot, null, 2),
      "utf-8",
    );
  }

  return { plan, conflicts, audit, registry, written };
}

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Load all authored documents keyed by slug. */
function loadAuthored(contentDir: string): Map<string, AuthoredDocument> {
  const docs = new Map<string, AuthoredDocument>();
  if (!existsSync(contentDir)) return docs;

  const walk = (dir: string): void => {
    for (const entry of readdirSafe(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (/\.(md|mdx)$/.test(entry)) {
        const raw = readFileSync(full, "utf-8");
        const rel = full.slice(contentDir.length + 1).replace(/\\/g, "/");
        const slug = rel.replace(/\.(md|mdx)$/, "");
        const doc = entry.endsWith(".mdx")
          ? parseMdx(rel, slug, raw, {}).document
          : parseMarkdown(rel, slug, raw);
        docs.set(slug, doc);
      }
    }
  };
  walk(contentDir);
  return docs;
}

/** Deterministic generated layers keyed by slug. */
function generatedLayersOf(
  architecture: DocumentationArchitecture,
): Map<string, ContentLayer> {
  const layers = new Map<string, ContentLayer>();
  for (const page of architecture.pages) {
    // Reconstruct blocks from the architecture definition deterministically.
    const blocks: IRBlock[] = [
      { kind: "heading", level: 1, text: page.title },
      ...(page.summary.length > 0 ? [{ kind: "paragraph" as const, text: page.summary }] : []),
      ...page.symbols.map((symbol) => ({ kind: "list" as const, ordered: false, items: [`\`${symbol}\``] })),
    ];
    layers.set(page.slug, { ownership: "generated", title: page.title, blocks });
  }
  return layers;
}

/** Minimal deterministic markdown serialization for composed pages. */
export function serializeComposed(
  title: string,
  blocks: readonly { block: IRBlock }[],
): string {
  const lines: string[] = ["---", `title: ${JSON.stringify(title)}`, "---", ""];
  for (const { block } of blocks) {
    switch (block.kind) {
      case "heading":
        lines.push("", `${"#".repeat(block.level)} ${block.text}`);
        break;
      case "paragraph":
        lines.push("", block.text);
        break;
      case "code":
        lines.push("", "```" + block.language, block.code, "```");
        break;
      case "list":
        lines.push("", ...block.items.map((item) => `- ${item}`));
        break;
      case "callout":
        lines.push("", `> **Note** ${block.text}`);
        break;
      case "table":
        lines.push(
          "",
          `| ${block.headers.join(" | ")} |`,
          `| ${block.headers.map(() => "---").join(" | ")} |`,
          ...block.rows.map((row) => `| ${row.join(" | ")} |`),
        );
        break;
      case "custom": {
        const props = Object.entries(block.props ?? {})
          .map(([k, v]) =>
            typeof v === "string" ? `${k}="${v}"` : `${k}={${JSON.stringify(v)}}`,
          )
          .join(" ");
        lines.push("", `<${block.component}${props.length > 0 ? ` ${props}` : ""} />`);
        break;
      }
    }
  }
  return `${lines.join("\n")}\n`;
}

function fingerprintBlocksOf(blocks: readonly { block: IRBlock }[]): string {
  return hashContent(JSON.stringify(blocks.map((b) => b.block)));
}

/** Recover blocks from a serialized composed file (for manifest updates). */
function loadManifest(path: string): ContentOwnershipManifest {
  if (!existsSync(path)) return createOwnershipManifest();
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as ContentOwnershipManifest;
  } catch {
    return createOwnershipManifest();
  }
}

function saveManifest(path: string, manifest: ContentOwnershipManifest): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(manifest, null, 2), "utf-8");
}

function readdirSafe(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}
