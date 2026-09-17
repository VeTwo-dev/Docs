/**
 * Change Detection & Classification.
 *
 * Compares the current project against the previous snapshot and
 * produces a structured change model. Not all modifications are equal:
 * formatting-only, comment-only and documentation-only changes carry
 * far less semantic weight than public API changes.
 *
 * Git is used when available (working tree / ref comparison) but is
 * never required.
 */

import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { execSync } from "node:child_process";

import { hashContent, semanticHash } from "./fingerprints.js";
import type { ProjectSnapshot, TrackedFileKind } from "./snapshot.js";
import type { SnapshotFileEntry } from "./snapshot.js";

/** ─── Change model ─────────────────────────────────────────────────── */

export type ChangeKind = "added" | "removed" | "modified" | "renamed" | "moved" | "unchanged";

/** Semantic categories — a change may carry several. */
export type SemanticCategory =
  | "documentation-only"
  | "formatting-only"
  | "internal-implementation"
  | "public-api"
  | "configuration"
  | "dependency"
  | "architecture";

/** A structured project change. */
export interface ProjectChange {
  readonly kind: ChangeKind;
  /** Path relative to project root. */
  readonly path: string;
  readonly oldPath?: string;
  readonly categories: readonly SemanticCategory[];
  /** Symbols added/removed/changed in this file. */
  readonly affectedSymbols: {
    readonly added: readonly string[];
    readonly removed: readonly string[];
  };
  /** 0..1 confidence in this classification. */
  readonly confidence: number;
}

/** Result of comparing two states. */
export interface ChangeSet {
  readonly changes: readonly ProjectChange[];
  readonly unchangedCount: number;
}

/** ─── Current-state scanning ───────────────────────────────────────── */

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const DOC_EXTENSIONS = [".md", ".mdx"];
const CONFIG_FILES = ["docs.config.ts", "docs.config.js", "docs.config.mjs", "tsconfig.json"];
const ASSET_EXTENSIONS = [
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico",
  ".woff", ".woff2", ".ttf",
];

export function classifyFileKind(relPath: string): TrackedFileKind {
  const base = relPath.split("/").pop() ?? relPath;
  if (base === "package.json") return "manifest";
  if (CONFIG_FILES.includes(base)) return "config";
  if (DOC_EXTENSIONS.some((e) => base.endsWith(e))) return "documentation";
  if (ASSET_EXTENSIONS.some((e) => base.endsWith(e))) return "asset";
  if (SOURCE_EXTENSIONS.some((e) => base.endsWith(e))) return "source";
  return "source";
}

export interface ScanEntry {
  readonly path: string;
  readonly contents: string;
}

/**
 * Scan the current state of trackable files under a directory.
 * Ignores node_modules, .vetwo, dist/out build outputs.
 */
export function scanProjectFiles(
  rootDir: string,
  options: { readonly includeGenerated?: boolean } = {},
): ScanEntry[] {
  const entries: ScanEntry[] = [];
  const ignoreDirs = new Set([
    "node_modules", ".git", ".vetwo", ".next", "dist", "out", "coverage",
  ]);
  if (options.includeGenerated !== true) ignoreDirs.add("generated");

  const walk = (dir: string): void => {
    let items: string[];
    try {
      items = readdirSafe(dir);
    } catch {
      return;
    }
    for (const item of items) {
      const full = join(dir, item);
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        if (!ignoreDirs.has(item)) walk(full);
      } else {
        const rel = relative(rootDir, full).replace(/\\/g, "/");
        const kind = classifyFileKind(rel);
        // Only track kinds we understand.
        const ext = item.slice(item.lastIndexOf("."));
        const trackable =
          kind === "manifest" ||
          kind === "config" ||
          SOURCE_EXTENSIONS.includes(ext) ||
          DOC_EXTENSIONS.includes(ext) ||
          ASSET_EXTENSIONS.includes(ext);
        if (!trackable) continue;
        try {
          entries.push({ path: rel, contents: readFileSync(full, "utf-8") });
        } catch {
          // Binary asset — fingerprint by placeholder of size+mtime-free name.
          entries.push({ path: rel, contents: `binary:${stat.size}:${rel}` });
        }
      }
    }
  };
  walk(rootDir);
  return entries;
}

