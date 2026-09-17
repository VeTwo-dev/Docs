import type { ExampleExtractor, ExampleExtractionInput, RawExample } from "./extractor.js";
import { provenance } from "./extractor.js";
import {
  languageFromInfo,
  normalizeExampleBody,
  detectSymbols,
  detectPackages,
} from "../normalizers/normalizer.js";

/** Source file extensions scanned for embedded examples. */
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"];

/** A doc-comment `@example` block found in source. */
interface DocExample {
  readonly content: string;
  readonly language: string;
  readonly startLine: number;
  readonly endLine: number;
}

/**
 * Extracts `@example` blocks from JSDoc/TSDoc comments.
 *
 * Only explicit `@example` evidence is extracted — arbitrary source code is
 * never treated as an example without a marker. Code is extracted verbatim
 * and never executed.
 */
export function createSourceExampleExtractor(): ExampleExtractor {
  return {
    id: "source-comments",
    name: "JSDoc / TSDoc @example extractor",
    provenanceKinds: ["source"],

    supports(path: string): boolean {
      const lower = path.toLowerCase();
      return SOURCE_EXTENSIONS.some((ext) => lower.endsWith(ext));
    },

    extract(input: ExampleExtractionInput): readonly RawExample[] {
      const blocks = extractDocExamples(input.content);
      const results: RawExample[] = blocks.map((block) => {
        const body = normalizeExampleBody(block.content);
        return {
          title: `Documented example from ${input.path}`,
          language: block.language,
          content: body,
          provenance: provenance("source", input.path, {
            startLine: block.startLine,
            endLine: block.endLine,
          }),
          typeHint: "snippet",
          referencedSymbols: detectSymbols(body, input.knownSymbols),
          referencedPackages: detectPackages(body, input.knownPackages),
          confidence: 0.95,
        };
      });
      return Object.freeze(results);
    },
  };
}

/**
 * Finds `@example` blocks inside block doc comments.
 *
 * Supports both indented-code and fenced-code forms:
 * - `@example` followed by indented/plain continuation lines
 * - `@example` followed by a fenced code block
 */
export function extractDocExamples(content: string): readonly DocExample[] {
  const results: DocExample[] = [];
  const commentRe = /\/\*\*([\s\S]*?)\*\//g;
  let commentMatch: RegExpExecArray | null;
  while ((commentMatch = commentRe.exec(content)) !== null) {
    const commentStart = content.slice(0, commentMatch.index).split("\n").length;
    const commentLines = commentMatch[1]!.split("\n");
    for (let i = 0; i < commentLines.length; i++) {
      const line = commentLines[i]!;
      const match = /^\s*\*\s*@example(?:[ \t]+([^\n]*))?/.exec(line);
      if (match === null) continue;

      const bodyLines: string[] = [];
      let language = "text";
      let j = i + 1;
      let startLine = commentStart + i + 1;

      // Fenced form: `@example` then a fence on the next line.
      const fence = /^\s*\*\s*(`{3,}|~{3,})(\w*)/.exec(commentLines[j] ?? "");
      if (fence !== null) {
        language = languageFromInfo(fence[2] ?? "");
        j += 1;
        startLine = commentStart + j;
        while (j < commentLines.length) {
          const current = commentLines[j]!;
          if (/^\s*\*\s*`{3,}/.test(current)) break;
          bodyLines.push(stripCommentPrefix(current));
          j += 1;
        }
      } else {
        // Indented/plain form: consume following comment lines.
        const firstLine = match[1];
        if (firstLine !== undefined && firstLine.trim().length > 0) {
          bodyLines.push(firstLine.trim());
        }
        let started = bodyLines.length > 0;
        while (j < commentLines.length) {
          const current = commentLines[j]!;
          if (/^\s*\*\s*@\w/.test(current)) break;
          const stripped = stripCommentPrefix(current);
          if (stripped.trim().length === 0 && bodyLines.length === 0) {
            j += 1;
            continue;
          }
          if (stripped.trim().length === 0) {
            bodyLines.push("");
            j += 1;
            continue;
          }
          if (/^\s*@\w/.test(stripped)) break;
          if (!started) {
            startLine = commentStart + j;
            started = true;
          }
          bodyLines.push(stripped);
          j += 1;
        }
      }

      const normalizedBody = bodyLines
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      if (normalizedBody.length === 0) continue;
      const endLine = startLine + bodyLines.length;
      results.push({
        content: normalizedBody,
        language,
        startLine,
        endLine,
      });
    }
  }
  return results;
}

/** Strip the `*` comment prefix from a comment continuation line. */
function stripCommentPrefix(line: string): string {
  const match = /^\s*\*\s?/.exec(line);
  return match === null ? line : line.slice(match[0].length);
}
