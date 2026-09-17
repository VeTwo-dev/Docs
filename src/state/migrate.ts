import type { SafeFileSystem } from "../init/filesystem/interface.js";
import { posixJoin } from "../init/filesystem/interface.js";
import {
  getDocsStateRoot,
  LEGACY_OWNED_CACHE_DIRS,
  LEGACY_UNOWNED_CACHE_DIRS,
  MIGRATION_MARKER,
  resolveDocsNamespacePath,
} from "./paths.js";

/** Version of the legacy-state migration plan. Bump when new mappings are added. */
export const MIGRATION_VERSION = 2 as const;

/** A legacy state location discovered in the project root. */
export interface LegacyStateLocation {
  /** Absolute path to the legacy directory. */
  readonly path: string;
  /** Path relative to the project root (e.g. `.docs-cache`). */
  readonly relativePath: string;
  /** Whether the location is provably owned by `@vetwo/docs`. */
  readonly owned: boolean;
  /** Files inside the location, relative to the location root. */
  readonly files: readonly string[];
}

/** A single migration move: a known legacy file to its new state-root path. */
export interface MigrationStep {
  /** Absolute legacy file path. */
  readonly from: string;
  /** Absolute destination file path under `.vetwo/docs/`. */
  readonly to: string;
}

/** The complete migration plan for a project. */
export interface MigrationPlan {
  readonly legacy: readonly LegacyStateLocation[];
  /** Legacy `.docs-cache` files to migrate into their namespace. */
  readonly steps: readonly MigrationStep[];
  /** Moves from the v1 `cache/` layout into the flat namespace layout. */
  readonly relocations: readonly MigrationStep[];
  readonly migrationVersion: number;
  /** Legacy files recognised but deliberately skipped (not owned by us). */
  readonly skipped: readonly string[];
}

/** The outcome of applying a migration. */
export interface MigrationResult {
  /** Whether any migration work was performed. */
  readonly applied: boolean;
  readonly migrationVersion: number;
  /** The moves that were performed (source → destination). */
  readonly moved: readonly MigrationStep[];
  /** The layout relocations that were performed (source → destination). */
  readonly relocated: readonly MigrationStep[];
  /** Legacy directories removed after a successful, verified migration. */
  readonly removedLegacy: readonly string[];
  /** Legacy files skipped because they are not provably owned. */
  readonly skipped: readonly string[];
}

/** Thrown when a migration cannot complete; the source state is left intact. */
export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MigrationError";
  }
}

/** SHA-256 cache entry files written by the compiler cache store. */
const HASH_ENTRY = /^[a-f0-9]{16}\.json$/;

/** Legacy `.docs-cache` file → destination namespace (flat namespace layout). */
const LEGACY_CACHE_TO_NAMESPACE: Readonly<Record<string, string>> = {
  "manifest.json": "compiler",
  "generator-manifest.json": "generator",
  "scanner-cache.json": "scanner",
};

/** v1 `cache/<sub>` layout → flat namespace. */
const V1_CACHE_TO_NAMESPACE: Readonly<Record<string, string>> = {
  general: "compiler",
  scanner: "scanner",
  generator: "generator",
};

/**
 * Discover legacy state locations. Owned locations (`.docs-cache/`) are
 * candidates for migration; unowned ones are only reported, never touched.
 */
export function detectLegacyState(
  fs: SafeFileSystem,
  rootDir: string,
): readonly LegacyStateLocation[] {
  const locations: LegacyStateLocation[] = [];
  for (const rel of LEGACY_OWNED_CACHE_DIRS) {
    const path = posixJoin(rootDir, rel);
    if (fs.isDirectory(path)) {
      locations.push({
        path,
        relativePath: rel,
        owned: true,
        files: fs.listFiles(path),
      });
    }
  }
  for (const rel of LEGACY_UNOWNED_CACHE_DIRS) {
    const path = posixJoin(rootDir, rel);
    if (fs.isDirectory(path)) {
      locations.push({
        path,
        relativePath: rel,
        owned: false,
        files: fs.listFiles(path),
      });
    }
  }
  return locations;
}

/**
 * Detect the v1 `cache/<sub>` layout produced before the flat namespace
 * model. Returns one relocation per known file, mapping into its namespace.
 */
export function detectV1Layout(fs: SafeFileSystem, rootDir: string): readonly MigrationStep[] {
  const cacheRoot = posixJoin(getDocsStateRoot(rootDir), "cache");
  if (!fs.isDirectory(cacheRoot)) return [];
  const relocations: MigrationStep[] = [];
  for (const sub of fs.listDir(cacheRoot)) {
    const namespace = V1_CACHE_TO_NAMESPACE[sub];
    if (namespace === undefined) continue;
    const subDir = posixJoin(cacheRoot, sub);
    if (!fs.isDirectory(subDir)) continue;
    for (const file of fs.listFiles(subDir)) {
      relocations.push({
        from: posixJoin(subDir, file),
        to: resolveDocsNamespacePath(rootDir, namespace, file),
      });
    }
  }
  return relocations.sort((a, b) => a.from.localeCompare(b.from));
}