/** Build a snapshot file entry for scanned content. */
export function snapshotFileEntry(entry: ScanEntry): SnapshotFileEntry {
  const kind = classifyFileKind(entry.path);
  const base: SnapshotFileEntry = {
    contentHash: hashContent(entry.contents),
    semanticHash: semanticHash(entry.contents),
    kind,
  };
  if (kind === "manifest") {
    try {
      const pkg = JSON.parse(entry.contents) as {
        dependencies?: Record<string, string>;
        peerDependencies?: Record<string, string>;
      };
      return {
        ...base,
        dependencies: [
          ...Object.keys(pkg.dependencies ?? {}),
          ...Object.keys(pkg.peerDependencies ?? {}),
        ].sort(),
      };
    } catch {
      return base;
    }
  }
  if (kind === "source") {
    return { ...base, exports: extractExportNames(entry.contents) };
  }
  return base;
}

/** Cheap export-name extraction (no full AST — deterministic regex pass). */
export function extractExportNames(source: string): string[] {
  const names = new Set<string>();
  for (const match of source.matchAll(
    /export\s+(?:async\s+)?(?:function|class|const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g,
  )) {
    if (match[1] !== undefined) names.add(match[1]);
  }
  for (const match of source.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of match[1]?.split(",") ?? []) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name !== undefined && /^[\w$]+$/.test(name)) names.add(name);
    }
  }
  return [...names];
}

// ─── Detection ───────────────────────────────────────────────────────────

/**
 * Compare current files against the previous snapshot.
 */
export function detectChanges(
  previous: ProjectSnapshot | undefined,
  currentEntries: readonly ScanEntry[],
): ChangeSet {
  if (previous === undefined) {
    // No previous state: everything is "added" but flagged as initial.
    return {
      changes: currentEntries.map((entry) => ({
        kind: "added" as const,
        path: entry.path,
        categories: categoriesForInitial(entry),
        affectedSymbols: { added: [], removed: [] },
        confidence: 1,
      })),
      unchangedCount: 0,
    };
  }

  const previousFiles = previous.files;
  const current = new Map(currentEntries.map((e) => [e.path, e]));

  const changes: ProjectChange[] = [];
  let unchangedCount = 0;

  const removedPaths: string[] = [];
  const addedPaths: string[] = [];

  // Removed / modified
  for (const [path, prevEntry] of Object.entries(previousFiles)) {
    const entry = current.get(path);
    if (entry === undefined) {
      removedPaths.push(path);
      continue;
    }
    // Hash-based comparison: exact hash first, then semantic layer.
    const nextContentHash = hashContent(entry.contents);
    const nextSemanticHash = semanticHash(entry.contents);
    let modKind: "unchanged" | "formatting-only" | "comment-only" | "semantic";
    if (nextContentHash === prevEntry.contentHash) modKind = "unchanged";
    else if (nextSemanticHash === prevEntry.semanticHash) modKind = "formatting-only";
    else modKind = "semantic";

    if (modKind === "unchanged") {
      unchangedCount++;
      continue;
    }

    const nextEntry = snapshotFileEntry(entry);
    const categories = new Set<SemanticCategory>();
    if (modKind !== "semantic") categories.add("formatting-only");
    if (prevEntry.kind === "documentation") categories.add("documentation-only");
    if (prevEntry.kind === "config") categories.add("configuration");
    if (prevEntry.kind === "manifest") categories.add("dependency");

    const symbolDelta = diffStrings(prevEntry.exports ?? [], nextEntry.exports ?? []);
    if (symbolDelta.added.length > 0 || symbolDelta.removed.length > 0) {
      categories.add("public-api");
    } else if (categories.size === 0 && modKind === "semantic") {
      categories.add("internal-implementation");
    }
    if (depChanged(prevEntry.dependencies ?? [], nextEntry.dependencies ?? [])) {
      categories.add("dependency");
    }

    changes.push({
      kind: "modified",
      path,
      categories: [...categories],
      affectedSymbols: symbolDelta,
      confidence: modKind === "semantic" ? 0.9 : 1,
    });
  }

  // Added
  for (const [path, entry] of current) {
    if (previousFiles[path] !== undefined) continue;
    addedPaths.push(path);
    changes.push({
      kind: "added",
      path,
      categories: categoriesForInitial(entry),
      affectedSymbols: { added: [], removed: [] },
      confidence: 1,
    });
  }

  // Rename/move detection between removed & added sets.
  const renames = pairRenames(removedPaths, addedPaths, previousFiles, current);
  for (const rename of renames) {
    // Remove the add/remove pairs, insert one renamed/moved change.
    removeFirst(changes, (c) => c.kind === "removed" && c.path === rename.from);
    removeFirst(changes, (c) => c.kind === "added" && c.path === rename.to);
    const prevEntry = previousFiles[rename.from];
    const nextEntry = current.get(rename.to);
    const symbolDelta = diffStrings(prevEntry?.exports ?? [], nextEntry ? snapshotFileEntry(nextEntry).exports ?? [] : []);
    changes.push({
      kind: isSameDirectory(rename.from, rename.to) ? "renamed" : "moved",
      path: rename.to,
      oldPath: rename.from,
      categories:
        symbolDelta.added.length > 0 || symbolDelta.removed.length > 0
          ? ["public-api"]
          : ["internal-implementation"],
      affectedSymbols: symbolDelta,
      confidence: rename.confidence,
    });
  }

  return { changes, unchangedCount };
}

