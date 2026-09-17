import type { SafeFileSystem } from "../init/filesystem/interface.js";
import { posixJoin } from "../init/filesystem/interface.js";
import { getDocsStateRoot, MIGRATION_MARKER, STATE_MANIFEST_FILE } from "./paths.js";
import { readStateManifest, STATE_SCHEMA_VERSION } from "./manifest.js";
import { detectLegacyState } from "./migrate.js";
import { DEFAULT_REGISTRY, type StateNamespaceRegistry } from "./registry.js";

/** A single doctor check result. */
export interface StateCheck {
  readonly id: string;
  readonly label: string;
  readonly pass: boolean;
  readonly detail: string;
}

/** Full doctor report for the state root. */
export interface StateDoctorReport {
  /** Absolute path to the state root. */
  readonly stateRoot: string;
  readonly checks: readonly StateCheck[];
  readonly passed: number;
  readonly failed: number;
}

/** Bytes of all files under a directory. */
export function stateSize(fs: SafeFileSystem, root: string): number {
  let total = 0;
  for (const file of fs.listFiles(root)) {
    const path = posixJoin(root, file);
    if (fs.isFile(path)) {
      try {
        total += fs.readFile(path).length;
      } catch {
        // unreadable file: ignore for sizing purposes
      }
    }
  }
  return total;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

/**
 * Namespace ids present on disk under the state root.
 *
 * Flat subsystems map 1:1; plugins and AI providers are discovered from their
 * containers (`.vetwo/docs/plugins/<id>/`, `.vetwo/docs/ai/providers/<id>/`).
 */
export function listStateNamespaceIds(fs: SafeFileSystem, stateRoot: string): readonly string[] {
  const ids: string[] = [];
  for (const name of fs.listDir(stateRoot)) {
    if (name === STATE_MANIFEST_FILE || name === MIGRATION_MARKER) continue;
    if (name === "plugins") {
      const pluginsDir = posixJoin(stateRoot, "plugins");
      if (fs.isDirectory(pluginsDir)) {
        for (const plugin of fs.listDir(pluginsDir)) {
          ids.push(`plugin:${plugin}`);
        }
      }
      continue;
    }
    if (name === "ai") {
      ids.push("ai");
      const providersDir = posixJoin(stateRoot, "ai", "providers");
      if (fs.isDirectory(providersDir)) {
        for (const provider of fs.listDir(providersDir)) {
          ids.push(`ai:${provider}`);
        }
      }
      continue;
    }
    ids.push(name);
  }
  return ids.sort();
}

/**
 * Run diagnostics against the `.vetwo/docs/` state root.
 *
 * Reports state presence and validity, schema compatibility, pending
 * migrations, corrupted manifests, disk usage, unknown directories, orphaned
 * namespaces and manifests that are inconsistent with what is on disk.
 * Unknown and orphaned state is *reported* but never deleted.
 */
export function runStateDoctor(
  fs: SafeFileSystem,
  rootDir: string,
  registry: StateNamespaceRegistry = DEFAULT_REGISTRY,
): StateDoctorReport {
  const stateRoot = getDocsStateRoot(rootDir);
  const checks: StateCheck[] = [];

  const stateRootExists = fs.isDirectory(stateRoot);
  checks.push({
    id: "state-root",
    label: "State root (.vetwo/docs)",
    pass: stateRootExists,
    detail: stateRootExists ? "Present" : "Missing - run `docs init`",
  });

  const manifest = readStateManifest(fs, rootDir);
  const manifestPath = posixJoin(stateRoot, STATE_MANIFEST_FILE);
  const manifestFileExists = fs.isFile(manifestPath);
  checks.push({
    id: "state-manifest",
    label: "state.json",
    pass: manifestFileExists && manifest !== undefined,
    detail: !manifestFileExists
      ? "Missing"
      : manifest !== undefined
        ? `Valid (schema v${manifest.schemaVersion})`
        : "Corrupted or invalid",
  });

  if (manifest !== undefined) {
    checks.push({
      id: "schema-version",
      label: "State schema version",
      pass: manifest.schemaVersion <= STATE_SCHEMA_VERSION,
      detail:
        manifest.schemaVersion > STATE_SCHEMA_VERSION
          ? `v${manifest.schemaVersion} is newer than supported v${STATE_SCHEMA_VERSION}`
          : `v${manifest.schemaVersion} supported`,
    });
  } else {
    checks.push({
      id: "schema-version",
      label: "State schema version",
      pass: true,
      detail: "n/a (no state manifest)",
    });
  }

  const legacy = detectLegacyState(fs, rootDir);
  const marker = posixJoin(stateRoot, MIGRATION_MARKER);
  const migrationPending = legacy.some((l) => l.owned) || fs.isFile(marker);
  checks.push({
    id: "migration",
    label: "Legacy state migration",
    pass: !migrationPending,
    detail: migrationPending
      ? "Legacy state found - run `docs init` or `docs doctor` to migrate"
      : "Up to date",
  });

  const workspaceManifest = posixJoin(stateRoot, "manifests", "workspace.json");
  let workspaceManifestOk = true;
  if (fs.isFile(workspaceManifest)) {
    try {
      const parsed = JSON.parse(fs.readFile(workspaceManifest)) as { schemaVersion?: unknown };
      workspaceManifestOk = typeof parsed.schemaVersion === "number";
    } catch {
      workspaceManifestOk = false;
    }
  }
  checks.push({
    id: "workspace-manifest",
    label: "Workspace manifest",
    pass: workspaceManifestOk,
    detail: workspaceManifestOk
      ? fs.isFile(workspaceManifest)
        ? "Valid"
        : "Absent (not initialized)"
      : "Corrupted or invalid",
  });

  const diskIds = stateRootExists ? listStateNamespaceIds(fs, stateRoot) : [];

  const unknown = diskIds.filter((id) => !registry.isRegistered(id));
  checks.push({
    id: "unknown-state",
    label: "Unknown state directories",
    pass: unknown.length === 0,
    detail: unknown.length === 0 ? "None" : `Preserved, unmanaged: ${unknown.join(", ")}`,
  });

  const orphaned: string[] = [];
  if (manifest !== undefined) {
    for (const id of Object.keys(manifest.namespaces)) {
      if (!registry.isRegistered(id)) orphaned.push(id);
    }
  }
  checks.push({
    id: "orphaned-namespaces",
    label: "Orphaned namespaces",
    pass: orphaned.length === 0,
    detail: orphaned.length === 0 ? "None" : `No longer installed: ${orphaned.join(", ")}`,
  });

  const untracked = diskIds.filter(
    (id) => registry.isRegistered(id) && (manifest === undefined || !(id in manifest.namespaces)),
  );
  checks.push({
    id: "consistent-manifest",
    label: "Manifest consistency",
    pass: untracked.length === 0,
    detail: untracked.length === 0 ? "In sync" : `Untracked: ${untracked.join(", ")}`,
  });

  const size = stateSize(fs, stateRoot);
  checks.push({
    id: "disk-usage",
    label: "State disk usage",
    pass: true,
    detail: stateRootExists ? formatBytes(size) : "0 B",
  });

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;
  return { stateRoot, checks, passed, failed };
}
