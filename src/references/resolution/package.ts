import { isRelativeSpecifier } from "../../compiler/index.js";
import type { PackageInfo } from "../../types/public.js";

/**
 * Module, package and workspace specifier resolution for the reference layer.
 *
 * Relative specifiers are resolved against known module files through the
 * compiler layer's helper. Bare specifiers are classified as workspace
 * packages (when they match a discovered workspace) or external packages, and
 * resolved against package metadata when available.
 */

/** The classification of a module specifier. */
export type SpecifierClass = "module" | "workspace" | "package" | "unknown";

/**
 * Extracts the package name from a bare specifier.
 *
 * Handles scoped packages (`@scope/pkg`), scoped subpaths
 * (`@scope/pkg/sub/path`) and unscoped subpaths (`pkg/sub/path`).
 */
export function packageNameOf(specifier: string): string | undefined {
  const trimmed = specifier.trim();
  if (trimmed.length === 0 || isRelativeSpecifier(trimmed) || trimmed.startsWith("#")) {
    return undefined;
  }
  const parts = trimmed.split("/").filter((part) => part.length > 0);
  if (parts.length === 0) return undefined;
  const first = parts[0]!;
  if (first.startsWith("@")) {
    return parts.length >= 2 ? `${first}/${parts[1]}` : undefined;
  }
  return first;
}

/**
 * Classifies a specifier against the known workspace package names.
 *
 * - relative/same-directory specifiers → `module`
 * - specifiers whose package name matches a workspace package → `workspace`
 * - other bare specifiers → `package`
 * - anything else → `unknown`
 */
export function classifySpecifier(
  specifier: string,
  workspaceNames: ReadonlySet<string>,
): SpecifierClass {
  if (specifier.length === 0) return "unknown";
  if (isRelativeSpecifier(specifier)) return "module";
  const name = packageNameOf(specifier);
  if (name === undefined) return "unknown";
  if (workspaceNames.has(name)) return "workspace";
  return "package";
}

/** The names of every discovered workspace package. */
export function workspacePackageNames(packages: readonly PackageInfo[]): ReadonlySet<string> {
  return new Set(packages.map((pkg) => pkg.name));
}

/** Resolves a package by exact name from the discovered packages. */
export function resolvePackage(
  packages: readonly PackageInfo[],
  specifier: string,
): PackageInfo | undefined {
  const name = packageNameOf(specifier);
  if (name === undefined) return undefined;
  return packages.find((pkg) => pkg.name === name);
}

/**
 * Whether a package exports the given subpath.
 *
 * Honors both string exports maps (`"./x": "./x.js"`) and conditional object
 * maps (`"./x": { import, require, types }`), plus the implicit root.
 */
export function packageExportsSubpath(
  pkg: PackageInfo,
  specifier: string,
): { exported: boolean; target: string | undefined } {
  const name = packageNameOf(specifier);
  if (name === undefined) return { exported: false, target: undefined };
  if (specifier === name) {
    return { exported: true, target: pkg.main ?? pkg.module ?? pkg.types };
  }
  if (pkg.exports === undefined) {
    return { exported: true, target: undefined };
  }
  const subpath = `./${specifier.slice(name.length).replace(/^\//, "")}`;
  const entry = pkg.exports[subpath];
  if (entry === undefined) return { exported: false, target: undefined };
  if (typeof entry === "string") return { exported: true, target: entry };
  return { exported: true, target: entry.types ?? entry.import ?? entry.require };
}
