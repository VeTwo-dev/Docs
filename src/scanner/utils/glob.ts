/**
 * A small, dependency-free glob matcher used by the ignore engine and resource
 * filters.
 *
 * `fast-glob` (the package's only glob library) does not expose an `isMatch`
 * helper, so this module implements the subset of glob semantics the scanner
 * needs, mirroring gitignore behaviour:
 *
 * - `*` matches any characters within a path segment (never `/`)
 * - `?` matches a single character within a segment
 * - `**` matches zero or more segments (including `/`)
 * - `[...]` character classes (with `!`/`^` negation)
 * - `{a,b}` brace expansion
 * - a leading `/` anchors the pattern to the root
 * - a trailing `/` matches the directory and everything below it
 * - a pattern without a slash matches a segment at any depth
 * - when `dot` is `false` (the default), wildcards never match leading dots
 */

export interface GlobMatchOptions {
  /** Allow wildcards to match leading-dot segments. Defaults to `false`. */
  readonly dot?: boolean;
  /** Match case-sensitively. Defaults to `true`. */
  readonly caseSensitive?: boolean;
}

const REGEX_SPECIALS = /[\\^$+().|]/g;
const GLOB_MAGIC = /[*?[\]{}]/;

/** Returns `true` when the pattern contains glob magic. */
export function hasGlobMagic(pattern: string): boolean {
  return GLOB_MAGIC.test(pattern);
}

/** Splits a string on a top-level separator, ignoring braces. */
function splitTopLevel(value: string, separator: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of value) {
    if (char === "{") depth += 1;
    else if (char === "}") depth -= 1;
    if (char === separator && depth === 0) {
      out.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  out.push(current);
  return out;
}

/**
 * Expands `{a,b}` brace alternation into concrete patterns.
 *
 * @param pattern - The glob pattern.
 * @returns Every concrete expansion of the pattern.
 */
export function expandBraces(pattern: string): readonly string[] {
  const first = pattern.indexOf("{");
  if (first === -1) return [pattern];

  let depth = 0;
  let close = -1;
  for (let i = first; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close === -1) return [pattern];

  const prefix = pattern.slice(0, first);
  const inner = pattern.slice(first + 1, close);
  const suffix = pattern.slice(close + 1);
  const results: string[] = [];
  for (const option of splitTopLevel(inner, ",")) {
    results.push(...expandBraces(prefix + option + suffix));
  }
  return results;
}

function escapeRegex(char: string): string {
  return char.replace(REGEX_SPECIALS, "\\$&");
}

/** Converts a single path segment to a regular-expression fragment. */
function segmentToRegex(segment: string, dot: boolean): string {
  let out = "";
  const startsWithWildcard = segment.startsWith("*") || segment.startsWith("?");
  if (!dot && startsWithWildcard) {
    out += "(?!\\.)";
  }
  let i = 0;
  while (i < segment.length) {
    const char = segment[i] ?? "";
    if (char === "*") {
      out += "[^/]*";
      i += 1;
    } else if (char === "?") {
      out += "[^/]";
      i += 1;
    } else if (char === "[") {
      let j = i + 1;
      let negated = false;
      if (segment[j] === "!" || segment[j] === "^") {
        negated = true;
        j += 1;
      }
      let charClass = "";
      while (j < segment.length && segment[j] !== "]") {
        charClass += segment[j] ?? "";
        j += 1;
      }
      if (j >= segment.length) {
        out += "\\[";
        i += 1;
      } else {
        const body = charClass.replace(/\\/g, "\\\\").replace(/\^/g, "\\^");
        out += `[${negated ? "^" : ""}${body}]`;
        i = j + 1;
      }
    } else {
      out += escapeRegex(char);
      i += 1;
    }
  }
  return out;
}

interface ParsedPattern {
  readonly segments: readonly string[];
  readonly basenameOnly: boolean;
  readonly allowDescendants: boolean;
  readonly anchored: boolean;
}

function parsePattern(pattern: string): ParsedPattern {
  let value = pattern;
  let allowDescendants = false;
  if (value.endsWith("/")) {
    allowDescendants = true;
    value = value.slice(0, -1);
  }
  const anchored = value.startsWith("/");
  value = value.replace(/^\/+/, "");
  if (value === "") {
    return { segments: [], basenameOnly: false, allowDescendants, anchored };
  }
  const segments = value.split("/").filter((segment) => segment !== "");
  return {
    segments,
    basenameOnly: !value.includes("/"),
    allowDescendants,
    anchored,
  };
}

/** Dynamic-programming match of pattern segments against path segments. */
function matchSegments(
  patternSegments: readonly string[],
  pathSegments: readonly string[],
  dot: boolean,
  caseSensitive: boolean,
): boolean {
  const memo = new Map<string, boolean>();
  const rec = (pi: number, si: number): boolean => {
    const key = `${pi}:${si}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    let result: boolean;
    if (pi >= patternSegments.length) {
      result = si >= pathSegments.length;
    } else {
      const segment = patternSegments[pi] ?? "";
      if (segment === "**") {
        if (rec(pi + 1, si)) {
          result = true;
        } else if (si < pathSegments.length) {
          const pathSegment = pathSegments[si] ?? "";
          if (!dot && pathSegment.startsWith(".")) {
            result = false;
          } else {
            result = rec(pi, si + 1);
          }
        } else {
          result = false;
        }
      } else if (si >= pathSegments.length) {
        result = false;
      } else {
        const pathSegment = pathSegments[si] ?? "";
        const flags = caseSensitive ? "" : "i";
        const regex = new RegExp(`^${segmentToRegex(segment, dot)}$`, flags);
        result = regex.test(pathSegment) && rec(pi + 1, si + 1);
      }
    }
    memo.set(key, result);
    return result;
  };
  return rec(0, 0);
}

/**
 * Matches a path against a single glob pattern.
 *
 * @param pattern - The glob pattern.
 * @param path - The path to test (POSIX, relative or absolute).
 * @param options - Matching options.
 * @returns `true` when the path matches the pattern.
 *
 * @example
 * ```ts
 * matchPath("src/**\/*.ts", "src/core/index.ts"); // true
 * matchPath("node_modules", "packages/a/node_modules/x"); // true
 * ```
 */
export function matchPath(pattern: string, path: string, options: GlobMatchOptions = {}): boolean {
  const { dot = false, caseSensitive = true } = options;
  const target = path.replace(/^\/+/, "");
  const parts = target.split("/");
  for (const expanded of expandBraces(pattern)) {
    const parsed = parsePattern(expanded);

    // A basename-only pattern matches a path segment at any depth (gitignore
    // semantics: an ignored directory matches everything below it). Anchored
    // patterns must match from the root instead.
    if (parsed.basenameOnly && !parsed.anchored) {
      for (let i = 0; i < parts.length; i += 1) {
        if (matchSegments(parsed.segments, [parts[i] ?? ""], dot, caseSensitive)) {
          return true;
        }
      }
      continue;
    }

    if (matchSegments(parsed.segments, parts, dot, caseSensitive)) {
      return true;
    }
    if (parsed.allowDescendants && !parsed.basenameOnly) {
      const prefix = parsed.segments.join("/");
      if (target === prefix || target.startsWith(`${prefix}/`)) return true;
    }
  }
  return false;
}