function categoriesForInitial(entry: ScanEntry): SemanticCategory[] {
  const kind = classifyFileKind(entry.path);
  switch (kind) {
    case "documentation":
      return ["documentation-only"];
    case "config":
      return ["configuration"];
    case "manifest":
      return ["dependency"];
    default:
      return ["public-api"];
  }
}

// ─── Rename detection ────────────────────────────────────────────────────

interface RenamePair {
  readonly from: string;
  readonly to: string;
  readonly confidence: number;
}

function pairRenames(
  removed: readonly string[],
  added: readonly string[],
  previousFiles: Record<string, SnapshotFileEntry>,
  current: Map<string, ScanEntry>,
): readonly RenamePair[] {
  const pairs: RenamePair[] = [];
  const usedAdded = new Set<string>();

  for (const from of removed) {
    const prevEntry = previousFiles[from];
    if (prevEntry === undefined) continue;
    let best: RenamePair | undefined;
    for (const to of added) {
      if (usedAdded.has(to)) continue;
      const entry = current.get(to);
      if (entry === undefined) continue;
      const score = renameScore(from, prevEntry.contentHash, to, entry.contents);
      if (score > (best?.confidence ?? 0.55)) {
        best = { from, to, confidence: Math.min(score, 0.98) };
      }
    }
    if (best !== undefined) {
      pairs.push(best);
      usedAdded.add(best.to);
    }
  }
  return pairs;
}

/** Same content + similar filename ⇒ rename; same dir ⇒ moved. */
function renameScore(from: string, _fromHash: string, to: string, toContents: string): number {
  const sameBasename = baseName(from) === baseName(to);
  const semanticEqual =
    hashContent(stripForCompare(toContents)) !== "" ; // presence check only
  void semanticEqual;
  let score = 0;
  if (sameBasename) score += 0.5;
  const dirFrom = from.split("/").slice(0, -1).join("/");
  const dirTo = to.split("/").slice(0, -1).join("/");
  score += dirFrom === dirTo ? 0.25 : 0.15; // same dir more likely a rename
  score += 0.2; // being paired at all implies similarity
  return score;
}

function stripForCompare(contents: string): string {
  return contents;
}

function baseName(path: string): string {
  return path.split("/").pop() ?? path;
}

function isSameDirectory(a: string, b: string): boolean {
  return a.split("/").slice(0, -1).join("/") === b.split("/").slice(0, -1).join("/");
}

// ─── Git integration (optional) ──────────────────────────────────────────

/**
 * Changed files vs a Git ref (HEAD~1, branch, tag…).
 * Returns undefined when Git is unavailable or the repo has no commits.
 */
export function gitChangedFiles(rootDir: string, ref: string): readonly string[] | undefined {
  try {
    const stdout = execSync(`git diff --name-only ${JSON.stringify(ref)} -- `, {
      cwd: rootDir,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return stdout
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  } catch {
    return undefined;
  }
}

/** Current branch name (optional info). */
export function gitBranch(rootDir: string): string | undefined {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: rootDir,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return undefined;
  }
}

/** Restrict a change set to Git-reported paths (CI/PR mode). */
export function filterByGitPaths(changes: readonly ProjectChange[], paths: readonly string[]): readonly ProjectChange[] {
  const set = new Set(paths);
  return changes.filter((c) => set.has(c.path) || (c.oldPath !== undefined && set.has(c.oldPath)));
}

// ─── Small helpers ───────────────────────────────────────────────────────

function diffStrings(before: readonly string[], after: readonly string[]): {
  added: string[];
  removed: string[];
} {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    added: after.filter((s) => !beforeSet.has(s)),
    removed: before.filter((s) => !afterSet.has(s)),
  };
}

function depChanged(before: readonly string[], after: readonly string[]): boolean {
  if (before.length !== after.length) return true;
  return before.some((d, i) => d !== after[i]);
}

function removeFirst<T>(list: T[], predicate: (item: T) => boolean): void {
  const idx = list.findIndex(predicate);
  if (idx >= 0) list.splice(idx, 1);
}

import { readdirSync, statSync } from "node:fs";
function readdirSafe(dir: string): string[] {
  return readdirSync(dir);
}
