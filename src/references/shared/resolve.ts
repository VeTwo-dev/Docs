import { isRelativeSpecifier, resolveRelativeTarget } from "../../compiler/index.js";

/**
 * Syntactic module specifier resolution for the reference layer.
 *
 * Relative specifiers are resolved against the known module files through the
 * compiler layer's helper; bare specifiers (external packages) intentionally
 * never resolve — the graph records them as unresolved module references.
 */

/** Whether a specifier points into the project (`./x`, `../y`, `.`). */
export function isProjectSpecifier(specifier: string): boolean {
  return isRelativeSpecifier(specifier);
}

/**
 * Resolves a specifier against an importing file into a relative target file,
 * or undefined when the target is not among the known files.
 */
export function resolveSpecifierToFile(
  rootDir: string,
  fromFile: string,
  specifier: string,
  extensions: readonly string[],
  knownFiles: ReadonlySet<string>,
): string | undefined {
  return resolveRelativeTarget(rootDir, fromFile, specifier, extensions, knownFiles);
}

/** Splits a dotted reference name into parts (e.g. `NS.Type` → `NS`, `Type`). */
export function nameParts(name: string): readonly string[] {
  return name.split(".").filter((part) => part.length > 0);
}
