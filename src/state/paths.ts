import { posixJoin } from "../init/filesystem/interface.js";
import { namespaceSegments } from "./registry.js";

/**
 * Internal directory owned by the package at the project root.
 *
 * Everything `@vetwo/docs` writes into the user's project lives below this
 * directory. The user-facing output (`docs/`, `wiki/`) and the AI authoring
 * workspace (`agent/`) are deliberately kept outside it.
 */
export const VETWO_DIR = ".vetwo" as const;

/**
 * The canonical engine-state root: `<project>/.vetwo/docs/`.
 *
 * All runtime state (caches, indexes, analysis, generated-internal files,
 * diagnostics, reports, temporary files and manifests) is centralized here so
 * a project root never accumulates scattered tooling directories.
 */
export const DOCS_STATE_DIR = "docs" as const;

/** Name of the root state manifest file. */
export const STATE_MANIFEST_FILE = "state.json" as const;

/** Marker file written while a legacy-state migration is in progress. */
export const MIGRATION_MARKER = ".migrating" as const;

/**
 * Legacy cache directories this package has historically written at the
 * project root. These are provably owned by `@vetwo/docs` and are candidates
 * for automatic migration into the state root.
 */
export const LEGACY_OWNED_CACHE_DIRS = [".docs-cache"] as const;

/**
 * Additional legacy locations that may exist in user projects but cannot be
 * proved to be ours. They are reported by the migration/doctor tooling but
 * never touched automatically.
 */
export const LEGACY_UNOWNED_CACHE_DIRS = [
  "docs/.cache",
  "docs/cache",
  "wiki/.cache",
  "wiki/cache",
] as const;

/** Absolute path to the `.vetwo` directory for a project root. */
export function getVetwoRoot(rootDir: string): string {
  return posixJoin(rootDir, VETWO_DIR);
}

/** Absolute path to the canonical state root (`<project>/.vetwo/docs/`). */
export function getDocsStateRoot(rootDir: string): string {
  return posixJoin(rootDir, VETWO_DIR, DOCS_STATE_DIR);
}

/**
 * Resolve a path inside the canonical state root. Any number of path
 * segments can be supplied; `resolveDocsStatePath(rootDir, "manifests", "workspace.json")`
 * yields `<root>/.vetwo/docs/manifests/workspace.json`.
 */
export function resolveDocsStatePath(rootDir: string, ...parts: readonly string[]): string {
  return posixJoin(getDocsStateRoot(rootDir), ...parts);
}

/**
 * Resolve a path inside a namespace.
 *
 * The namespace id is mapped to its canonical directory (e.g. `scanner` →
 * `.vetwo/docs/scanner/`, `plugin:acme` → `.vetwo/docs/plugins/acme/`,
 * `ai:openwiki` → `.vetwo/docs/ai/providers/openwiki/`). This never creates
 * anything.
 */
export function resolveDocsNamespacePath(
  rootDir: string,
  namespace: string,
  ...parts: readonly string[]
): string {
  return posixJoin(getDocsStateRoot(rootDir), ...namespaceSegments(namespace), ...parts);
}
