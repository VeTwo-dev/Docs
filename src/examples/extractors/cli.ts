import type { ExampleExtractor, ExampleExtractionInput, RawExample } from "./extractor.js";
import { provenance } from "./extractor.js";
import { normalizeExampleBody, detectSymbols } from "../normalizers/normalizer.js";

/** Shell block used for CLI examples. */
interface CliUsage {
  readonly command: string;
  readonly args: readonly string[];
  readonly flags: readonly string[];
  readonly body: string;
  readonly startLine: number;
  readonly endLine: number;
}

/**
 * Extracts CLI usage examples from shell blocks, scripts and package.json
 * `bin`/`scripts` evidence. Commands are parsed but never executed.
 */
export function createCliExampleExtractor(): ExampleExtractor {
  return {
    id: "cli",
    name: "CLI usage extractor",
    provenanceKinds: ["cli"],

    supports(path: string, content?: string): boolean {
      const lower = path.toLowerCase();
      if (/\.(sh|bash|zsh|fish)$/.test(lower)) return true;
      if (path === "package.json" && content !== undefined) return true;
      return false;
    },

    extract(input: ExampleExtractionInput): readonly RawExample[] {
      const results: RawExample[] = [];
      if (input.path === "package.json") {
        results.push(...extractPackageScripts(input.content, input.path));
        return Object.freeze(results);
      }
      const blocks = extractCliBlocks(input.content);
      const isShellFile = /\.(sh|bash|zsh|fish)$/.test(input.path);
      if (blocks.length === 0 && isShellFile && input.content.trim().length > 0) {
        const firstLine = input.content.split("\n").find((line) => line.trim().length > 0);
        const parsed =
          firstLine !== undefined
            ? parseCliCommand(firstLine)
            : { command: "", args: [], flags: [] };
        results.push({
          title: `CLI: ${parsed.command || "script"}`,
          language: "bash",
          content: normalizeExampleBody(input.content),
          provenance: provenance("cli", input.path),
          description: describeFlags(parsed.flags),
          typeHint: "cli",
          referencedSymbols: detectSymbols(normalizeExampleBody(input.content), input.knownSymbols),
          confidence: 0.85,
        });
      }
      for (const block of blocks) {
        const body = normalizeExampleBody(block.body);
        results.push({
          title: `CLI: ${block.command}${block.args.length > 0 ? ` ${block.args.join(" ")}` : ""}`,
          language: "bash",
          content: body,
          provenance: provenance("cli", input.path, {
            startLine: block.startLine,
            endLine: block.endLine,
          }),
          description: describeFlags(block.flags),
          typeHint: "cli",
          referencedSymbols: detectSymbols(body, input.knownSymbols),
          confidence: 0.85,
        });
      }
      return Object.freeze(results);
    },
  };
}

/** Parse shell command lines into command/args/flags. */
export function parseCliCommand(line: string): {
  command: string;
  args: string[];
  flags: string[];
} {
  const clean = line.replace(/^\s*[$#]\s*/, "").trim();
  const tokens = clean.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
  const command = tokens[0] ?? "";
  const flags = tokens.filter((token) => token.startsWith("-"));
  const args = tokens.slice(1).filter((token) => !token.startsWith("-"));
  return { command, args, flags };
}

/** Find CLI usage blocks: fenced shell blocks or `$ `-prefixed lines. */
export function extractCliBlocks(content: string): readonly CliUsage[] {
  const results: CliUsage[] = [];
  const fence = /```(?:bash|sh|shell|console)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = fence.exec(content)) !== null) {
    const startLine = content.slice(0, match.index).split("\n").length;
    const body = match[1]!;
    const firstLine = body.split("\n").find((line) => line.trim().length > 0);
    if (firstLine === undefined) continue;
    const parsed = parseCliCommand(firstLine);
    const endLine = startLine + body.split("\n").length;
    results.push({ ...parsed, body, startLine, endLine });
  }
  return Object.freeze(results);
}

/** Build raw examples from package.json `scripts` and `bin` evidence. */
function extractPackageScripts(content: string, path: string): readonly RawExample[] {
  const results: RawExample[] = [];
  let pkg: { scripts?: Record<string, string>; bin?: string | Record<string, string> } | undefined;
  try {
    pkg = JSON.parse(content) as {
      scripts?: Record<string, string>;
      bin?: string | Record<string, string>;
    };
  } catch {
    return Object.freeze([]);
  }
  const scripts = pkg.scripts ?? {};
  for (const [name, script] of Object.entries(scripts)) {
    if (typeof script !== "string" || script.trim().length === 0) continue;
    const parsed = parseCliCommand(script);
    results.push({
      title: `Script: ${name}`,
      language: "bash",
      content: script,
      provenance: provenance("cli", path),
      description: `package.json script "${name}"`,
      typeHint: "cli",
      confidence: 0.7,
    });
    void parsed;
  }
  return Object.freeze(results);
}

function describeFlags(flags: readonly string[]): string | undefined {
  return flags.length > 0 ? `Flags: ${flags.join(", ")}` : undefined;
}
