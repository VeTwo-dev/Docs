import type { PackageManager, ProjectType, WorkspaceInfo, PackageInfo } from "../types/public.js";
import type { PackageJson } from "pkg-types";
import { existsSync, readFileSync } from "node:fs";
import { join } from "pathe";
import { detect as detectPackageManagerAsync } from "detect-package-manager";

function readPackageJson(rootDir: string): PackageJson | undefined {
  const pkgPath = join(rootDir, "package.json");
  if (!existsSync(pkgPath)) return undefined;
  try {
    return JSON.parse(readFileSync(pkgPath, "utf-8")) as PackageJson;
  } catch {
    return undefined;
  }
}

/**
 * Detects the package manager used by a project.
 *
 * Uses `detect-package-manager` for accurate detection (respects the
 * `packageManager` field, lock files, and environment). Falls back to
 * `"npm"` when nothing else matches.
 *
 * @param rootDir - The project root directory.
 * @returns The detected package manager.
 *
 * @example
 * ```ts
 * const pm = await detectPackageManager("/project");
 * ```
 */
export async function detectPM(rootDir: string): Promise<PackageManager> {
  try {
    const result = await detectPackageManagerAsync({ cwd: rootDir });
    return result as PackageManager;
  } catch {
    return "npm";
  }
}

/**
 * Detects the package manager used by a project by checking for lock files.
 *
 * This is the synchronous variant used when async detection is not available.
 *
 * @param rootDir - The project root directory.
 * @returns The detected package manager (defaults to `"npm"`).
 *
 * @example
 * ```ts
 * const pm = detectPackageManager("/project");
 * ```
 */
