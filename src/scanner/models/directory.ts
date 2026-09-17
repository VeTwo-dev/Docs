import type { DirectoryCategory } from "../types/categories.js";

/** An immutable model of a scanned directory. */
export interface DirectoryModel {
  /** Stable identifier derived from the relative path. */
  readonly id: string;
  /** Absolute path of the directory. */
  readonly path: string;
  /** Path relative to the project root (POSIX, `.` for the root). */
  readonly relativePath: string;
  /** Directory basename (`.` for the root). */
  readonly name: string;
  /** The directory's parent (`.` for the root). */
  readonly parent: string;
  /** Depth relative to the project root (root is 0). */
  readonly depth: number;
  /** Detected purpose of the directory. */
  readonly category: DirectoryCategory;
  /** Number of immediate child directories. */
  readonly childDirectories: number;
  /** Number of immediate child files. */
  readonly childFiles: number;
  /** Total bytes of all direct child files. */
  readonly directBytes: number;
  /** Whether the directory was excluded by ignore rules. */
  readonly ignored: boolean;
  /** Extra metadata (provider-specific, plugin-supplied). */
  readonly metadata: Readonly<Record<string, unknown>>;
}

/** Input required to build a {@link DirectoryModel}. */
export interface DirectoryModelInput {
  readonly path: string;
  readonly relativePath: string;
  readonly name: string;
  readonly parent: string;
  readonly depth: number;
  readonly category: DirectoryCategory;
  readonly childDirectories?: number;
  readonly childFiles?: number;
  readonly directBytes?: number;
  readonly ignored?: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Builds an immutable, frozen {@link DirectoryModel}. */
export function createDirectoryModel(input: DirectoryModelInput): DirectoryModel {
  return Object.freeze({
    id: input.relativePath,
    path: input.path,
    relativePath: input.relativePath,
    name: input.name,
    parent: input.parent,
    depth: input.depth,
    category: input.category,
    childDirectories: input.childDirectories ?? 0,
    childFiles: input.childFiles ?? 0,
    directBytes: input.directBytes ?? 0,
    ignored: input.ignored ?? false,
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}
