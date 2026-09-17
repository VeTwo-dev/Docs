import type { SafeFileSystem } from "../init/filesystem/interface.js";
import { posixJoin } from "../init/filesystem/interface.js";
import { LEGACY_OWNED_CACHE_DIRS, resolveDocsNamespacePath } from "./paths.js";
import { DEFAULT_REGISTRY, type StateNamespaceRegistry } from "./registry.js";

/** Options controlling which namespaces of the internal state are cleaned. */
export interface CleanOptions {
  /** Clean namespaces whose retention is `cache` (scanner, compiler, …). */
  readonly cache?: boolean;
  /** Clean namespaces whose retention is `temporary` (temporary files, …). */
  readonly temporary?: boolean;
  /** Clean the `reports` and `diagnostics` namespaces. */
  readonly reports?: boolean;
  /**
   * Clean safe regenerable internal state (derived indexes, graphs and
   * analysis). Manifests and user-owned state are never included.
   */
  readonly state?: boolean;
  /** Also remove legacy `.docs-cache` directories. */
  readonly legacy?: boolean;
  /** Report what would be removed without touching the filesystem. */
  readonly dryRun?: boolean;
}

/** Result of a clean operation. */
export interface CleanResult {
  /** Absolute paths of the removed (or would-be-removed) directories. */
  readonly removed: readonly string[];
  readonly dryRun: boolean;
}

/**
 * Whether a namespace is "safe regenerable internal state" for `--state`.
 * Derived indexes/graphs/analysis are safe; manifests (which describe the
 * workspace) and the state manifest itself are not.
 */
export function isRegenerableNamespace(id: string, registry: StateNamespaceRegistry): boolean {
  const def = registry.get(id);
  if (def === undefined) return false;
  if (def.id === "manifests") return false;
  return def.retention === "persistent" || def.retention === "generated";
}

/**
 * Compute the directories a clean operation would target, without touching
 * the filesystem. Kept pure so the CLI can drive removal through its own
 * helpers while the programmatic path shares identical semantics.
 *
 * Only *registered* namespaces are ever targeted — unknown or user-owned
 * directories under the state root are never candidates. `state.json` and
 * the migration marker are never targeted either.
 */
export function cleanTargets(
  rootDir: string,
  options: CleanOptions = {},
  registry: StateNamespaceRegistry = DEFAULT_REGISTRY,
): readonly string[] {
  const targets = new Set<string>();

  const cleanCache = options.cache ?? true;
  const cleanTemporary = options.temporary ?? true;
  const cleanReports = options.reports ?? true;
  const cleanState = options.state ?? false;

  for (const def of registry.list()) {
    if (cleanCache && def.retention === "cache") {
      targets.add(resolveDocsNamespacePath(rootDir, def.id));
    }
    if (cleanTemporary && def.retention === "temporary") {
      targets.add(resolveDocsNamespacePath(rootDir, def.id));
    }
    if (cleanReports && (def.id === "reports" || def.id === "diagnostics")) {
      targets.add(resolveDocsNamespacePath(rootDir, def.id));
    }
    if (cleanState && isRegenerableNamespace(def.id, registry)) {
      targets.add(resolveDocsNamespacePath(rootDir, def.id));
    }
  }

  const removeLegacy = options.legacy ?? true;
  if (removeLegacy) {
    for (const rel of LEGACY_OWNED_CACHE_DIRS) {
      targets.add(posixJoin(rootDir, rel));
    }
  }

  return [...targets].sort();
}

/**
 * Clean internal engine state under `.vetwo/docs/` by namespace.
 *
 * Never removes user-facing output (`docs/`, `wiki/`) or the `agent/`
 * authoring workspace. Namespaces are cleaned by retention class and only
 * when they actually exist; unknown or user-owned state is never touched.
 * With no flags, cache and temporary namespaces (including reports and
 * diagnostics) are cleaned while indexes, graphs and manifests are preserved.
 */
export function cleanState(
  fs: SafeFileSystem,
  rootDir: string,
  options: CleanOptions = {},
  registry: StateNamespaceRegistry = DEFAULT_REGISTRY,
): CleanResult {
  const dryRun = options.dryRun ?? false;
  const targets = cleanTargets(rootDir, options, registry);

  const removed: string[] = [];
  for (const target of targets) {
    if (!fs.exists(target)) continue;
    if (dryRun) {
      removed.push(target);
      continue;
    }
    for (const file of fs.listFiles(target)) {
      fs.remove(posixJoin(target, file));
    }
    fs.remove(target);
    removed.push(target);
  }

  return { removed, dryRun };
}
