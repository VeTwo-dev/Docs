import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { PlanAction } from "../types/plan.js";
import type { InitMode } from "../types/options.js";

/** Decision a user can make about a plan. */
export type ConfirmDecision = "apply" | "apply-safe" | "abort";

/** Options for {@link confirmPlan}. */
export interface ConfirmOptions {
  readonly mode: InitMode;
  /** Test seam: replaces the interactive question. */
  readonly ask?: (question: string) => Promise<string>;
}

/** Count actions by kind, for prompts and diagnostics. */
export function summarizePlan(plan: readonly PlanAction[]): {
  creates: number;
  updates: number;
  merges: number;
  conflicts: number;
  skips: number;
} {
  const counts = { creates: 0, updates: 0, merges: 0, conflicts: 0, skips: 0 };
  for (const action of plan) {
    switch (action.action) {
      case "create":
        counts.creates++;
        break;
      case "update":
      case "warn":
        counts.updates++;
        break;
      case "merge":
        counts.merges++;
        break;
      case "conflict":
        counts.conflicts++;
        break;
      case "skip":
        counts.skips++;
        break;
    }
  }
  return counts;
}

/**
 * Decide whether the plan may be applied.
 *
 * - `dry-run` → never applied.
 * - `auto` (`--yes`) → applies safe actions only; conflicts are never
 *   authorised by `--yes`.
 * - `interactive` → asks the user; conflicts require explicit per-conflict
 *   consent before they may proceed.
 */
export async function confirmPlan(
  plan: readonly PlanAction[],
  options: ConfirmOptions,
): Promise<ConfirmDecision> {
  const interactive = plan.filter((a) => a.interactive);
  if (options.mode === "dry-run") return "abort";
  if (options.mode === "auto") {
    return interactive.length > 0 ? "apply-safe" : "apply";
  }

  const summary = summarizePlan(plan);
  const ask = options.ask ?? askDefault;
  const total = summary.creates + summary.updates + summary.merges;

  const response = await ask(
    `Apply ${total} initialization action(s)? ${summary.conflicts > 0 ? `(${summary.conflicts} conflict(s) will be preserved) ` : ""}[Y/n] `,
  );
  const normalized = response.trim().toLowerCase();
  if (normalized === "n" || normalized === "no") return "abort";

  if (interactive.length > 0) {
    const conflictResponse = await ask(
      `${interactive.length} user-owned file(s) would be replaced. Overwrite them? [y/N] `,
    );
    const ok = conflictResponse.trim().toLowerCase();
    return ok === "y" || ok === "yes" ? "apply" : "apply-safe";
  }
  return "apply";
}

async function askDefault(question: string): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}
