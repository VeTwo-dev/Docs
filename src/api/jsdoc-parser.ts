/**
 * JSDoc / TSDoc Comment Parser.
 *
 * Extracts structured documentation from JSDoc block comments and `/// ... ` comments.
 * Handles `@param`, `@returns`, `@example`, `@deprecated`, `@since`, `@throws`,
 * `@see`, `@link`, `@default`, `@beta`, `@experimental`, `@internal` tags.
 *
 * This is a safe, regex-based parser — it does not depend on any external
 * documentation library and is designed for the subset of tags actually
 * used in real-world TypeScript/JavaScript codebases.
 */

import type { ApiDocComment } from "./models.js";

/** A single tag occurrence in a comment. */
interface CommentTag {
  readonly tag: string;
  readonly body: string;
}

/** Split raw comment text into summary + tags. */
function splitComment(raw: string): { summary: string; tags: CommentTag[] } {
  const lines = raw.split("\n");
  const summaryLines: string[] = [];
  const tags: CommentTag[] = [];

  let currentTag: CommentTag | null = null;

  for (const line of lines) {
    const tagMatch = line.match(/^(@\w[\w-]*)\s/);
    const tagMatchEnd = line.match(/^(@\w[\w-]*)$/);
    const matchedTag = tagMatch?.[1] ?? tagMatchEnd?.[1];
    if (matchedTag !== undefined) {
      if (currentTag !== null) tags.push(currentTag);
      const tagBody = line.slice(matchedTag.length).trim();
      currentTag = {
        tag: matchedTag.slice(1),
        body: tagBody,
      };
    } else if (currentTag !== null) {
      currentTag = { tag: currentTag.tag, body: currentTag.body + " " + line.trim() };
    } else {
      const trimmed = line.trim();
      if (trimmed.length > 0) summaryLines.push(trimmed);
    }
  }
  if (currentTag !== null) tags.push(currentTag);

  return { summary: summaryLines.join(" ").trim(), tags };
}

/** Group tags by name (multiple `@example` blocks, etc.). */
function groupTags(tags: CommentTag[]): Readonly<Record<string, string[]>> {
  const grouped: Record<string, string[]> = {};
  for (const t of tags) {
    (grouped[t.tag] ??= []).push(t.body);
  }
  return grouped;
}

/** Extract `@example` blocks from tag bodies. */
function extractExamples(bodies: readonly string[]): ApiDocComment["examples"] {
  const _examples: { readonly title?: string; readonly code: string; readonly language: string }[] =
    [];
  // _examples used
  for (const body of bodies) {
    // Handle fenced code block: @example ```ts ... ```
    const fencedMatch = body.match(/^```(\w*)\s*\n([\s\S]*?)```$/);
    if (fencedMatch !== null) {
      _examples.push({
        title: undefined,
        language: fencedMatch[1]! || "ts",
        code: fencedMatch[2]!.trim(),
      });
      continue;
    }
    // Handle language + code format: @example ts\ncode
    const langCodeMatch = body.match(/^(\w+)\s*\n([\s\S]*)$/);
    if (langCodeMatch !== null) {
      _examples.push({
        title: undefined,
        language: langCodeMatch[1]! || "ts",
        code: langCodeMatch[2]!.trim(),
      });
      continue;
    }
    // Plain code without language
    _examples.push({ language: "ts", code: body.trim() });
  }
  return _examples;
}

/** Extract `@param` tag descriptions, keyed by parameter name. */
function extractParams(bodies: readonly string[]): ApiDocComment["params"] {
  const params: { name: string; description: string }[] = [];
  for (const body of bodies) {
    const match = body.match(/^(\w+)\s*[-–—]\s*([\s\S]*)$/);
    if (match !== null) {
      params.push({ name: match[1]!, description: match[2]!.trim() });
    } else {
      const nameOnly = body.trim().split(/\s+/)[0];
      if (nameOnly) {
        params.push({ name: nameOnly, description: "" });
      }
    }
  }
  return params;
}

/** Extract `@throws` / `@exception` tag bodies. */
function extractThrows(bodies: readonly string[]): ApiDocComment["throws"] {
  return bodies.map((body) => {
    // Handle {ErrorType} description format
    const bracesMatch = body.match(/^\{(\w+(?:\.\w+)*)\}\s*([\s\S]*)$/);
    if (bracesMatch !== null) {
      return { type: bracesMatch[1]!, description: bracesMatch[2]!.trim() };
    }
    // Handle ErrorType - description format
    const dashMatch = body.match(/^(\w+(?:\.\w+)*)\s*[-–—]\s*([\s\S]*)$/);
    if (dashMatch !== null) {
      return { type: dashMatch[1]!, description: dashMatch[2]!.trim() };
    }
    return { description: body.trim() };
  });
}

/** Extract `@see` references. */
function extractSee(bodies: readonly string[]): ApiDocComment["see"] {
  return bodies.map((body) => {
    const linkMatch = body.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch !== null) {
      return { text: linkMatch[1]!, url: linkMatch[2]! };
    }
    return { text: body.trim() };
  });
}

/** Extract `@link` references from text. */
function extractLinks(text: string): ApiDocComment["links"] {
  const links: { text: string; target: string }[] = [];
  const linkRegex = /\{@link\s+(\w+(?:\.\w+)*)\s*(?:[^}]*)?\}/g;
  let match;
  while ((match = linkRegex.exec(text)) !== null) {
    if (match[1] !== undefined) links.push({ text: match[0]!, target: match[1] });
  }
  return links;
}

/** Clean summary text: remove leading/trailing whitespace, normalize spaces. */
function cleanSummary(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/^\s*[-–—]\s*/, "")
    .trim();
}

/**
 * Parse a JSDoc/TSDoc comment string into a structured `ApiDocComment`.
 *
 * @param raw - The raw comment text (without leading delimiters).
 * @returns Parsed documentation comment.
 *
 * @example
 * ```ts
 * const doc = parseDocComment(`
 *   Creates a new user.
 *
 *   @param name - The user's name
 *   @param age - The user's age
 *   @returns The created user
 *   @example
 *   const user = createUser("Alice", 30);
 * `);
 * ```
 */
export function parseDocComment(raw: string): ApiDocComment {
  const cleaned = raw
    .split("\n")
    .map((line) => line.replace(/^\s*\*?\s?/, ""))
    .join("\n")
    .trim();

  const { summary, tags } = splitComment(cleaned);
  const grouped = groupTags(tags);

  return {
    summary: cleanSummary(summary ?? ""),
    params: extractParams(grouped["param"] ?? []),
    returns: grouped["returns"]?.[0] ?? grouped["return"]?.[0],
    examples: extractExamples(grouped["example"] ?? []),
    since: grouped["since"]?.[0],
    deprecated:
      grouped["deprecated"]?.[0] ?? (grouped["deprecated"] !== undefined ? "" : undefined),
    throws: extractThrows(grouped["throws"] ?? grouped["exception"] ?? []),
    see: extractSee(grouped["see"] ?? []),
    links: extractLinks(cleaned),
    tags: grouped,
    raw: cleaned,
  };
}
