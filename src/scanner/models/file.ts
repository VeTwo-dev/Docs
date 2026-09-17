import type { FileCategory, Visibility } from "../types/categories.js";

/**
 * An immutable model of a scanned file.
 *
 * All paths are forward-slash separated. `path` is absolute, `relativePath`
 * is relative to the project root and `dir` is the relative parent directory
 * (`.` for the root).
 */
export interface FileModel {
  /** Stable identifier derived from the relative path. */
  readonly id: string;
  /** Absolute path of the file. */
  readonly path: string;
  /** Path relative to the project root (POSIX). */
  readonly relativePath: string;
  /** File basename. */
  readonly name: string;
  /** Extension including the leading dot (empty when the file has none). */
  readonly extension: string;
  /** Relative parent directory (`.` when the file is at the root). */
  readonly dir: string;
  /** File size in bytes. */
  readonly size: number;
  /** Last-modified time (epoch ms). */
  readonly lastModified: number;
  /** Creation time (epoch ms). */
  readonly createdAt: number;
  /** Content hash (sha-1 hex), when metadata collection is enabled. */
  readonly hash?: string;
  /** Detected programming/markup language. */
  readonly language: string;
  /** Detected file category. */
  readonly category: FileCategory;
  /** Whether the file is considered generated output. */
  readonly generated: boolean;
  /** Whether the file is a symlink. */
  readonly symlink: boolean;
  /** Whether the file was excluded by ignore rules. */
  readonly ignored: boolean;
  /** How the file is tracked by the index. */
  readonly visibility: Visibility;
  /** Extra metadata (provider-specific, plugin-supplied). */
  readonly metadata: Readonly<Record<string, unknown>>;
}

/** Input required to classify a file into a {@link FileModel}. */
export interface FileModelInput {
  readonly path: string;
  readonly relativePath: string;
  readonly name: string;
  readonly extension: string;
  readonly dir: string;
  readonly size: number;
  readonly lastModified: number;
  readonly createdAt: number;
  readonly hash?: string;
  readonly language: string;
  readonly category: FileCategory;
  readonly generated: boolean;
  readonly symlink?: boolean;
  readonly ignored?: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Builds an immutable, frozen {@link FileModel}. */
export function createFileModel(input: FileModelInput): FileModel {
  return Object.freeze({
    id: input.relativePath.replace(/^\.\//, ""),
    path: input.path,
    relativePath: input.relativePath,
    name: input.name,
    extension: input.extension,
    dir: input.dir,
    size: input.size,
    lastModified: input.lastModified,
    createdAt: input.createdAt,
    ...(input.hash !== undefined ? { hash: input.hash } : {}),
    language: input.language,
    category: input.category,
    generated: input.generated,
    symlink: input.symlink ?? false,
    ignored: input.ignored ?? false,
    visibility: input.ignored ? "excluded" : "included",
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}
