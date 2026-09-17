import { createHash } from "node:crypto";

/**
 * Builds a stable hash from ordered parts.
 *
 * Arrays are sorted so the hash does not depend on discovery order, keeping
 * symbol and relationship hashes stable across extraction runs.
 */
export function stableHash(
  ...parts: readonly (string | number | boolean | readonly string[] | undefined)[]
): string {
  const segments: string[] = [];
  for (const part of parts) {
    if (part === undefined || part === null) {
      segments.push("");
      continue;
    }
    if (Array.isArray(part)) {
      segments.push([...part].sort().join("\u0001"));
      continue;
    }
    segments.push(String(part));
  }
  return createHash("sha1").update(segments.join("\u0000"), "utf8").digest("hex");
}
