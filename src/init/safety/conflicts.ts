import type { SafeFileSystem } from "../filesystem/interface.js";
import type { InitAction, Ownership, RiskLevel } from "../types/plan.js";
import { isSystemOwned } from "./ownership.js";

/** A proposed operation the planner wants to perform on a path. */
export interface ProposedOp {
  /** Absolute path of the target. */
  readonly path: string;
  /** What the planner would like to do. */
  readonly desiredAction: InitAction;
  /** Whether the target is a directory. */
  readonly directory: boolean;
  /** Ownership already classified (before this resolution). */
  readonly ownership: Ownership;
}

/** Resolved plan action after conflict analysis. */
export interface ResolvedAction {
  readonly action: InitAction;
  readonly risk: RiskLevel;
  readonly reason: string;
  readonly interactive: boolean;
}

const SAFE_RISK: RiskLevel = "none";
const LOW_RISK: RiskLevel = "low";

/**
 * Resolves a proposed operation against the actual filesystem state and
 * ownership classification. Never yields an action that would destroy
 * user-owned content without explicit confirmation.
 */
export function resolveConflict(fs: SafeFileSystem, proposed: ProposedOp): ResolvedAction {
  const { path, desiredAction, directory, ownership } = proposed;
  const exists = fs.exists(path);

  if (!exists) {
    return {
      action: desiredAction === "skip" ? "skip" : "create",
      risk: SAFE_RISK,
      reason: "Path does not exist; safe to create",
      interactive: false,
    };
  }

  // Existing directory: preserve it.
  if (directory || fs.isDirectory(path)) {
    if (desiredAction === "update" || desiredAction === "merge") {
      return {
        action: "skip",
        risk: SAFE_RISK,
        reason: "Directory already exists",
        interactive: false,
      };
    }
    return {
      action: "skip",
      risk: SAFE_RISK,
      reason: "Directory already exists; preserved",
      interactive: false,
    };
  }

  // Existing file.
  switch (desiredAction) {
    case "create":
      if (isSystemOwned(ownership)) {
        return {
          action: "skip",
          risk: SAFE_RISK,
          reason: "System-owned file already exists",
          interactive: false,
        };
      }
      return {
        action: "conflict",
        risk: "high",
        reason: `Existing ${ownership} file would be replaced`,
        interactive: true,
      };

    case "update":
      if (ownership === "system-managed") {
        return {
          action: "update",
          risk: LOW_RISK,
          reason: "System-managed file may be regenerated",
          interactive: false,
        };
      }
      if (ownership === "system-generated") {
        return {
          action: "conflict",
          risk: "medium",
          reason: "Generated file exists but is not tracked as managed",
          interactive: true,
        };
      }
      return {
        action: "conflict",
        risk: "high",
        reason: `Refusing to overwrite ${ownership} file`,
        interactive: true,
      };

    case "merge":
      return {
        action: "merge",
        risk: LOW_RISK,
        reason: "System-owned sections merged; user content preserved",
        interactive: false,
      };

    case "skip":
      return {
        action: "skip",
        risk: SAFE_RISK,
        reason: "Skipped by planner",
        interactive: false,
      };

    case "warn":
      return {
        action: "warn",
        risk: LOW_RISK,
        reason: "Warning only",
        interactive: false,
      };

    default:
      return {
        action: "conflict",
        risk: "high",
        reason: "Unhandled operation on existing file",
        interactive: true,
      };
  }
}
