/**
 * Deterministic, dependency-free hashing used for stable example ids.
 *
 * IDs must survive content regeneration, ordering changes and renderer
 * changes, so every id is derived from stable provenance + content, never
 * from in-memory indices.
 */

/** Hash a string to a stable hex string (FNV-1a, 32-bit). */
export function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Build a stable, scoped id from a prefix and parts. */
export function stableId(prefix: string, ...parts: readonly string[]): string {
  const content = parts.join("|");
  return content.length === 0 ? prefix : `${prefix}:${hashString(content)}`;
}

/** Normalize a string for comparison (lowercase, trim, collapse whitespace). */
export function normalizeForCompare(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Normalize a path for stable comparisons (forward slashes, no leading ./). */
export function normalizePathForCompare(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}
