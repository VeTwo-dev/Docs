import { resolve, relative, join as pathJoin } from "node:path";

/**
 * Normalises a filesystem path to POSIX separators. Used internally so path
 * comparisons and manifest entries are stable across Windows/Linux/macOS.
 */
export function normalizePath(path: string): string {
  return path.split("\\").join("/").replace(/\/+/g, "/");
}

/**
 * Abstract filesystem seam for the initialization subsystem.
 *
 * The real implementation talks to `node:fs`; the in-memory implementation
 * enables deterministic tests (including interrupted and partial-failure
 * runs) without touching the disk.
 */
export interface SafeFileSystem {
  /** Resolve parts against a base into an absolute path. */
  resolve(base: string, ...parts: readonly string[]): string;
  /** Compute the relative path from `from` to `to`. */
  relative(from: string, to: string): string;
  /** Join path segments into a single path. */
  join(...parts: readonly string[]): string;
  /** Whether the path exists (file or directory). */
  exists(path: string): boolean;
  /** Whether the path is a file. */
  isFile(path: string): boolean;
  /** Whether the path is a directory. */
  isDirectory(path: string): boolean;
  /** Create a directory and any missing parents (no-op when it exists). */
  mkdir(dir: string): void;
  /** Write a file, creating parent directories as needed. */
  writeFile(file: string, content: string): void;
  /** Read a UTF-8 file; throws when the file is missing. */
  readFile(file: string): string;
  /** Copy a file; throws when the source is missing. */
  copyFile(from: string, to: string): void;
  /**
   * Rename a file (or directory), atomically replacing the destination when
   * it already exists. Throws when the source is missing.
   */
  rename(from: string, to: string): void;
  /** Remove a file or empty directory; returns whether something was removed. */
  remove(path: string): boolean;
  /** List immediate child names of a directory. */
  listDir(dir: string): readonly string[];
  /** Recursively list files under a root, as paths relative to the root. */
  listFiles(root: string): readonly string[];
  /** Register a callback invoked after every mutation (used by tests). */
  onWrite?(callback: (path: string, kind: "file" | "directory" | "remove") => void): void;
}

/** Shared path helpers used by the in-memory implementation. */
export function posixJoin(...parts: readonly string[]): string {
  return normalizePath(pathJoin(...parts));
}

export function posixResolve(base: string, ...parts: readonly string[]): string {
  return normalizePath(resolve(base, ...parts));
}

export function posixRelative(from: string, to: string): string {
  return normalizePath(relative(from, to));
}
