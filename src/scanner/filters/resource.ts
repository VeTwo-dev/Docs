import type { ResourceKind } from "../types/categories.js";
import { matchPath } from "../utils/glob.js";
import { toPosixPath } from "../utils/path.js";

/** Default maximum file size in bytes (5 MB). */
const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Filters applied on top of ignore rules during a scan. */
export interface ResourceFilter {
  /** When set, only resources matching at least one pattern are included. */
  readonly include?: readonly string[];
  /** Resources matching any pattern are excluded. */
  readonly exclude?: readonly string[];
  /** Maximum directory depth (root is 0). */
  readonly maxDepth?: number;
  /** The kinds of resources to collect. */
  readonly resourceKinds?: readonly ResourceKind[];
  /** Maximum file size in bytes. Files exceeding this are skipped. Defaults to 5 MB. */
  readonly maxFileSize?: number;
}

/** Options for building a {@link ResourceFilter}. */
export interface ResourceFilterOptions {
  readonly include?: readonly string[];
  readonly exclude?: readonly string[];
  readonly maxDepth?: number;
  readonly resourceKinds?: readonly ResourceKind[];
  readonly maxFileSize?: number;
}

/** Builds a resource filter from options. */
export function createResourceFilter(options: ResourceFilterOptions = {}): ResourceFilter {
  return {
    ...(options.include !== undefined ? { include: [...options.include] } : {}),
    ...(options.exclude !== undefined ? { exclude: [...options.exclude] } : {}),
    ...(options.maxDepth !== undefined ? { maxDepth: options.maxDepth } : {}),
    ...(options.resourceKinds !== undefined ? { resourceKinds: [...options.resourceKinds] } : {}),
    ...(options.maxFileSize !== undefined ? { maxFileSize: options.maxFileSize } : {}),
  };
}

/**
 * Decides whether a resource passes the include/exclude/depth filters.
 *
 * @param relativePath - The resource path relative to the project root.
 * @param isDirectory - Whether the resource is a directory.
 * @param depth - The directory depth (root is 0).
 * @param filter - The active filter.
 * @param fileSize - The file size in bytes (optional, checked against maxFileSize).
 * @returns `true` when the resource should be included.
 */
export function shouldIncludeResource(
  relativePath: string,
  _isDirectory: boolean,
  depth: number,
  filter: ResourceFilter,
  fileSize?: number,
): boolean {
  const path = toPosixPath(relativePath).replace(/^\.\//, "");

  if (filter.maxDepth !== undefined && depth > filter.maxDepth) return false;

  const maxFileSize = filter.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
  if (fileSize !== undefined && fileSize > maxFileSize) return false;

  if (filter.include !== undefined && filter.include.length > 0) {
    const included = filter.include.some((pattern) => matchPath(pattern, path, { dot: true }));
    if (!included) return false;
  }

  if (filter.exclude !== undefined && filter.exclude.length > 0) {
    const excluded = filter.exclude.some((pattern) => matchPath(pattern, path, { dot: true }));
    if (excluded) return false;
  }

  return true;
}

/** Whether a resource kind should be collected. */
export function shouldCollectKind(kind: ResourceKind, filter: ResourceFilter): boolean {
  if (filter.resourceKinds === undefined || filter.resourceKinds.length === 0) return true;
  return filter.resourceKinds.includes(kind);
}
