import type { SafeFileSystem } from "../init/filesystem/interface.js";
import { posixJoin } from "../init/filesystem/interface.js";

/** Default ignore rule added to `.gitignore` for the state root. */
export const DEFAULT_STATE_IGNORE_RULE = ".vetwo/docs/" as const;

/** Rules that are considered to already cover the state root. */
const COVERING_RULES = [".vetwo/docs/", ".vetwo/", "/.vetwo/docs/", "/.vetwo/", ".vetwo"] as const;

/** Result of ensuring the state root is git-ignored. */
export interface GitignoreResult {
  /** Whether a rule was added (or would be added in dry-run mode). */
  readonly ruleAdded: boolean;
  /** The rule that would be / was added. */
  readonly rule: string;
  /** Whether this was a dry run (no filesystem change). */
  readonly dryRun: boolean;
  /** Absolute path to `.gitignore`, when present or created. */
  readonly gitignorePath: string;
}

/** Absolute path to the project `.gitignore`. */
export function getGitignorePath(rootDir: string): string {
  return posixJoin(rootDir, ".gitignore");
}

/** The current `.gitignore` content, or `""` when absent. */
export function readGitignore(fs: SafeFileSystem, rootDir: string): string {
  const path = getGitignorePath(rootDir);
  return fs.isFile(path) ? fs.readFile(path) : "";
}

/** Whether the current content already ignores the state root. */
export function isStateIgnored(content: string): boolean {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
  return COVERING_RULES.some((rule) => lines.includes(rule));
}

/**
 * Ensure the state root is covered by `.gitignore`.
 *
 * Non-destructive: never rewrites an existing file beyond appending a single
 * missing rule, never duplicates rules, and supports `--dry-run`. Rules that
 * already cover `.vetwo/docs/` (e.g. a bare `.vetwo/`) are respected.
 */
export function ensureStateIgnored(
  fs: SafeFileSystem,
  rootDir: string,
  options: { readonly dryRun?: boolean } = {},
): GitignoreResult {
  const dryRun = options.dryRun ?? false;
  const gitignorePath = getGitignorePath(rootDir);
  const content = readGitignore(fs, rootDir);

  if (isStateIgnored(content)) {
    return { ruleAdded: false, rule: DEFAULT_STATE_IGNORE_RULE, dryRun, gitignorePath };
  }

  const rule = DEFAULT_STATE_IGNORE_RULE;
  if (!dryRun) {
    const header = "### @vetwo/docs ###";
    const addition =
      content.length === 0 || content.endsWith("\n")
        ? `${header}\n${rule}\n`
        : `\n${header}\n${rule}\n`;
    fs.writeFile(gitignorePath, content + addition);
  }

  return { ruleAdded: true, rule, dryRun, gitignorePath };
}
