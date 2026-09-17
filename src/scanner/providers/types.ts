/**
 * The provider abstraction is the scanner's only gateway to resource storage.
 *
 * The scanner core never touches `node:fs` (or any other I/O library)
 * directly — everything flows through a {@link ScannerProvider}. This keeps
 * the scanner testable against in-memory trees and portable across real
 * filesystems, ZIP archives, VFS layers and Git trees.
 */

/** The kind of resource a directory entry refers to. */
export type EntryType = "file" | "directory" | "symlink" | "unknown";

/** Filesystem stat information for a single resource. */
export interface FileStats {
  readonly type: EntryType;
  /** Size in bytes (0 for directories). */
  readonly size: number;
  /** Last-modified time in epoch milliseconds. */
  readonly mtimeMs: number;
  /** Creation time in epoch milliseconds. */
  readonly ctimeMs: number;
  /** POSIX permission bits. */
  readonly mode: number;
}

/** A single entry returned by {@link ScannerProvider.listDir}. */
export interface DirEntry {
  /** Entry basename. */
  readonly name: string;
  /** Absolute path of the entry. */
  readonly path: string;
  /** The kind of resource. */
  readonly type: EntryType;
}

/** Options for {@link ScannerProvider.glob}. */
export interface GlobOptions {
  /** The directory to resolve patterns against. Defaults to the provider root. */
  readonly cwd?: string;
  /** Return only directories. Defaults to `false`. */
  readonly onlyDirectories?: boolean;
}

/**
 * The abstract resource provider used by the scanner engine.
 *
 * Implementations must treat paths as opaque and return absolute paths for
 * entries. All methods are async; failures should reject with `Error`.
 */
export interface ScannerProvider {
  /** A stable, short name identifying the provider (e.g. `local`, `memory`). */
  readonly name: string;
  /** Whether the given path exists. */
  exists(path: string): Promise<boolean>;
  /** Whether the given path is a directory. */
  isDirectory(path: string): Promise<boolean>;
  /** Whether the given path is a regular file. */
  isFile(path: string): Promise<boolean>;
  /** Stats for the given path, or `undefined` when it does not exist. */
  stat(path: string): Promise<FileStats | undefined>;
  /** Lists the entries of a directory (non-recursive). */
  listDir(path: string): Promise<readonly DirEntry[]>;
  /** Reads a file as UTF-8 text. Rejects for directories. */
  readFile(path: string): Promise<string>;
  /** Reads a file as raw bytes. Rejects for directories. */
  readBytes(path: string): Promise<Uint8Array>;
  /**
   * Expands glob patterns into matching paths. Patterns are resolved against
   * `cwd` and results are absolute unless `cwd` is provided relative to root.
   */
  glob(patterns: readonly string[], options?: GlobOptions): Promise<readonly string[]>;
  /** Resolves a path to its canonical real path. Rejects for broken symlinks. */
  realpath(path: string): Promise<string>;
  /** Reads the target of a symlink, or `undefined` for non-symlinks. */
  readLink?(path: string): Promise<string | undefined>;
  /** Writes a UTF-8 file (used by the scanner cache). Optional capability. */
  writeFile?(path: string, content: string): Promise<void>;
  /** Ensures a directory exists (used by the scanner cache). Optional capability. */
  ensureDir?(path: string): Promise<void>;
}
