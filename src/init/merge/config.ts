/** Sections detected in an existing configuration source. */
export interface ConfigSections {
  readonly hasOutput: boolean;
  readonly hasAgent: boolean;
}

/** The configuration fragments the system wants to ensure are present. */
export interface DesiredConfigFragments {
  readonly output: string;
  readonly agent: string;
}

const DEFINED_DOCS_RE = /export\s+default\s+defineDocs\s*\(\s*\{([\s\S]*?)\}\s*\)/;
const OUTPUT_KEY_RE = /^\s*output\s*:/m;
const AGENT_KEY_RE = /^\s*agent\s*:/m;

/** Detect which system-owned sections a config source already contains. */
export function detectConfigSections(source: string): ConfigSections {
  const match = DEFINED_DOCS_RE.exec(source);
  const body = match?.[1] ?? source;
  return {
    hasOutput: OUTPUT_KEY_RE.test(body),
    hasAgent: AGENT_KEY_RE.test(body),
  };
}

/**
 * Merges missing system-owned sections into a generated-style config file.
 *
 * Only `export default defineDocs({ ... })` files are merged — anything else
 * is preserved untouched (returns `undefined`). Existing user sections are
 * never modified; only missing `output` / `agent` keys are inserted.
 */
export function mergeConfigContent(
  source: string,
  desired: DesiredConfigFragments,
): string | undefined {
  const match = DEFINED_DOCS_RE.exec(source);
  if (match === null) return undefined;

  const indent = "  ";
  const body = match[1] ?? "";
  const closingIndex = source.indexOf("});", match.index + match[0].length - 2);
  if (closingIndex === -1) return undefined;

  const insertions: string[] = [];
  if (!OUTPUT_KEY_RE.test(body)) {
    insertions.push(indent + desired.output.trim().replace(/\n/g, "\n" + indent));
  }
  if (!AGENT_KEY_RE.test(body)) {
    insertions.push(indent + desired.agent.trim().replace(/\n/g, "\n" + indent));
  }
  if (insertions.length === 0) return undefined;

  const tail = match[0].endsWith("\n") ? "" : "\n";
  const prefix = source.slice(0, match.index + match[0].length - 2);
  const suffix = source.slice(match.index + match[0].length - 2);
  return prefix.trimEnd() + "\n" + insertions.join("\n") + tail + suffix.trimStart();
}
