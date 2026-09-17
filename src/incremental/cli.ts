/**
 * Incremental Engine CLI Commands.
 *
 * `docs changes`, `docs impact`, `docs update` — continuous project
 * intelligence from the command line. Git optional, AI optional.
 */

import type { Command } from "commander";
import type { ProjectChange } from "./change-detection.js";

import { buildCompilerInput } from "../documentation/compiler/cli.js";
import {
  detectChanges,
  gitChangedFiles,
  scanProjectFiles,
} from "./change-detection.js";
import { buildChangeGraph, loadChangeGraph } from "./graph.js";
import { computeDocumentationImpact } from "./impact.js";
import { loadSnapshot } from "./snapshot.js";
import { computeHealth, runIncrementalUpdate } from "./engine.js";

interface LoggerLike {
  info(message: string): void;
  success(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  table(headers: string[], rows: string[][]): void;
}

const LEVEL_COLOR: Record<string, string> = {
  none: "\x1b[32m",
  low: "\x1b[32m",
  medium: "\x1b[33m",
  high: "\x1b[33m",
  critical: "\x1b[31m",
};

/** Register the incremental commands on a commander program. */
export function registerIncrementalCommands(
  program: Command,
  options: {
    logger: LoggerLike;
    findRootDir(): string;
  },
): void {
  const { logger, findRootDir } = options;

  const prepare = () => {
    const rootDir = findRootDir();
    const input = buildCompilerInput(rootDir);
    return { rootDir, input };
  };

  program
    .command("changes")
    .description("Show detected project changes since the last analysis")
    .option("--git <ref>", "Compare against a Git ref instead of the snapshot")
    .action((options: { git?: string }) => {
      const { rootDir, input } = prepare();
      void input;
      const previous = loadSnapshot(rootDir);
      if (previous === undefined && options.git === undefined) {
        logger.info("No previous snapshot — run `docs update` to establish one.");
        return;
      }
      const entries = scanProjectFiles(rootDir);
      let changes = detectChanges(previous, entries).changes;

      if (options.git !== undefined) {
        const paths = gitChangedFiles(rootDir, options.git);
        if (paths === undefined) {
          logger.error("Git is not available in this project");
          return;
        }
        changes = filterChanges(changes, paths);
      }

      if (changes.length === 0) {
        logger.success("No project changes detected");
        return;
      }
      logger.table(
        ["Change", "Path", "Categories", "Exports"],
        changes.map((c) => [
          changeIcon(c.kind),
          c.path + (c.oldPath !== undefined ? ` (from ${c.oldPath})` : ""),
          c.categories.join(", ") || "-",
          `+${c.affectedSymbols.added.length}/-${c.affectedSymbols.removed.length}`,
        ]),
      );
    });

  program
    .command("impact")
    .description("Show documentation impact of current changes before regenerating")
    .option("--git <ref>", "Compare against a Git ref")
    .action((options: { git?: string }) => {
      const { rootDir } = prepare();
      const previous = loadSnapshot(rootDir);
      const entries = scanProjectFiles(rootDir);
      let changes = detectChanges(previous, entries).changes;
      if (options.git !== undefined) {
        const paths = gitChangedFiles(rootDir, options.git);
        if (paths === undefined) {
          logger.error("Git is not available in this project");
          return;
        }
        changes = filterChanges(changes, paths);
      }
      const graph = loadChangeGraph(rootDir) ?? buildChangeGraph(previous?.artifacts ?? {});
      const impact = computeDocumentationImpact(
        changes.filter((c) => c.kind !== "unchanged"),
        graph,
        previous,
      );

      const color = LEVEL_COLOR[impact.level] ?? "";
      logger.info(`Documentation Impact: ${color}${impact.level.toUpperCase()}\x1b[0m`);
      for (const line of impact.explanation) logger.info(`  ${line}`);
      logger.info("");
      if (impact.affectedPages.length > 0) {
        logger.info("Affected pages:");
        for (const slug of impact.affectedPages.slice(0, 15)) logger.info(`  - ${slug}`);
      }
      const otherArtifacts = impact.affectedArtifacts.filter((a) => a.kind !== "page");
      if (otherArtifacts.length > 0) {
        logger.info(`Affected outputs: ${otherArtifacts.map((a) => a.id).join(", ")}`);
      }
      for (const stale of impact.stalePages) {
        logger.warn(`Stale: ${stale.slug} — ${stale.reason}`);
      }

      const health = computeHealth(previous, impact.stalePages.length, 0);
      logger.info("");
      logger.info(
        `Health: freshness ${health.freshnessPct}% · consistency ${health.consistencyPct}% (${health.notes.join("; ")})`,
      );
    });

  program
    .command("update")
    .description("Incrementally regenerate only affected documentation")
    .option("--all", "Regenerate everything regardless of impact")
    .option("--changed", "Only changed documentation (default)")
    .option("--git <ref>", "Detect changes against a Git ref (CI/PR mode)")
    .option("--dry-run", "Plan without writing")
    .option("--force", "Update manually-edited generated pages (never protected ones)")
    .option("--debug", "Explain every invalidation decision")
    .action((options: {
      all?: boolean;
      changed?: boolean;
      git?: string;
      dryRun?: boolean;
      force?: boolean;
      debug?: boolean;
    }) => {
      const { rootDir, input } = prepare();
      try {
        const result = runIncrementalUpdate({
          rootDir,
          input,
          all: options.all === true,
          gitRef: options.git,
          dryRun: options.dryRun === true,
          force: options.force === true,
          debug: options.debug === true || process.env["VETWO_LOG_LEVEL"] === "debug",
        });

        logger.info(`[${result.timings.totalMs}ms] detection ${result.timings.detectionMs}ms · impact ${result.timings.impactMs}ms · regeneration ${result.timings.regenerationMs}ms`);
        logger.info(`Impact level: ${result.impact.level}`);
        if (options.dryRun === true) {
          logger.success(`Dry run — ${result.impact.affectedPages.length} page(s) would be updated, ${result.preservedCount} preserved`);
          return;
        }
        logger.success(
          `${result.regeneratedFiles.length} file(s) written, ${result.preservedCount} preserved`,
        );
        for (const line of result.impact.explanation.slice(0, 5)) {
          logger.info(`  ${line}`);
        }
      } catch (error) {
        logger.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    });

}

function changeIcon(kind: string): string {
  switch (kind) {
    case "added":
      return "\x1b[32m+\x1b[0m added";
    case "removed":
      return "\x1b[31m-\x1b[0m removed";
    case "renamed":
      return "\x1b[36m»\x1b[0m renamed";
    case "moved":
      return "\x1b[36m»\x1b[0m moved";
    default:
      return "\x1b[33m~\x1b[0m modified";
  }
}

function filterChanges(changes: readonly ProjectChange[], paths: readonly string[]): readonly ProjectChange[] {
  const set = new Set(paths);
  return changes.filter((c) => set.has(c.path) || (c.oldPath !== undefined && set.has(c.oldPath)));
}
