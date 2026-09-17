import type { FileModel } from "../models/file.js";
import type { ProjectModel } from "../models/project.js";

/** A file that was renamed/moved between scans. */
export interface RenameChange {
  /** The previous relative path. */
  readonly from: string;
  /** The new relative path. */
  readonly to: string;
  /** The current file model at the new path. */
  readonly file: FileModel;
}

/** Counts for each change category. */
export interface IncrementalDiffStats {
  readonly added: number;
  readonly removed: number;
  readonly modified: number;
  readonly renamed: number;
  readonly unchanged: number;
}

/** The difference between a previous and a current project index. */
export interface IncrementalDiff {
  readonly added: readonly FileModel[];
  readonly removed: readonly FileModel[];
  readonly modified: readonly FileModel[];
  readonly renamed: readonly RenameChange[];
  /** Relative paths of files whose content is unchanged. */
  readonly unchanged: readonly string[];
  readonly stats: IncrementalDiffStats;
}

/** Whether a file model carries a usable content hash. */
function hasHash(file: FileModel): file is FileModel & { readonly hash: string } {
  return typeof file.hash === "string" && file.hash.length > 0;
}

/**
 * Computes the difference between two project indexes.
 *
 * Renames are detected heuristically: a removed file and an added file are
 * paired when their content hashes match.
 *
 * @param previous - The older index.
 * @param current - The newer index.
 * @returns The computed diff.
 */
export function diffIndexes(previous: ProjectModel, current: ProjectModel): IncrementalDiff {
  const previousByPath = new Map(previous.files.map((file) => [file.relativePath, file]));
  const currentByPath = new Map(current.files.map((file) => [file.relativePath, file]));

  const added: FileModel[] = [];
  const removed: FileModel[] = [];
  const modified: FileModel[] = [];
  const unchanged: string[] = [];

  for (const file of current.files) {
    const old = previousByPath.get(file.relativePath);
    if (old === undefined) {
      added.push(file);
    } else if (hasHash(old) && hasHash(file)) {
      if (old.hash === file.hash) {
        unchanged.push(file.relativePath);
      } else {
        modified.push(file);
      }
    } else if (old.size === file.size && old.lastModified === file.lastModified) {
      unchanged.push(file.relativePath);
    } else {
      modified.push(file);
    }
  }

  for (const file of previous.files) {
    if (!currentByPath.has(file.relativePath)) {
      removed.push(file);
    }
  }

  const renamed: RenameChange[] = [];
  if (removed.length > 0 && added.length > 0) {
    const addedByHash = new Map<string, FileModel[]>();
    for (const file of added) {
      if (!hasHash(file)) continue;
      const bucket = addedByHash.get(file.hash) ?? [];
      bucket.push(file);
      addedByHash.set(file.hash, bucket);
    }

    const removedKept: FileModel[] = [];
    const addedKept = new Set(added);
    for (const old of removed) {
      if (!hasHash(old)) {
        removedKept.push(old);
        continue;
      }
      const bucket = addedByHash.get(old.hash);
      const candidate = bucket?.find((file) => addedKept.has(file));
      if (candidate) {
        addedKept.delete(candidate);
        renamed.push({ from: old.relativePath, to: candidate.relativePath, file: candidate });
      } else {
        removedKept.push(old);
      }
    }
    removed.length = 0;
    removed.push(...removedKept);
  }

  const cleanAdded = added.filter(
    (file) => !renamed.some((rename) => rename.to === file.relativePath),
  );

  return {
    added: cleanAdded,
    removed,
    modified,
    renamed,
    unchanged,
    stats: {
      added: cleanAdded.length,
      removed: removed.length,
      modified: modified.length,
      renamed: renamed.length,
      unchanged: unchanged.length,
    },
  };
}