/**
 * Build the migration plan for a project. Every step is a known, owned file
 * being copied from a legacy location to its canonical state-root path.
 */
export function planMigration(fs: SafeFileSystem, rootDir: string): MigrationPlan {
  const legacy = detectLegacyState(fs, rootDir);
  const steps: MigrationStep[] = [];
  const skipped: string[] = [];

  for (const location of legacy) {
    if (!location.owned) {
      skipped.push(location.path);
      continue;
    }
    for (const file of location.files) {
      const from = posixJoin(location.path, file);
      const namespace = LEGACY_CACHE_TO_NAMESPACE[file];
      if (namespace !== undefined) {
        steps.push({ from, to: resolveDocsNamespacePath(rootDir, namespace, file) });
        continue;
      }
      if (HASH_ENTRY.test(file)) {
        steps.push({ from, to: resolveDocsNamespacePath(rootDir, "compiler", file) });
        continue;
      }
      skipped.push(from);
    }
  }

  return {
    legacy,
    steps,
    relocations: detectV1Layout(fs, rootDir),
    skipped,
    migrationVersion: MIGRATION_VERSION,
  };
}

/** Whether a migration is pending (owned legacy state or an interrupted marker). */
export function needsMigration(fs: SafeFileSystem, rootDir: string): boolean {
  const marker = posixJoin(getDocsStateRoot(rootDir), MIGRATION_MARKER);
  if (fs.isFile(marker)) return true;
  if (detectLegacyState(fs, rootDir).some((l) => l.owned)) return true;
  return detectV1Layout(fs, rootDir).length > 0;
}

/**
 * Apply the migration plan safely and idempotently.
 *
 * Strategy: copy known files into the state root, verify every copy byte for
 * byte, and only then remove the legacy directories. A marker file is written
 * first so an interrupted run can be detected and resumed safely — the source
 * state is never deleted until every destination is verified.
 */
export function applyMigration(fs: SafeFileSystem, rootDir: string): MigrationResult {
  const plan = planMigration(fs, rootDir);
  const marker = posixJoin(getDocsStateRoot(rootDir), MIGRATION_MARKER);
  const hasOwnedLegacy = plan.legacy.some((l) => l.owned);

  if (!hasOwnedLegacy && !fs.isFile(marker) && plan.relocations.length === 0) {
    return {
      applied: false,
      migrationVersion: plan.migrationVersion,
      moved: [],
      relocated: [],
      removedLegacy: [],
      skipped: plan.skipped,
    };
  }

  fs.writeFile(marker, String(plan.migrationVersion));

  const moved: MigrationStep[] = [];
  const relocated: MigrationStep[] = [];
  try {
    for (const step of plan.steps) {
      if (!fs.isFile(step.from)) continue;
      const source = fs.readFile(step.from);
      if (fs.isFile(step.to) && fs.readFile(step.to) === source) {
        moved.push(step);
        continue;
      }
      fs.writeFile(step.to, source);
      moved.push(step);
    }
    for (const step of plan.relocations) {
      if (!fs.isFile(step.from)) continue;
      const source = fs.readFile(step.from);
      if (fs.isFile(step.to) && fs.readFile(step.to) === source) {
        relocated.push(step);
        continue;
      }
      fs.writeFile(step.to, source);
      relocated.push(step);
    }

    for (const step of [...plan.steps, ...plan.relocations]) {
      if (!fs.isFile(step.from)) continue;
      if (fs.readFile(step.to) !== fs.readFile(step.from)) {
        throw new MigrationError(
          `Migration verification failed for ${step.to}; source left intact`,
        );
      }
    }

    // Relocated v1 sources are byte-verified duplicates now; drop them so the
    // old `cache/` container can be removed.
    for (const step of plan.relocations) {
      if (fs.isFile(step.from)) fs.remove(step.from);
    }
  } catch (error) {
    if (error instanceof MigrationError) throw error;
    throw new MigrationError(
      `Migration failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const removedLegacy: string[] = [];
  for (const location of plan.legacy) {
    if (location.owned && fs.isDirectory(location.path)) {
      fs.remove(location.path);
      removedLegacy.push(location.path);
    }
  }

  // Remove the v1 `cache/` container once it is empty (verified files moved).
  const cacheRoot = posixJoin(getDocsStateRoot(rootDir), "cache");
  if (fs.isDirectory(cacheRoot) && fs.listFiles(cacheRoot).length === 0) {
    fs.remove(cacheRoot);
    removedLegacy.push(cacheRoot);
  }

  fs.remove(marker);

  return {
    applied: true,
    migrationVersion: plan.migrationVersion,
    moved,
    relocated,
    removedLegacy,
    skipped: plan.skipped,
  };
}
