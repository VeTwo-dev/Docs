import type { Logger } from "../../types/internal.js";
import type { PlanAction } from "../types/plan.js";
import type { ApplyResult } from "../actions/apply.js";
import type { InitResult } from "../types/result.js";
import type { WorkspaceConfig, DetectedProject } from "../types/workspace.js";
import type { ValidationReport } from "./validate.js";
import type { StatePlanAction } from "../../state/plan.js";

/** Context used to produce the initialization report. */
export interface ReportContext {
  readonly root: string;
  readonly configPath: string | undefined;
  readonly agentPath: string | undefined;
  readonly skillPath: string | undefined;
  readonly outputPath: string | undefined;
  readonly dryRun: boolean;
  readonly applied: ApplyResult;
  readonly plan: readonly PlanAction[];
  readonly workspace: WorkspaceConfig;
  readonly project: DetectedProject;
  readonly validation: ValidationReport;
  readonly stateActions?: readonly StatePlanAction[];
}

/** {@link ReportContext} plus a logger, required to print a report. */
export interface PrintReportContext extends ReportContext {
  readonly logger: Logger;
}

/**
 * Assembles the machine-readable {@link InitResult} from the apply outcome.
 */
export function buildInitResult(ctx: Omit<ReportContext, "validation">): InitResult {
  return {
    root: ctx.root,
    configPath: ctx.configPath,
    agentPath: ctx.agentPath,
    skillPath: ctx.skillPath,
    outputPath: ctx.outputPath,
    created: [...ctx.applied.created],
    preserved: [...ctx.applied.preserved],
    merged: [...ctx.applied.merged],
    skipped: [...ctx.applied.skipped],
    conflicts: [...ctx.applied.conflicts],
    warnings: [...ctx.applied.errors],
    stateActions: ctx.stateActions ?? [],
    dryRun: ctx.dryRun,
    plan: ctx.plan,
  };
}

/** Shorten an absolute path to be project-relative for display. */
function rel(root: string, path: string): string {
  return path.startsWith(root) ? path.slice(root.length).replace(/^\//, "") : path;
}

/**
 * Prints the user-facing initialization summary.
 */
export function printInitReport(ctx: PrintReportContext): void {
  const { logger, root, workspace, project, validation, dryRun } = ctx;
  if (dryRun) {
    logger.info("Dry run — nothing was written.");
  }

  const applied = ctx.applied;
  const lines: string[] = ["Documentation root:", `  ${workspace.output.directory}/`];
  if (workspace.agent.enabled) {
    lines.push(`AI skill:\n  ${workspace.agent.skill.path}`);
  }
  if (workspace.output.layout.next) {
    lines.push(`Next.js app:\n  ${workspace.output.directory}/next/`);
  }
  if (workspace.output.layout.markdown) {
    lines.push(`Markdown:\n  ${workspace.output.directory}/md/`);
  }
  if (workspace.output.layout.static) {
    lines.push(`Static:\n  ${workspace.output.directory}/static/`);
  }
  lines.push("", `Project: ${project.name}`);
  logger.box("Documentation workspace ready", lines.join("\n"));

  if (applied.created.length > 0) {
    logger.success(`Created ${applied.created.length} path(s)`);
    for (const path of applied.created) logger.info(`  ${rel(root, path)}`);
  }
  if (applied.merged.length > 0) {
    logger.success(`Merged ${applied.merged.length} file(s) safely`);
    for (const path of applied.merged) logger.info(`  ${rel(root, path)}`);
  }
  if (applied.preserved.length > 0) {
    logger.warn(`Preserved ${applied.preserved.length} existing path(s)`);
    for (const path of applied.preserved) logger.info(`  ${rel(root, path)}`);
  }
  if (applied.skipped.length > 0) {
    logger.info(`Skipped ${applied.skipped.length} path(s)`);
  }
  if (applied.conflicts.length > 0) {
    logger.warn(`Conflicts preserved (${applied.conflicts.length}):`);
    for (const path of applied.conflicts) logger.warn(`  ${rel(root, path)}`);
  }
  if (applied.errors.length > 0) {
    logger.error(`${applied.errors.length} error(s) during initialization:`);
    for (const error of applied.errors) logger.error(`  ${error}`);
  }

  const stateActions = ctx.stateActions ?? [];
  if (stateActions.length > 0) {
    logger.info("Internal state (.vetwo/docs):");
    for (const action of stateActions) {
      const detail = action.detail !== undefined ? `  (${action.detail})` : "";
      logger.info(`  ${action.action.padEnd(8)} ${rel(root, action.path)}${detail}`);
    }
  }

  if (!validation.ok) {
    logger.warn(`Validation: ${validation.failed} check(s) failed`);
    for (const check of validation.checks) {
      if (!check.pass) logger.warn(`  ✗ ${check.label}: ${check.detail}`);
    }
  }
}
