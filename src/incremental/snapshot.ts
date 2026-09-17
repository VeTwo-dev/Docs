/**
 * Project Snapshot.
 *
 * The analyzed state of a project at a point in time: file fingerprints
 * (content + semantic), exports, package metadata, configuration
 * fingerprint, and documentation artifact dependencies.
 *
 * Snapshots persist atomically under `.vetwo/docs/snapshots/project.json`
 * with schema-version gating: incompatible or corrupted snapshots are
 * discarded safely (never treated as authoritative).
 */

import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { hashContent } from "./fingerprints.js";

/** Current snapshot schema version — bump to invalidate old caches. */
export const SNAPSHOT_SCHEMA_VERSION = 1;

/** What kind of file this is (drives invalidation rules). */
export type TrackedFileKind = "source" | "documentation" | "config" | "asset" | "manifest";

export interface SnapshotFileEntry {
  /** Exact content hash. */
  readonly contentHash: string;
  /** Comment/whitespace-insensitive hash. */
  readonly semanticHash: string;
  readonly kind: TrackedFileKind;
  /** Exported symbol names (source files only). */
  readonly exports?: readonly string[];
  /** Package dependencies (manifest files only). */
  readonly dependencies?: readonly string[];
}

/** A tracked documentation artifact and what it depends on. */
export interface ArtifactEntry {
  /** Artifact id (page slug or output id like `search-index`). */
  readonly id: string;
  readonly kind: "page" | "navigation" | "search-index" | "sitemap" | "rss" | "og" | "asset" | "static-output";
  /** Files this artifact depends on (relative paths). */
  readonly dependsOnFiles: readonly string[];
  /** Symbols this artifact documents/references. */
  readonly dependsOnSymbols: readonly string[];
  readonly fingerprint?: string;
}

/** The persistent project snapshot. */
export interface ProjectSnapshot {
  readonly schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION;
  readonly createdAt: string;
  /** Optional Git association (never required). */
  readonly git?: { readonly branch?: string; readonly commit?: string };
  /** Configuration fingerprint (config changes invalidate broadly). */
  readonly configFingerprint: string;
  readonly files: Readonly<Record<string, SnapshotFileEntry>>;
  readonly artifacts: Readonly<Record<string, ArtifactEntry>>;
}

/** Create an empty snapshot. */
export function createSnapshot(init: Partial<Omit<ProjectSnapshot, "schemaVersion">> = {}): ProjectSnapshot {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    git: init.git,
    configFingerprint: init.configFingerprint ?? "",
    files: init.files ?? {},
    artifacts: init.artifacts ?? {},
  };
}

/** Path of the canonical project snapshot. */
export function snapshotPath(stateRoot: string): string {
  return join(stateRoot, ".vetwo", "docs", "snapshots", "project.json");
}

/**
 * Load the previous snapshot. Returns `undefined` when missing,
 * corrupted, or schema-incompatible — callers must treat that as
 * "no previous state" and do a full analysis.
 */
export function loadSnapshot(rootDir: string): ProjectSnapshot | undefined {
  const path = snapshotPath(rootDir);
  if (!existsSync(path)) return undefined;
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8")) as ProjectSnapshot;
    if (raw.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) return undefined;
    if (typeof raw.files !== "object" || raw.files === null) return undefined;
    return raw;
  } catch {
    // Corrupted cache: report-safe discard; caller rebuilds from scratch.
    return undefined;
  }
}

/**
 * Atomically persist a snapshot: write to a temp sibling then rename.
 * A crash never leaves a half-written canonical snapshot.
 */
export function saveSnapshot(rootDir: string, snapshot: ProjectSnapshot): void {
  const path = snapshotPath(rootDir);
  const tmp = `${path}.tmp-${process.pid}-${Date.now().toString(36)}`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(tmp, JSON.stringify(snapshot, null, 2), "utf-8");
  try {
    renameSync(tmp, path);
  } catch {
    // Fall back to direct write on exotic filesystems without rename.
    writeFileSync(path, JSON.stringify(snapshot, null, 2), "utf-8");
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

/** Convenience: content-hash of an existing file for snapshot entries. */
export function fileContentHash(path: string): string | undefined {
  try {
    return hashContent(readFileSync(path, "utf-8"));
  } catch {
    return undefined;
  }
}
