/**
 * Canonical Markdown → MDX serializer (Phase 3.4).
 *
 * Produces deterministic, valid, readable, stable MDX artifacts from
 * canonical documents. `.mdx` sources pass through byte-identical (only the
 * frontmatter is regenerated); `.md` sources are escaped where plain
 * Markdown would break MDX parsing (`<Letter` tag opens and `{braces}`
 * outside code spans). Fenced code blocks pass through untouched in both
 * cases. Output carries identity frontmatter (`generator: "@vetwo/docs"`),
 * which the ownership system recognizes.
 */

import type { CanonicalDocument } from "./types.js";

export interface MdxArtifact {
  /** Content-root-relative output path (`guide/start.mdx`). */
  readonly path: string;
  readonly contents: string;
}

/** Serialize one canonical document to a deterministic MDX artifact. */
export function toMDX(document: CanonicalDocument): MdxArtifact {
  const isMdxSource = document.relativePath.endsWith(".mdx");
  const path = document.relativePath.replace(/\.(md|mdx)$/, ".mdx");
  const frontmatter = [
    "---",
    `title: ${JSON.stringify(document.title)}`,
    ...(document.description.length > 0
      ? [`description: ${JSON.stringify(document.description)}`]
      : []),
    ...(document.date !== undefined ? [`date: ${JSON.stringify(document.date)}`] : []),
    `slug: ${JSON.stringify(document.id)}`,
    `generator: "@vetwo/docs"`,
    "---",
    "",
  ].join("\n");
  const body = isMdxSource
    ? ensureTrailingNewline(document.body)
    : escapeMarkdownForMdx(document.body);
  return { path, contents: `${frontmatter}${body}` };
}

function ensureTrailingNewline(body: string): string {
  return body.endsWith("\n") ? body : `${body}\n`;
}

/**
 * Escape Markdown text so it parses as MDX: `<` opening a tag-like sequence
 * and `{`/`}` outside code spans become entities. Fenced blocks are passed
 * through verbatim (code is always MDX-safe).
 */
export function escapeMarkdownForMdx(body: string): string {
  const lines = body.split("\n");
  const out: string[] = [];
  let inFence = false;
  for (const line of lines) {
    if (/^(`{3,}|~{3,})/.test(line.trimStart())) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    out.push(inFence ? line : escapeMdxLine(line));
  }
  return ensureTrailingNewline(out.join("\n"));
}

function escapeMdxLine(line: string): string {
  const trimmed = line.trim();
  // Standalone HTML tag lines are valid MDX as-is.
  if (HTML_TAG_LINE.test(trimmed)) return line;
  // Segment on code spans; only rewrite prose segments.
  return line
    .split(/(`[^`]*`)/g)
    .map((segment, index) => (index % 2 === 1 ? segment : escapeProse(rewriteAutolinks(segment))))
    .join("");
}

/** A line that is exactly one HTML tag, closing tag, or comment. */
const HTML_TAG_LINE = /^<(?:!--[\s\S]*?--|\/[A-Za-z][^<>]*|[A-Za-z][^<>]*\/?)>\s*$/;

/**
 * Rewrite Markdown autolinks (`<https://…>`, `<a@b.c>`, `[t](<url>)`) into
 * explicit `[text](url)` links: angle-bracket destinations are not valid MDX.
 */
function rewriteAutolinks(segment: string): string {
  return segment
    .replace(/\[([^\]]*)\]\(<([^<>\s]+)>\)/g, "[$1]($2)")
    .replace(/<((?:https?:\/\/|mailto:)[^<>\s]*)>/g, "[$1]($1)")
    .replace(/<([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})>/g, "[$1](mailto:$1)");
}

function escapeProse(segment: string): string {
  let out = "";
  let i = 0;
  while (i < segment.length) {
    const char = segment[i];
    if (char === "<") {
      const next = segment[i + 1] ?? "";
      out += /[A-Za-z/!?]/.test(next) ? "&lt;" : "<";
      i += 1;
      continue;
    }
    if (char === "{") {
      out += "&#123;";
      i += 1;
      continue;
    }
    if (char === "}") {
      out += "&#125;";
      i += 1;
      continue;
    }
    out += char;
    i += 1;
  }
  return out;
}
