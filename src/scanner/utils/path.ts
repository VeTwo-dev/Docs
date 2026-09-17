import {
  basename,
  dirname,
  extname,
  isAbsolute,
  normalize,
  relative,
  resolve,
  sep,
} from "node:path";

/**
 * Normalises a path to POSIX separators. Safe on every platform — Windows
 * paths use `\` which become `/`, POSIX paths are untouched.
 *
 * @param path - The path to normalise.
 * @returns The POSIX-normalised path.
 */
export function toPosixPath(path: string): string {
  return path.split(sep).join("/");
}

/**
 * Normalises a path and converts it to POSIX separators.
 *
 * @param path - The path to normalise.
 * @returns The normalised POSIX path.
 */
export function normalizePath(path: string): string {
  return toPosixPath(normalize(path));
}

/**
 * Computes the relative path of `abs` with respect to `root`, in POSIX form.
 *
 * @param root - The ancestor directory.
 * @param abs - The absolute path.
 * @returns The relative POSIX path.
 */
export function toRelativePath(root: string, abs: string): string {
  return toPosixPath(relative(root, abs));
}

/**
 * Joins path segments and returns a POSIX-normalised path.
 *
 * @param parts - The segments to join.
 * @returns The joined POSIX path.
 */
export function joinPosix(...parts: string[]): string {
  return parts.map((part) => toPosixPath(part)).join("/");
}

/**
 * Returns the file extension including the leading dot.
 *
 * @param path - The file path.
 * @returns The extension (e.g. `.ts`), or `""` when the file has none.
 */
export function getExtension(path: string): string {
  return extname(path);
}

/** Returns the basename of a path. */
export function getBasename(path: string): string {
  return basename(path);
}

/** Returns the directory portion of a path. */
export function getDirname(path: string): string {
  return dirname(path);
}

/**
 * Strips the extension from a file name.
 *
 * @param name - The file name.
 * @returns The file name without its extension.
 */
export function getFileNameWithoutExtension(name: string): string {
  const ext = extname(name);
  return ext.length > 0 ? name.slice(0, -ext.length) : name;
}

/**
 * Resolves a path relative to a base directory.
 *
 * @param base - The base directory.
 * @param path - The relative or absolute path.
 * @returns The resolved absolute path.
 */
export function resolvePath(base: string, path: string): string {
  return resolve(base, path);
}

/**
 * Resolves a path relative to a base directory and validates it stays within
 * the base. Prevents path traversal attacks (e.g., `../../etc/passwd`).
 *
 * @param base - The base directory that must contain the resolved path.
 * @param path - The relative or absolute path to resolve.
 * @returns The resolved absolute path.
 * @throws If the resolved path escapes the base directory.
 */
export function resolvePathSafe(base: string, path: string): string {
  const resolved = resolve(base, path);
  const normalizedBase = resolve(base);
  const normalizedResolved = resolve(resolved);
  if (!normalizedResolved.startsWith(normalizedBase)) {
    throw new Error(`Path traversal detected: "${path}" resolves outside "${base}"`);
  }
  return resolved;
}

/**
 * Checks whether `child` is inside `parent`.
 *
 * @param parent - The candidate parent directory.
 * @param child - The candidate child path.
 * @returns `true` when `child` is strictly inside `parent`.
 */
export function isSubPath(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

/**
 * Returns the immediate parent segment of a relative path.
 *
 * @param relativePath - A POSIX relative path.
 * @returns The parent segment (`.` for the root).
 */
export function relativeDir(relativePath: string): string {
  const idx = relativePath.lastIndexOf("/");
  return idx === -1 ? "." : relativePath.slice(0, idx) || ".";
}
