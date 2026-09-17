import type { ExampleExtractor, ExampleExtractionInput, RawExample } from "./extractor.js";
import { provenance } from "./extractor.js";
import {
  dedentExampleBody,
  normalizeExampleBody,
  languageFromInfo,
  detectSymbols,
  detectPackages,
} from "../normalizers/normalizer.js";

/** Markdown file extensions scanned by the markdown extractor. */
const MARKDOWN_EXTENSIONS = [".md", ".mdx", ".markdown", ".mdown"];

/** A fenced code block found in a markdown document. */
interface FencedBlock {
  readonly language: string;
  readonly content: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly info: string | undefined;
}

/** Extract fenced code blocks from a markdown document. */
export function extractFencedBlocks(content: string): readonly FencedBlock[] {
  const blocks: FencedBlock[] = [];
  const fence = /^([ \t]*)(`{3,}|~{3,})[ \t]*([^\n]*)\n([\s\S]*?)^[ \t]*\2[ \t]*$/gm;
  let match: RegExpExecArray | null;
  while ((match = fence.exec(content)) !== null) {
    const startLine = content.slice(0, match.index).split("\n").length;
    const body = match[4] ?? "";
    const endLine = startLine + body.split("\n").length;
    blocks.push({
      language: languageFromInfo(match[3]),
      content: body,
      startLine,
      endLine,
      info: match[3]?.trim() ?? undefined,
    });
  }
  return blocks;
}

/** Find the nearest preceding heading above a line in a markdown document. */
export function nearestHeading(content: string, lineNumber: number): string | undefined {
  const lines = content.split("\n");
  let heading: string | undefined;
  for (let i = 0; i < lineNumber && i < lines.length; i++) {
    const match = /^#{1,6}\s+(.+?)\s*$/.exec(lines[i]!);
    if (match !== null) heading = match[1]!.trim();
  }
  return heading;
}

/**
 * Extracts code examples from markdown, MDX and README files.
 *
 * Every fenced code block becomes a raw example associated with its nearest
 * heading. Shell/CLI blocks get a `cli` type hint; everything else is
 * classified later.
 */
export function createMarkdownExampleExtractor(): ExampleExtractor {
  return {
    id: "markdown",
    name: "Markdown / MDX / README extractor",
    provenanceKinds: ["readme", "docs"],

    supports(path: string): boolean {
      const lower = path.toLowerCase();
      return MARKDOWN_EXTENSIONS.some((ext) => lower.endsWith(ext));
    },

    extract(input: ExampleExtractionInput): readonly RawExample[] {
      const results: RawExample[] = [];
      const blocks = extractFencedBlocks(input.content);
      for (const block of blocks) {
        if (block.content.trim().length === 0) continue;
        const context = nearestHeading(input.content, block.startLine - 1);
        const kind = isReadmePath(input.path) ? "readme" : isDocsPath(input.path) ? "docs" : "docs";
        const body = normalizeExampleBody(block.content);
        results.push({
          title: titleFor(context, block.language, input.path),
          language: block.language,
          content: dedentExampleBody(body),
          provenance: provenance(
            kind,
            input.path,
            { startLine: block.startLine, endLine: block.endLine },
            context,
          ),
          description: context,
          typeHint: block.language === "bash" || block.language === "sh" ? "cli" : "snippet",
          referencedSymbols: detectSymbols(body, input.knownSymbols),
          referencedPackages: detectPackages(body, input.knownPackages),
          confidence: 0.9,
        });
      }
      return Object.freeze(results);
    },
  };
}

function isReadmePath(path: string): boolean {
  return /(^|\/)readme\.(md|mdx|markdown)$/i.test(path);
}

function isDocsPath(path: string): boolean {
  return /(^|\/)docs?[\\/]/.test(path) || /(^|\/)(guide|guides|doc|docs)(\.|$)/i.test(path);
}

function titleFor(context: string | undefined, language: string, path: string): string {
  if (context !== undefined) return context;
  return `${language} example from ${path}`;
}