export function detectPackageManager(rootDir: string): PackageManager {
  if (existsSync(join(rootDir, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(rootDir, "yarn.lock"))) return "yarn";
  if (existsSync(join(rootDir, "bun.lockb"))) return "bun";
  if (existsSync(join(rootDir, "package-lock.json"))) return "npm";

  const pkg = readPackageJson(rootDir);
  if (pkg?.packageManager) {
    const pm = pkg.packageManager.split("@")[0];
    if (pm === "pnpm" || pm === "yarn" || pm === "bun" || pm === "npm") {
      return pm;
    }
  }

  return "npm";
}

/**
 * Detects the project type by inspecting `package.json` for workspaces,
 * framework dependencies, and build scripts.
 *
 * @param rootDir - The project root directory.
 * @returns The detected project type.
 *
 * @example
 * ```ts
 * const type = detectProjectType("/project");
 * ```
 */
export function detectProjectType(rootDir: string): ProjectType {
  const pkg = readPackageJson(rootDir);
  if (!pkg) return "unknown";

  const hasWorkspaces = pkg.workspaces !== undefined;
  if (hasWorkspaces) return "monorepo";

  const hasBin =
    pkg.scripts?.["build"] !== undefined || existsSync(join(rootDir, "src", "index.ts"));
  const hasFramework = [
    "next",
    "nuxt",
    "astro",
    "gatsby",
    "remix",
    "express",
    "fastify",
    "nest.js",
    "@nestjs/core",
  ].some(
    (dep) => pkg.dependencies?.[dep] !== undefined || pkg.devDependencies?.[dep] !== undefined,
  );

  if (hasFramework) return "application";
  if (hasBin) return "library";

  return "unknown";
}

/**
 * Reads workspace glob patterns from `package.json` workspaces field.
 * Supports both array and object (`{ packages: ... }`) formats.
 *
 * @param rootDir - The project root directory.
 * @returns An array of workspace glob patterns, or an empty array if none exist.
 *
 * @example
 * ```ts
 * const workspaces = detectWorkspaces("/monorepo");
 * ```
 */
export function detectWorkspaces(rootDir: string): readonly string[] {
  const pkg = readPackageJson(rootDir);
  if (!pkg?.workspaces) return [];

  if (Array.isArray(pkg.workspaces)) {
    return pkg.workspaces;
  }
  return pkg.workspaces.packages ?? [];
}

/**
 * Gets workspace-level information from a monorepo root. Returns `undefined` if the
 * project is not a workspace.
 *
 * @param rootDir - The project root directory.
 * @param packageManager - The detected package manager.
 * @returns Workspace information or `undefined`.
 *
 * @example
 * ```ts
 * const info = getWorkspaceInfo("/monorepo", "pnpm");
 * ```
 */
export function getWorkspaceInfo(
  rootDir: string,
  packageManager: PackageManager,
): WorkspaceInfo | undefined {
  const pkg = readPackageJson(rootDir);
  if (!pkg) return undefined;

  const workspaces = detectWorkspaces(rootDir);
  if (workspaces.length === 0) return undefined;

  return {
    name: pkg.name ?? "unknown",
    version: pkg.version ?? "0.0.0",
    path: rootDir,
    packageManager,
    workspaces,
  };
}

/**
 * Discovers packages in the project by resolving workspace glob patterns.
 * If no workspace globs are provided, reads the root `package.json` as a single package.
 *
 * @param rootDir - The project root directory.
 * @param workspaceGlobs - Glob patterns for workspace directories.
 * @returns An array of discovered {@link PackageInfo}.
 *
 * @example
 * ```ts
 * const packages = discoverPackages("/monorepo", ["packages/*"]);
 * ```
 */
export function discoverPackages(
  rootDir: string,
  workspaceGlobs: readonly string[],
): readonly PackageInfo[] {
  const packages: PackageInfo[] = [];

  if (workspaceGlobs.length === 0) {
    const pkg = readPackageJson(rootDir);
    if (pkg?.name) {
      packages.push(createPackageInfo(pkg, rootDir));
    }
    return packages;
  }

  for (const pattern of workspaceGlobs) {
    const isExactPath = !pattern.includes("*") && !pattern.includes("{");
    if (isExactPath) {
      const pkgPath = join(rootDir, pattern, "package.json");
      if (existsSync(pkgPath)) {
        const pkg = readPackageJson(join(rootDir, pattern));
        if (pkg) {
          packages.push(createPackageInfo(pkg, join(rootDir, pattern)));
        }
      }
    }
  }

  return packages;
}

function createPackageInfo(pkg: PackageJson, path: string): PackageInfo {
  const exports = pkg.exports as
    Record<string, string | { import?: string; types?: string; require?: string }> | undefined;

  return {
    name: pkg.name ?? "unknown",
    version: pkg.version ?? "0.0.0",
    description: pkg.description ?? "",
    path,
    main: pkg.main,
    module: pkg.module,
    types: pkg.types,
    exports,
    files: pkg.files ?? [],
    dependencies: pkg.dependencies,
    devDependencies: pkg.devDependencies,
    peerDependencies: pkg.peerDependencies,
    optionalDependencies: pkg.optionalDependencies,
  };
}

/**
 * Checks whether the project has a `tsconfig.json` file.
 *
 * @param rootDir - The project root directory.
 * @returns `true` if TypeScript configuration exists.
 *
 * @example
 * ```ts
 * const hasTs = detectTypeScript("/project");
 * ```
 */
export function detectTypeScript(rootDir: string): boolean {
  return existsSync(join(rootDir, "tsconfig.json"));
}

/**
 * Checks whether the project has a `.git` directory.
 *
 * @param rootDir - The project root directory.
 * @returns `true` if the project is a Git repository.
 *
 * @example
 * ```ts
 * const isGit = detectGit("/project");
 * ```
 */
export function detectGit(rootDir: string): boolean {
  return existsSync(join(rootDir, ".git"));
}

/**
 * Finds the README file in the project root by trying common file names.
 *
 * @param rootDir - The project root directory.
 * @returns The absolute path to the README file, or `undefined` if none found.
 *
 * @example
 * ```ts
 * const readmePath = detectReadme("/project");
 * ```
 */
export function detectReadme(rootDir: string): string | undefined {
  const candidates = ["README.md", "readme.md", "Readme.md", "README.mdx", "README"];
  for (const name of candidates) {
    const path = join(rootDir, name);
    if (existsSync(path)) return path;
  }
  return undefined;
}

/**
 * Finds the CHANGELOG file in the project root by trying common file names.
 *
 * @param rootDir - The project root directory.
 * @returns The absolute path to the CHANGELOG file, or `undefined` if none found.
 *
 * @example
 * ```ts
 * const changelogPath = detectChangelog("/project");
 * ```
 */
export function detectChangelog(rootDir: string): string | undefined {
  const candidates = ["CHANGELOG.md", "changelog.md", "CHANGELOG", "CHANGES.md"];
  for (const name of candidates) {
    const path = join(rootDir, name);
    if (existsSync(path)) return path;
  }
  return undefined;
}

/** The result of a full project detection scan. */
export interface ProjectDetection {
  readonly rootDir: string;
  readonly packageManager: PackageManager;
  readonly projectType: ProjectType;
  readonly workspaceInfo: WorkspaceInfo | undefined;
  readonly packages: readonly PackageInfo[];
  readonly hasTypeScript: boolean;
  readonly hasGit: boolean;
  readonly readmePath: string | undefined;
  readonly changelogPath: string | undefined;
}

/**
 * Runs all detection heuristics on a project root and returns a comprehensive
 * {@link ProjectDetection} result.
 *
 * @param rootDir - The project root directory.
 * @returns The full project detection result.
 *
 * @example
 * ```ts
 * const detection = detectProject("/project");
 * console.log(detection.projectType);
 * ```
 */
export function detectProject(rootDir: string): ProjectDetection {
  const packageManager = detectPackageManager(rootDir);
  const projectType = detectProjectType(rootDir);
  const workspaceGlobs = detectWorkspaces(rootDir);
  const workspaceInfo = getWorkspaceInfo(rootDir, packageManager);
  const packages = discoverPackages(rootDir, workspaceGlobs);

  return {
    rootDir,
    packageManager,
    projectType,
    workspaceInfo,
    packages,
    hasTypeScript: detectTypeScript(rootDir),
    hasGit: detectGit(rootDir),
    readmePath: detectReadme(rootDir),
    changelogPath: detectChangelog(rootDir),
  };
}
