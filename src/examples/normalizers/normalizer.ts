/**
 * Normalization utilities for extracted example bodies.
 *
 * Normalization is conservative: whitespace that matters (indentation) is
 * preserved, while incidental differences (blank-line runs, trailing
 * whitespace) are collapsed so duplicates can be detected reliably.
 */

/** Normalize an example body without destroying indentation. */
export function normalizeExampleBody(content: string): string {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "")
    .trimEnd();
}

/** Collapse the indentation of a block so leading whitespace is relative. */
export function dedentExampleBody(content: string): string {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const nonEmpty = lines.filter((line) => line.trim().length > 0);
  const minIndent = nonEmpty.reduce((min, line) => {
    const indent = line.match(/^[ \t]*/)?.[0].length ?? 0;
    return Math.min(min, indent);
  }, Infinity);
  if (minIndent === Infinity || minIndent === 0) return content;
  return lines.map((line) => line.slice(minIndent)).join("\n");
}

/** Extract the language id from a fenced code block info string. */
export function languageFromInfo(info: string | undefined): string {
  if (info === undefined) return "text";
  const cleaned = info.trim().toLowerCase();
  if (cleaned.length === 0) return "text";
  return cleaned.split(/\s+/)[0] ?? "text";
}

/** Detect package names referenced by an example body. */
export function detectPackages(
  content: string,
  knownPackages: readonly string[] | undefined,
): readonly string[] {
  if (knownPackages === undefined || knownPackages.length === 0) return [];
  const found = new Set<string>();
  for (const pkg of knownPackages) {
    const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(?:import|from|require\\()["'\`]${escaped}["'\`]|"${escaped}"`).test(content)) {
      found.add(pkg);
    }
  }
  return Object.freeze([...found].sort());
}

/** Detect symbol names referenced by an example body. */
export function detectSymbols(
  content: string,
  knownSymbols: readonly string[] | undefined,
): readonly string[] {
  if (knownSymbols === undefined || knownSymbols.length === 0) return [];
  const found = new Set<string>();
  for (const symbol of knownSymbols) {
    if (symbol.length === 0) continue;
    const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`).test(content)) found.add(symbol);
  }
  return Object.freeze([...found].sort());
}
