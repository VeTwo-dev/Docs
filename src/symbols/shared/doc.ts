import type { DocumentationComment, DocumentationTag } from "../models/index.js";

const TAG_PATTERN = /^\s*@([a-zA-Z][\w-]*)\s*(.*)$/;
const NAME_SPLIT_PATTERN = /^([^-\s]+(?:\s+[^-\s]+)?)\s*-\s*(.*)$/;

/**
 * Parses a raw documentation comment into a {@link DocumentationComment}.
 *
 * The raw text is preserved verbatim; the summary and tags are structural
 * extractions, not interpretation.
 */
export function parseDocumentationComment(
  raw: string,
  format: DocumentationComment["format"] = "plain",
): DocumentationComment {
  const lines = normalizedLines(raw);
  const tags: DocumentationTag[] = [];
  const summaryLines: string[] = [];
  let inTags = false;

  for (const line of lines) {
    const tagMatch = TAG_PATTERN.exec(line);
    if (tagMatch !== null) {
      inTags = true;
      tags.push(parseTag(tagMatch[1]!, tagMatch[2]!));
      continue;
    }
    if (!inTags && line.length > 0) summaryLines.push(line);
  }

  const summary = summaryLines.join(" ").trim();

  return Object.freeze({
    text: raw.trim(),
    ...(summary.length > 0 ? { summary } : {}),
    tags: Object.freeze(tags),
    format,
  });
}

function normalizedLines(raw: string): readonly string[] {
  return raw
    .replace(/^\s*\/\*\*/, "")
    .replace(/\*\/\s*$/, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\*? ?/, "").replace(/\s+$/, ""));
}

function parseTag(tag: string, rest: string): DocumentationTag {
  const trimmed = rest.trim();
  if (trimmed.length === 0) return { tag };
  const nameMatch = NAME_SPLIT_PATTERN.exec(trimmed);
  if (nameMatch !== null) {
    const name = nameMatch[1]!.trim();
    const text = nameMatch[2]!.trim();
    return Object.freeze({
      tag,
      ...(name.length > 0 ? { name } : {}),
      ...(text.length > 0 ? { text } : {}),
    });
  }
  const firstWord = trimmed.split(/\s+/, 1)[0];
  if (firstWord !== undefined && /^[A-Za-z_$][\w$]*$/.test(firstWord)) {
    const name = firstWord;
    const text = trimmed.slice(firstWord.length).trim();
    return Object.freeze({ tag, name, ...(text.length > 0 ? { text } : {}) });
  }
  return Object.freeze({ tag, text: trimmed });
}

/** Whether a documentation comment declares a given tag. */
export function hasDocumentationTag(
  documentation: DocumentationComment | undefined,
  tag: string,
): boolean {
  if (documentation === undefined) return false;
  return documentation.tags.some((candidate) => candidate.tag === tag);
}
