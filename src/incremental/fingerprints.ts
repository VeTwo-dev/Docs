/**
 * Incremental Fingerprints.
 *
 * Content fingerprints identify files exactly; semantic fingerprints
 * ignore formatting and comments so that formatting-only changes never
 * invalidate documentation.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

/** SHA-256 content hash (hex, truncated). */
export function hashContent(contents: string): string {
  return createHash("sha256").update(contents).digest("hex").slice(0, 16);
}

export function hashFile(path: string): string | undefined {
  try {
    return hashContent(readFileSync(path, "utf-8"));
  } catch {
    return undefined;
  }
}

/**
 * Semantic hash: strips comments and collapses whitespace so a
 * formatting-only or comment-only change produces the same hash.
 */
export function semanticHash(contents: string): string {
  return hashContent(stripSemanticsPreserving(contents));
}

/** Remove comments + normalize whitespace (language-agnostic heuristic). */
export function stripSemanticsPreserving(source: string): string {
  let withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  // Line comments — but not inside strings (heuristic: count quotes before //).
  withoutBlockComments = withoutBlockComments.replace(
    /^[^"'\n]*\/\/.*$/gm,
    (line) => (isLikelyComment(line) ? "" : line),
  );
  return withoutBlockComments
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

function isLikelyComment(line: string): boolean {
  const quoteCount = (line.match(/["'`]/g) ?? []).length;
  return quoteCount % 2 === 0;
}

/**
 * Classify a modification by comparing both fingerprint layers.
 */
export type ModificationKind =
  | "unchanged"
  | "formatting-only"
  | "comment-only"
  | "semantic";

export function classifyModification(
  beforeContents: string,
  afterContents: string,
): ModificationKind {
  if (beforeContents === afterContents) return "unchanged";
  const semanticBefore = semanticHash(beforeContents);
  const semanticAfter = semanticHash(afterContents);
  if (semanticBefore === semanticAfter) {
    const commentsOnly =
      stripComments(beforeContents) === stripComments(afterContents);
    return commentsOnly ? "comment-only" : "formatting-only";
  }
  return "semantic";
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}
