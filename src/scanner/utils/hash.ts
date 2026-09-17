import { createHash } from "node:crypto";

/** The hash algorithm used for content fingerprints. */
export const CONTENT_HASH_ALGORITHM = "sha1";

/**
 * Computes a hexadecimal content hash for a string or byte buffer.
 *
 * @param data - The content to hash.
 * @returns The hexadecimal digest.
 */
export function hashContent(data: string | Uint8Array): string {
  return createHash(CONTENT_HASH_ALGORITHM).update(data).digest("hex");
}

/**
 * Computes the hash of a UTF-8 string without allocating a new buffer.
 *
 * @param text - The text to hash.
 * @returns The hexadecimal digest.
 */
export function hashText(text: string): string {
  return hashContent(text);
}

/**
 * Creates a short, stable identifier for a relative path.
 *
 * @param relativePath - The POSIX relative path.
 * @returns A URL/ID-safe identifier.
 */
export function pathToId(relativePath: string): string {
  return relativePath.replace(/^\.\//, "");
}
