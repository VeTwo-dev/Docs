import type { ScannerProvider } from "../providers/types.js";
import { matchPath } from "../utils/glob.js";
import { toPosixPath } from "../utils/path.js";

/**
 * The origin of an ignore rule. Ordering across sources is significant:
 * later sources win over earlier ones for the same path.
 */
export type IgnoreSource =
  | "default"
  | "gitignore"
  | "npmignore"
  | "docsignore"
  | "user"
  | "plugin"
  | "generated"
  | "scanner";

/** A single ignore rule with its source and scope. */
export interface IgnoreRule {
  /** The glob pattern (without the leading `!`). */
  readonly pattern: string;
  /** Where the rule came from. */
  readonly source: IgnoreSource;
  /** The directory the rule applies to, relative to the project root (`.` = root). */
  readonly dir: string;
  /** Whether the rule re-includes (`!pattern`). */
  readonly negated: boolean;
  /** Monotonic ordering index used to resolve precedence. */
  readonly index: number;
}

/** Options for constructing an {@link IgnoreEngine}. */
export interface IgnoreEngineOptions {
  /** Whether ignore patterns may match dotfiles. Defaults to `false`. */
  readonly dot?: boolean;
}

/** The names of ignore files discovered per directory, in precedence order. */
export const IGNORE_FILE_NAMES: readonly {
  readonly file: string;
  readonly source: IgnoreSource;
}[] = [
  { file: ".gitignore", source: "gitignore" },
  { file: ".npmignore", source: "npmignore" },
  { file: ".docsignore", source: "docsignore" },
];

/** Additional default ignore patterns beyond {@link DEFAULT_IGNORE_PATTERNS}. */
export const SCANNER_IGNORE_PATTERNS: readonly string[] = [
  "node_modules",
  "dist",
  "build",
  "out",
  "bin",
  ".git",
  ".turbo",
  ".nx",
  ".cache",
  ".docs-cache",
  ".vetwo",
  ".next",
  ".nuxt",
  ".astro",
  ".output",
  ".parcel-cache",
  ".esbuild",
  ".swc",
  ".yarn",
  ".pnp.*",
  ".venv",
  "venv",
  "__pycache__",
  "coverage",
  ".DS_Store",
  "Thumbs.db",
  ".idea",
  ".vscode",
  ".eslintcache",
  ".stylelintcache",
  "*.log",
  "*.tmp",
  "*.swp",
  "*.tsbuildinfo",
  ".env",
  ".env.*",
];

/** Builds the default rule set applied to every scan. */
export function createDefaultRules(): IgnoreRule[] {
  return SCANNER_IGNORE_PATTERNS.map((pattern, index) => ({
    pattern,
    source: "default",
    dir: ".",
    negated: false,
    index,
  }));
}

/** Parses the contents of an ignore file into rules scoped to `dir`. */
export function parseIgnoreFile(
  content: string,
  dir: string,
  source: IgnoreSource,
  startIndex: number,
): IgnoreRule[] {
  const rules: IgnoreRule[] = [];
  let index = startIndex;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;

    let pattern = line;
    let negated = false;
    if (pattern.startsWith("\\!")) {
      pattern = pattern.slice(1);
    } else if (pattern.startsWith("!")) {
      negated = true;
      pattern = pattern.slice(1);
    }
    if (pattern.startsWith("\\#")) pattern = pattern.slice(1);
    if (pattern.startsWith("\\ ")) pattern = pattern.slice(1);
    if (pattern === "") continue;

    rules.push({ pattern, source, dir, negated, index });
    index += 1;
  }
  return rules;
}

/** Loads ignore files for a directory and returns their parsed rules. */
export async function loadIgnoreFilesForDir(
  provider: ScannerProvider,
  absoluteDir: string,
  relativeDir: string,
  startIndex: number,
): Promise<IgnoreRule[]> {
  const rules: IgnoreRule[] = [];
  let index = startIndex;
  for (const { file, source } of IGNORE_FILE_NAMES) {
    const ignorePath = toPosixPath(`${absoluteDir}/${file}`);
    if (!(await provider.isFile(ignorePath))) continue;
    let content: string;
    try {
      content = await provider.readFile(ignorePath);
    } catch {
      continue;
    }
    const parsed = parseIgnoreFile(content, relativeDir, source, index);
    rules.push(...parsed);
    index += parsed.length;
  }
  return rules;
}

/** The result of evaluating a path against an {@link IgnoreEngine}. */
export interface IgnoreResult {
  readonly ignored: boolean;
  /** The last matching rule, when one matched. */
  readonly rule?: IgnoreRule;
}

/**
 * Evaluates gitignore-style rules against relative paths.
 *
 * Rules are evaluated in order and the last matching rule wins, which gives
 * negation (`!pattern`) its re-include semantics and lets deeper ignore files
 * override shallower ones.
 */
export class IgnoreEngine {
  private readonly rules: readonly IgnoreRule[];
  private readonly dot: boolean;

  constructor(rules: readonly IgnoreRule[], options: IgnoreEngineOptions = {}) {
    this.rules = rules;
    this.dot = options.dot ?? false;
  }

  /** The number of rules being evaluated. */
  get count(): number {
    return this.rules.length;
  }

  /** All rules in evaluation order. */
  get all(): readonly IgnoreRule[] {
    return this.rules;
  }

  /** Composes a rule with its scope directory into a full pattern. */
  private compose(rule: IgnoreRule): string {
    if (rule.dir === "." || rule.dir === "") return rule.pattern;
    return `${rule.dir}/${rule.pattern}`;
  }

  /** Evaluates a single rule against a path. */
  private ruleMatches(rule: IgnoreRule, path: string): boolean {
    const composed = this.compose(rule);
    return matchPath(composed, path, { dot: this.dot });
  }

  /** Returns whether the path is ignored and the deciding rule. */
  matches(relativePath: string): IgnoreResult {
    const path = toPosixPath(relativePath).replace(/^\.\//, "");
    let lastMatch: IgnoreRule | undefined;
    for (const rule of this.rules) {
      if (this.ruleMatches(rule, path)) lastMatch = rule;
    }
    if (lastMatch === undefined) return { ignored: false };
    return { ignored: !lastMatch.negated, rule: lastMatch };
  }

  /** Returns `true` when the path is excluded by the rule set. */
  isIgnored(relativePath: string): boolean {
    return this.matches(relativePath).ignored;
  }

  /**
   * Whether a negation rule could re-include something below `relativeDir`.
   *
   * Used to decide whether an ignored directory can be pruned safely. When
   * this returns `true` the directory must be walked so negation rules can
   * apply to descendants.
   */
  couldReincludeUnder(relativeDir: string): boolean {
    const dir = toPosixPath(relativeDir).replace(/^\.\//, "");
    const prefix = dir === "." ? "" : `${dir}/`;
    for (const rule of this.rules) {
      if (!rule.negated) continue;
      const literal = this.literalPrefix(this.compose(rule));
      if (literal === "") return true;
      if (prefix !== "" && literal.startsWith(prefix)) return true;
      if (prefix === "" && !literal.includes("/")) return true;
    }
    return false;
  }

  /** Extracts the literal (non-glob) prefix of a pattern. */
  private literalPrefix(pattern: string): string {
    let out = "";
    for (const char of pattern) {
      if (char === "*" || char === "?" || char === "[" || char === "{") break;
      out += char;
    }
    return out;
  }
}
