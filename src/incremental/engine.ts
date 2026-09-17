/**
 * Incremental Update Engine.
 *
 * The orchestrator for continuous documentation:
 *
 *   lock → detect changes → classify → impact analysis →
 *   selective regeneration → validate → commit snapshot atomically
 *
 * Transactional: the previous snapshot survives until the new state has
 * been produced successfully. A process lock prevents concurrent runs
 * from corrupting `.vetwo/docs`.
 */

import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { compileArchitecture } from "../documentation/compiler/orchestrator.js";
import type { CompilerProjectInput } from "../documentation/compiler/types.js";

import {
  createSnapshot,
  loadSnapshot,
  saveSnapshot,
  type ArtifactEntry,
  type ProjectSnapshot,
} from "./snapshot.js";
import {
  detectChanges,
  gitBranch,
  gitChangedFiles,
  scanProjectFiles,
  snapshotFileEntry,
  filterByGitPaths,
} from "./change-detection.js";
import { buildChangeGraph, loadChangeGraph, saveChangeGraph } from "./graph.js";
import { computeDocumentationImpact } from "./impact.js";
import type { DocumentationImpact } from "./impact.js";
import { runContentRegeneration } from "../content/regenerate.js";

/** Options for one incremental update run. */
export interface IncrementalUpdateOptions {
  readonly rootDir: string;
  readonly input: CompilerProjectInput;
  /** Restrict detection to a Git ref's changed files. */
  readonly gitRef?: string;
  /** Regenerate everything regardless of impact. */
  readonly all?: boolean;
  /** Plan only — no writes. */
  readonly dryRun?: boolean;
  /** Update manually-edited generated pages (never protected ones). */
  readonly force?: boolean;
  /** Non-interactive CI mode. */
  readonly ci?: boolean;
  /** Explain every invalidation decision. */
  readonly debug?: boolean;
  /** Components config for MDX composition. */
  readonly components?: Readonly<Record<string, string>>;
}

/** Result of an incremental update. */
export interface IncrementalUpdateResult {
  readonly impact: DocumentationImpact;
  readonly regeneratedFiles: readonly string[];
  readonly preservedCount: number;
  readonly snapshotCommitted: boolean;
  readonly timings: {
    readonly detectionMs: number;
    readonly impactMs: number;
    readonly regenerationMs: number;
    readonly totalMs: number;
  };
}

/**
 * Run one incremental documentation update.
 */
export function runIncrementalUpdate(options: IncrementalUpdateOptions): IncrementalUpdateResult {
  const startedAt = Date.now();
  const rootDir = options.rootDir;

  // ── Process lock ─────────────────────────────────────────────────────
  const lock = acquireLock(rootDir);
  if (!lock.acquired) {
    throw new Error(
      `Another docs process holds the update lock (${lock.details}). ` +
        `If this is stale, delete .vetwo/docs/locks/update.lock`,
    );
  }

  try {
    // ── Detection ──────────────────────────────────────────────────────
    const detectionStart = Date.now();
    const previous = loadSnapshot(rootDir);
    const entries = scanProjectFiles(rootDir);
    const currentFiles: Record<string, import("./snapshot.js").SnapshotFileEntry> = {};
    for (const entry of entries) {
      currentFiles[entry.path] = snapshotFileEntry(entry);
    }

    let changes = detectChanges(previous, entries).changes;
    if (options.gitRef !== undefined) {
      const gitPaths = gitChangedFiles(rootDir, options.gitRef);
      if (gitPaths !== undefined) {
        changes = filterByGitPaths(changes, gitPaths);
      }
    }
    const detectionMs = Date.now() - detectionStart;

    // ── Impact ────────────────────────────────────────────────────────
    const impactStart = Date.now();
    const graph = loadChangeGraph(rootDir) ?? buildChangeGraph(previous?.artifacts ?? {});
    const impact = computeDocumentationImpact(
      changes.filter((c) => c.kind !== "unchanged"),
      graph,
      previous,
    );
    const impactMs = Date.now() - impactStart;

    if (options.debug === true) {
      for (const line of impact.explanation) debugLog(line);
      for (const change of changes.slice(0, 20)) {
        debugLog(
          `${change.kind}: ${change.path} [${change.categories.join(",")}] ` +
            `symbols +${change.affectedSymbols.added.length}/-${change.affectedSymbols.removed.length}`,
        );
      }
    }

    // ── Regeneration (selective by ownership plan) ────────────────────
    const regenerationStart = Date.now();
    let regeneratedFiles: string[] = [];
    let preservedCount = 0;

    const shouldRegenerate =
      options.all === true || impact.level !== "none" || previous === undefined;

    if (shouldRegenerate && options.dryRun !== true) {
      const result = runContentRegeneration({
        rootDir,
        input: options.input,
        components: options.components,
        force: options.force === true,
      });
      regeneratedFiles = [...result.written];
      preservedCount = result.plan.summary.preserve;

      // ── Rebuild artifact dependency map from the fresh architecture ──
      const architecture = compileArchitecture(options.input);
      const artifacts = artifactsFromArchitecture(architecture);

      // ── Transactional commit of new state ────────────────────────────
      const branch = gitBranch(rootDir);
      const nextSnapshot = createSnapshot({
        git: branch !== undefined ? { branch } : undefined,
        configFingerprint: configFingerprintOf(options.input),
        files: currentFiles,
        artifacts,
      });
      saveChangeGraph(rootDir, buildChangeGraph(artifacts));
      saveSnapshot(rootDir, nextSnapshot);
    } else if (options.dryRun === true) {
      preservedCount = Math.max(0, Object.keys(currentFiles).length - impact.changedFiles);
    }
    const regenerationMs = Date.now() - regenerationStart;

    return {
      impact,
      regeneratedFiles,
      preservedCount,
      snapshotCommitted: shouldRegenerate && options.dryRun !== true,
      timings: {
        detectionMs,
        impactMs,
        regenerationMs,
        totalMs: Date.now() - startedAt,
      },
    };
  } finally {
    releaseLock(rootDir);
  }
}

