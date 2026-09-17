import { createHash } from "node:crypto";

/** Builds a sha-1 hex digest of a source string. */
export function hashContent(content: string): string {
  return createHash("sha1").update(content, "utf8").digest("hex");
}
