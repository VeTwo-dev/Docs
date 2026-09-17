import { resolvePath } from "../../filesystem/index.js";
import { fileExists } from "../../filesystem/index.js";

/**
 * Syntactic module resolution for relative specifiers.
 *
 * This is deliberately NOT full Node resolution or semantic analysis — it only
 * maps `./x`, `../y` specifiers to resolved relative paths so the compiler
 * layer can build a syntactic dependency graph for incremental rebuilds.
 */

/** Whether `specifier` is a relative import (starts with `./` or `../`). */
export function isRelativeSpecifier(specifier: string): boolean {
  return (
    specifier === "." ||
    specifier === ".." ||
    specifier.startsWith("./") ||
    specifier.startsWith("../")
  );
}

function normalizePosix(input: string): string {
  const parts: string[] = [];
  for (const segment of input.replace(/\\/g, "/").split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") parts.pop();
    else parts.push(segment);
  }
  return parts.join("/");
}

function posixDirname(relative: string): string {
  const normalized = normalizePosix(relative);
  const slash = normalized.lastIndexOf("/");
  return slash < 0 ? "." : normalized.slice(0, slash) || ".";
}

function posixJoin(base: string, specifier: string): string {
  if (base === ".") return normalizePosix(specifier);
  return normalizePosix(`${base}/${specifier}`);
}

function candidatePaths(target: string, extensions: readonly string[]): readonly string[] {
  if (extensions.some((extension) => target.endsWith(extension))) return [target];
  const candidates: string[] = [];
  for (const extension of extensions) candidates.push(`${target}${extension}`);
  candidates.push(`${target}/index`);
  for (const extension of extensions) candidates.push(`${target}/index${extension}`);
  return candidates;
}

function toRelative(rootDir: string, absolute: string): string {
  return normalizePosix(absolute.slice(rootDir.length).replace(/^\/+/, "")) || ".";
}

/**
 * Resolves a relative specifier against the importer, returning the target's
 * relative path when a matching file is known. When `knownFiles` is provided,
 * existence is decided against that set (in-memory mode); otherwise the file
 * system is consulted.
 */
export function resolveRelativeTarget(
  rootDir: string,
  importerFile: string,
  specifier: string,
  extensions: readonly string[],
  knownFiles?: ReadonlySet<string>,
): string | undefined {
  if (!isRelativeSpecifier(specifier)) return undefined;
  const importerDir = posixDirname(importerFile);
  const target = posixJoin(importerDir, specifier);
  const exists = (candidate: string): boolean => {
    if (knownFiles !== undefined) return knownFiles.has(candidate);
    return fileExists(resolvePath(rootDir, ...candidate.split("/")));
  };
  for (const candidate of candidatePaths(target, extensions)) {
    if (exists(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Resolves and dedupes a set of raw specifiers for one importer.
 */
export function resolveSpecifiers(
  rootDir: string,
  importerFile: string,
  specifiers: readonly string[],
  extensions: readonly string[],
  knownFiles?: ReadonlySet<string>,
): readonly string[] {
  const resolved = new Set<string>();
  for (const specifier of specifiers) {
    const target = resolveRelativeTarget(rootDir, importerFile, specifier, extensions, knownFiles);
    if (target !== undefined) resolved.add(target);
  }
  return [...resolved].sort();
}

/** Converts an absolute path to a normalized relative path. */
export function toRelativePath(rootDir: string, absolute: string): string {
  return toRelative(rootDir, absolute);
}

export { normalizePosix, posixDirname };