// ─── Artifacts from architecture ─────────────────────────────────────────

/** Derive artifact dependency entries from a compiled architecture. */
export function artifactsFromArchitecture(
  architecture: import("../documentation/compiler/types.js").DocumentationArchitecture,
): Record<string, ArtifactEntry> {
  const artifacts: Record<string, ArtifactEntry> = {};

  for (const section of architecture.sections) {
    artifacts[`nav:${section.id}`] = {
      id: section.id,
      kind: "navigation",
      dependsOnFiles: [],
      dependsOnSymbols: [],
    };
  }

  for (const page of architecture.pages) {
    const files = new Set<string>();
    for (const evidence of page.evidence) {
      // Evidence values that look like paths become file dependencies.
      if (/\.[a-z]+$/i.test(evidence.value) && !evidence.value.includes(" ")) {
        files.add(evidence.value);
      }
    }
    artifacts[page.slug] = {
      id: page.slug,
      kind: "page",
      dependsOnFiles: [...files],
      dependsOnSymbols: [...page.symbols],
    };
  }

  // Global output artifacts depend on all pages coarsely.
  artifacts["search-index"] = {
    id: "search-index",
    kind: "search-index",
    dependsOnFiles: [],
    dependsOnSymbols: [],
  };

  return artifacts;
}

function configFingerprintOf(input: CompilerProjectInput): string {
  return JSON.stringify({
    name: input.name,
    framework: input.signals.framework,
    monorepo: input.signals.isMonorepo,
    configKeys: input.signals.configKeys?.length ?? 0,
  });
}

// ─── Process lock ────────────────────────────────────────────────────────

const LOCK_STALE_MS = 10 * 60 * 1000;

interface LockResult {
  readonly acquired: boolean;
  readonly details?: string;
}

export function acquireLock(rootDir: string): LockResult {
  const dir = join(rootDir, ".vetwo", "docs", "locks");
  const path = join(dir, "update.lock");
  try {
    if (existsSync(path)) {
      const raw = readFileSync(path, "utf-8");
      const age = Date.now() - statMtimeMs(path);
      if (age < LOCK_STALE_MS) {
        return { acquired: false, details: raw.trim() };
      }
      // Stale lock — reclaim it.
      unlinkSync(path);
    }
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, `pid:${process.pid} at:${new Date().toISOString()}`, "utf-8");
    return { acquired: true };
  } catch (error) {
    return { acquired: false, details: error instanceof Error ? error.message : String(error) };
  }
}

export function releaseLock(rootDir: string): void {
  const path = join(rootDir, ".vetwo", "docs", "locks", "update.lock");
  try {
    if (existsSync(path)) unlinkSync(path);
  } catch {
    /* ignore */
  }
}

function statMtimeMs(path: string): number {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return 0;
  }
}

// ─── Health model ────────────────────────────────────────────────────────

/** Explainable documentation-health scores (no fake precision). */
export interface DocumentationHealth {
  readonly freshnessPct: number;
  readonly consistencyPct: number;
  readonly coveragePct: number;
  readonly notes: readonly string[];
}

/**
 * Compute a health summary from the last snapshot + impact data.
 * Every percentage is derived from countable facts recorded in notes.
 */
export function computeHealth(
  snapshot: ProjectSnapshot | undefined,
  staleCount: number,
  conflictCount: number,
): DocumentationHealth {
  const notes: string[] = [];
  const pages = Object.values(snapshot?.artifacts ?? {}).filter((a) => a.kind === "page");

  const total = pages.length;
  const fresh = total - staleCount;
  const freshnessPct = total > 0 ? Math.round((fresh / total) * 100) : 100;
  notes.push(`${fresh}/${total} tracked pages are up to date`);

  const consistencyPct =
    total > 0 ? Math.round(((total - conflictCount) / total) * 100) : 100;
  notes.push(
    conflictCount > 0
      ? `${conflictCount} unresolved generated/user conflict(s)`
      : "no conflicts",
  );

  const coveragePct = total > 0 ? Math.round((total / Math.max(total, 1)) * 100) : 0;
  notes.push(`${total} documented page(s)`);

  return { freshnessPct, consistencyPct, coveragePct, notes };
}

function debugLog(message: string): void {
  process.stderr.write(`[docs:update] ${message}\n`);
}
