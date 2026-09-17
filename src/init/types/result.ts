import type { PlanAction } from "./plan.js";
import type { StatePlanAction } from "../../state/plan.js";

/**
 * Machine-readable result of a documentation workspace initialization run.
 */
export interface InitResult {
  /** The resolved project root. */
  readonly root: string;
  /** Absolute path to the configuration file, when one exists or was created. */
  readonly configPath: string | undefined;
  /** Absolute path to the agent workspace, when enabled. */
  readonly agentPath: string | undefined;
  /** Absolute path to the skill file, when created/preserved. */
  readonly skillPath: string | undefined;
  /** Absolute path to the output workspace, when prepared. */
  readonly outputPath: string | undefined;
  /** Paths created during this run. */
  readonly created: readonly string[];
  /** Paths that already existed and were preserved. */
  readonly preserved: readonly string[];
  /** Paths whose system-owned content was safely merged. */
  readonly merged: readonly string[];
  /** Paths skipped (no action taken). */
  readonly skipped: readonly string[];
  /** Paths where a conflict was detected and not resolved. */
  readonly conflicts: readonly string[];
  /** Non-fatal warnings collected during the run. */
  readonly warnings: readonly string[];
  /** Planned state actions for the `.vetwo/docs` state root. */
  readonly stateActions: readonly StatePlanAction[];
  /** Whether this was a dry run (nothing was written). */
  readonly dryRun: boolean;
  /** The full plan that was produced. */
  readonly plan: readonly PlanAction[];
}

/** Build an empty result scaffold. */
export function emptyInitResult(dryRun: boolean): InitResult {
  return {
    root: "",
    configPath: undefined,
    agentPath: undefined,
    skillPath: undefined,
    outputPath: undefined,
    created: [],
    preserved: [],
    merged: [],
    skipped: [],
    conflicts: [],
    warnings: [],
    stateActions: [],
    dryRun,
    plan: [],
  };
}
