import { createHash } from "node:crypto";

/**
 * Creates a deterministic short hash from a string using SHA-256.
 *
 * @param input - The string to hash.
 * @returns A 16-character hex hash.
 *
 * @example
 * ```ts
 * hashString("hello");
 * // => "2cf24dba5fb0a30e"
 * ```
 */
export function hashString(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

/**
 * Hashes file content. Delegates to {@link hashString}.
 *
 * @param content - The file content as a string.
 * @returns A 16-character hex hash.
 *
 * @example
 * ```ts
 * const hash = hashFile("export const x = 1;");
 * ```
 */
export function hashFile(content: string): string {
  return hashString(content);
}

/**
 * Computes a combined hash over multiple files, sorted by path for consistency.
 *
 * @param contents - An array of objects with `path` and `content` properties.
 * @returns A 16-character hex hash.
 *
 * @example
 * ```ts
 * const hash = hashFiles([
 *   { path: "a.ts", content: "..." },
 *   { path: "b.ts", content: "..." },
 * ]);
 * ```
 */
export function hashFiles(contents: readonly { path: string; content: string }[]): string {
  const combined = contents
    .slice()
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((f) => `${f.path}:${f.content}`)
    .join("\n");
  return hashString(combined);
}
