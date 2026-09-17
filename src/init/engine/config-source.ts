import type { InitLayout } from "../types/options.js";

/** Values extracted from an existing configuration source. */
export interface ExtractedWorkspace {
  readonly outputDirectory: string | undefined;
  readonly layout: Partial<InitLayout> | undefined;
  readonly agentEnabled: boolean | undefined;
  readonly skillPath: string | undefined;
}

const QUOTED = (key: string): RegExp => new RegExp(`${key}\\s*:\\s*["']([^"']+)["']`);
const BOOL = (key: string): RegExp => new RegExp(`${key}\\s*:\\s*(true|false)`);

interface MutableWorkspace {
  outputDirectory: string | undefined;
  layout: Partial<InitLayout> | undefined;
  agentEnabled: boolean | undefined;
  skillPath: string | undefined;
}

function empty(): MutableWorkspace {
  return {
    outputDirectory: undefined,
    layout: undefined,
    agentEnabled: undefined,
    skillPath: undefined,
  };
}

/**
 * Best-effort extraction of the workspace-relevant configuration from an
 * existing configuration file's source text.
 *
 * The parser is intentionally defensive: it handles the JSON subset, a naive
 * YAML subset, and common JS/TS shapes, and never throws. Anything it cannot
 * read is left undefined so the caller falls back to defaults.
 */
export function extractWorkspaceConfig(source: string, ext: string): ExtractedWorkspace {
  const lower = ext.toLowerCase();
  if (lower === ".json") {
    try {
      const parsed = JSON.parse(source) as Record<string, unknown>;
      return fromJsonObject(parsed);
    } catch {
      // fall through to the text parsers
    }
  }
  if (lower === ".yaml" || lower === ".yml") {
    return fromYaml(source);
  }
  return fromJs(source);
}

function fromJsonObject(obj: Record<string, unknown>): ExtractedWorkspace {
  const result = empty();
  const output = obj["output"];
  if (typeof output === "string") {
    result.outputDirectory = output;
  } else if (output !== null && typeof output === "object") {
    const out = output as Record<string, unknown>;
    if (typeof out["directory"] === "string") result.outputDirectory = out["directory"];
    const layoutObj = out["layout"] as Record<string, unknown> | undefined;
    if (layoutObj !== undefined) {
      const layout: { next?: boolean; markdown?: boolean; static?: boolean } = {};
      if (typeof layoutObj["next"] === "boolean") layout.next = layoutObj["next"];
      if (typeof layoutObj["markdown"] === "boolean") layout.markdown = layoutObj["markdown"];
      if (typeof layoutObj["static"] === "boolean") layout.static = layoutObj["static"];
      result.layout = layout;
    }
  }

  const agent = obj["agent"] as Record<string, unknown> | undefined;
  const skill = (agent?.["skill"] ?? {}) as Record<string, unknown>;
  if (typeof agent?.["enabled"] === "boolean") result.agentEnabled = agent["enabled"];
  if (typeof skill["path"] === "string") result.skillPath = skill["path"];
  return result;
}

function fromJs(source: string): ExtractedWorkspace {
  const result = empty();
  result.outputDirectory =
    /output\s*:\s*\{\s*directory\s*:\s*["']([^"',}\s]+)["']/.exec(source)?.[1] ??
    QUOTED("output").exec(source)?.[1];
  const layout: { next?: boolean; markdown?: boolean; static?: boolean } = {};
  const next = BOOL("next").exec(source)?.[1];
  const markdown = BOOL("markdown").exec(source)?.[1];
  const staticFlag = BOOL("static").exec(source)?.[1];
  if (next !== undefined) layout.next = next === "true";
  if (markdown !== undefined) layout.markdown = markdown === "true";
  if (staticFlag !== undefined) layout.static = staticFlag === "true";
  if (Object.keys(layout).length > 0) result.layout = layout;
  const agentMatch = /agent\s*:\s*\{/.exec(source);
  if (agentMatch !== null) {
    const enabled = BOOL("enabled").exec(source)?.[1];
    if (enabled !== undefined) result.agentEnabled = enabled === "true";
  }
  const skillPath = QUOTED("path").exec(source)?.[1];
  if (skillPath !== undefined) result.skillPath = skillPath;
  return result;
}

function fromYaml(source: string): ExtractedWorkspace {
  const result = empty();
  const layout: { next?: boolean; markdown?: boolean; static?: boolean } = {};
  let section: "output" | "agent" | "layout" | undefined;
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.replace(/^\s+/, "");
    if (line.startsWith("#") || line === "") continue;
    if (/^\S/.test(raw)) {
      const key = /^([a-zA-Z]+)\s*:/.exec(raw.trimStart())?.[1];
      if (key === "output") section = "output";
      else if (key === "agent") section = "agent";
      else section = undefined;
      continue;
    }
    if (section === "output") {
      const dir = /^directory\s*:\s*(.+)$/.exec(line)?.[1];
      if (dir) result.outputDirectory = unquote(dir);
      if (/^layout\s*:$/.test(line)) section = "layout";
    } else if (section === "layout") {
      const next = /^next\s*:\s*(true|false)$/.exec(line)?.[1];
      const markdown = /^markdown\s*:\s*(true|false)$/.exec(line)?.[1];
      const staticFlag = /^static\s*:\s*(true|false)$/.exec(line)?.[1];
      if (next !== undefined) layout.next = next === "true";
      if (markdown !== undefined) layout.markdown = markdown === "true";
      if (staticFlag !== undefined) layout.static = staticFlag === "true";
    } else if (section === "agent") {
      const enabled = /^enabled\s*:\s*(true|false)$/.exec(line)?.[1];
      if (enabled !== undefined) result.agentEnabled = enabled === "true";
      const skill = /^path\s*:\s*(.+)$/.exec(line)?.[1];
      if (skill) result.skillPath = unquote(skill);
    }
  }
  if (Object.keys(layout).length > 0) result.layout = layout;
  return result;
}

function unquote(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}
