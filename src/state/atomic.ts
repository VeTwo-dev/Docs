import type { SafeFileSystem } from "../init/filesystem/interface.js";
import { posixJoin } from "../init/filesystem/interface.js";

/**
 * Atomic write helpers.
 *
 * Important state files are never partially overwritten: content is written
 * to a temporary sibling file and then atomically renamed over the
 * destination. A crash at any point leaves either the old or the new file,
 * never a truncated mixture.
 */

function dirname(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx <= 0 ? "/" : path.slice(0, idx);
}

function basename(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx < 0 ? path : path.slice(idx + 1);
}

function tmpSibling(path: string): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  return posixJoin(dirname(path), `.${basename(path)}.${suffix}.tmp`);
}

/**
 * Write `content` to `path` atomically (write temp + rename over target).
 *
 * Creates parent directories as needed. When the destination already exists
 * it is replaced in a single atomic step.
 */
export function atomicWriteFile(fs: SafeFileSystem, path: string, content: string): void {
  const tmp = tmpSibling(path);
  fs.writeFile(tmp, content);
  fs.rename(tmp, path);
}

/** Serialise and atomically write a JSON value. */
export function atomicWriteJson(fs: SafeFileSystem, path: string, value: unknown): void {
  atomicWriteFile(fs, path, JSON.stringify(value, null, 2) + "\n");
}
