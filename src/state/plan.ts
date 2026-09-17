import type { SafeFileSystem } from "../init/filesystem/interface.js";
import { posixJoin } from "../init/filesystem/interface.js";
import { getDocsStateRoot, resolveDocsNamespacePath } from "./paths.js";
import { DEFAULT_REGISTRY, type StateNamespaceRegistry } from "./registry.js";
import { listStateNamespaceIds } from "./doctor.js";

/** A single planned state action shown by `docs init --dry-run`. */
export interface StatePlanAction {
  readonly action: "CREATE" | "REUSE" | "PRESERVE" | "SKIP";
  /** Absolute path the action refers to. */
  readonly path: string;
  /** Optional explanation (e.g. why a directory is preserved). */
  readonly detail?: string;
}

/**
 * Compute the state actions an initialization run would perform, without
 * touching the filesystem.
 *
 * Only the namespaces actually needed by the executed features are proposed
 * (`CREATE` when missing, `REUSE` when present). Existing unknown state is
 * `PRESERVE`d, and namespaces that no active feature needs are `SKIP`ped —
 * the dry run never promises to create a namespace nothing uses.
 */
export function planStateChanges(
  fs: SafeFileSystem,
  rootDir: string,
  neededNamespaces: readonly string[],
  registry: StateNamespaceRegistry = DEFAULT_REGISTRY,
): readonly StatePlanAction[] {
  const stateRoot = getDocsStateRoot(rootDir);
  const actions: StatePlanAction[] = [];

  const stateRootExists = fs.isDirectory(stateRoot);
  actions.push({
    action: stateRootExists ? "REUSE" : "CREATE",
    path: stateRoot,
  });

  const stateManifest = posixJoin(stateRoot, "state.json");
  actions.push({
    action: fs.isFile(stateManifest) ? "REUSE" : "CREATE",
    path: stateManifest,
    detail: fs.isFile(stateManifest) ? "merged, never overwritten" : undefined,
  });

  const needed = new Set(neededNamespaces);
  for (const id of needed) {
    const def = registry.get(id);
    const dir = resolveDocsNamespacePath(rootDir, id);
    actions.push({
      action: fs.isDirectory(dir) ? "REUSE" : "CREATE",
      path: dir,
      detail: def !== undefined ? (def.retention === "cache" ? "cache" : def.category) : undefined,
    });
  }

  const onDisk = stateRootExists
    ? new Set(listStateNamespaceIds(fs, stateRoot))
    : new Set<string>();
  for (const id of [...onDisk].sort()) {
    if (needed.has(id)) continue;
    const dir = resolveDocsNamespacePath(rootDir, id);
    actions.push({
      action: "PRESERVE",
      path: dir,
      detail: registry.isRegistered(id) ? "existing engine state" : "unknown state",
    });
  }

  const registered = new Set(registry.list().map((d) => d.id));
  for (const id of [...registered].sort()) {
    if (needed.has(id) || onDisk.has(id)) continue;
    actions.push({
      action: "SKIP",
      path: resolveDocsNamespacePath(rootDir, id),
      detail: "not required by current features",
    });
  }

  return actions;
}
