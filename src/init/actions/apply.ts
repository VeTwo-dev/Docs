import type { SafeFileSystem } from "../filesystem/interface.js";
import type { PlanAction } from "../types/plan.js";
import { safeCreate, safeMkdir, safeWrite } from "../filesystem/safe.js";

/** Outcome of applying a plan. */
export interface ApplyResult {
  readonly created: readonly string[];
  readonly preserved: readonly string[];
  readonly merged: readonly string[];
  readonly updated: readonly string[];
  readonly skipped: readonly string[];
  readonly conflicts: readonly string[];
  readonly errors: readonly string[];
}

/** Options for {@link applyPlan}. */
export interface ApplyOptions {
  readonly fs: SafeFileSystem;
  /** Absolute path → content, for every file action that will be written. */
  readonly files: ReadonlyMap<string, string>;
  /** When true, nothing is written (dry run). */
  readonly dryRun: boolean;
}

/**
 * Applies a plan. Only `create`/`update`/`merge` actions are executed;
 * `conflict` and `warn` actions are never applied and are reported instead.
 *
 * Failures are caught per action so a single I/O error (or an interrupted
 * run) leaves the rest of the workspace consistent and fully reported.
 */
export function applyPlan(plan: readonly PlanAction[], options: ApplyOptions): ApplyResult {
  const { fs, files, dryRun } = options;
  const created: string[] = [];
  const preserved: string[] = [];
  const merged: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];
  const conflicts: string[] = [];
  const errors: string[] = [];

  const record = (
    action: PlanAction["action"] | "preserved",
    path: string,
    error?: string,
  ): void => {
    switch (action) {
      case "create":
        created.push(path);
        break;
      case "update":
        updated.push(path);
        break;
      case "merge":
        merged.push(path);
        break;
      case "skip":
        skipped.push(path);
        break;
      case "conflict":
        conflicts.push(path);
        break;
      case "preserved":
        preserved.push(path);
        break;
      default:
        break;
    }
    if (error !== undefined) errors.push(`${path}: ${error}`);
  };

  for (const action of plan) {
    try {
      switch (action.action) {
        case "create": {
          if (action.kind === "directory") {
            if (dryRun) {
              record("create", action.path);
              continue;
            }
            const result = safeMkdir(action.path, { fs });
            if (result.ok) record("create", action.path);
            else if (result.action === "preserved") record("preserved", action.path);
            else record("skip", action.path, result.reason);
          } else {
            if (dryRun) {
              record("create", action.path);
              continue;
            }
            const content = files.get(action.path) ?? "";
            const result = safeCreate(action.path, content, { fs });
            if (result.ok) record("create", action.path);
            else if (result.action === "skipped") {
              // The target appeared between planning and applying: preserve it.
              record("skip", action.path, result.reason);
            } else {
              record("create", action.path, result.reason);
            }
          }
          break;
        }
        case "update": {
          if (dryRun) {
            record("update", action.path);
            continue;
          }
          const content = files.get(action.path) ?? "";
          const result = safeWrite(action.path, content, {
            fs,
            expectedOwnership: "system-managed",
          });
          if (result.ok) record("update", action.path);
          else record("skip", action.path, result.reason);
          break;
        }
        case "merge": {
          if (dryRun) {
            record("merge", action.path);
            continue;
          }
          const content = files.get(action.path);
          if (content === undefined) {
            record("skip", action.path, "No merged content available");
            continue;
          }
          const result = safeWrite(action.path, content, { fs });
          if (result.ok) record("merge", action.path);
          else record("skip", action.path, result.reason);
          break;
        }
        case "conflict":
          record("conflict", action.path);
          break;
        case "skip":
          if (fs.exists(action.path)) record("preserved", action.path);
          else record("skip", action.path);
          break;
        case "warn":
          break;
        default:
          break;
      }
    } catch (error) {
      record(action.action, action.path, error instanceof Error ? error.message : String(error));
    }
  }

  return { created, preserved, merged, updated, skipped, conflicts, errors };
}
