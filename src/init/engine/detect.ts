import type { SafeFileSystem } from "../filesystem/interface.js";
import type { DetectedProject, DetectedPackage } from "../types/workspace.js";
import { CONFIG_FILE_NAMES } from "../../constants/defaults.js";

/** Candidate documentation directories that may already exist. */
export const ALTERNATIVE_DOC_DIRS = [
  "docs",
  "wiki",
  "documentation",
  "docs-site",
  "website",
] as const;

/** Data extracted from an existing `package.json` when present. */
export interface PackageMeta {
  readonly name?: string;
  readonly description?: string;
  readonly workspaces?: unknown;
}

/** Read a project's `package.json` through the filesystem seam. */
export function readPackageMeta(fs: SafeFileSystem, root: string): PackageMeta {
  const pkgPath = fs.join(root, "package.json");
  if (!fs.isFile(pkgPath)) return {};
  try {
    const parsed = JSON.parse(fs.readFile(pkgPath)) as PackageMeta;
    return parsed;
  } catch {
    return {};
  }
}

function detectPackageManager(fs: SafeFileSystem, root: string): string {
  const lockfiles: Array<[string, string]> = [
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["bun.lock", "bun"],
    ["bun.lockb", "bun"],
    ["package-lock.json", "npm"],
    ["npm-shrinkwrap.json", "npm"],
  ];
  for (const [file, manager] of lockfiles) {
    if (fs.isFile(fs.join(root, file))) return manager;
  }
  return "npm";
}

function detectTypeScript(fs: SafeFileSystem, root: string): boolean {
  return fs.isFile(fs.join(root, "tsconfig.json"));
}

function detectGit(fs: SafeFileSystem, root: string): boolean {
  return fs.isDirectory(fs.join(root, ".git"));
}

function detectReadme(fs: SafeFileSystem, root: string): string | undefined {
  for (const name of ["README.md", "readme.md", "Readme.md"]) {
    if (fs.isFile(fs.join(root, name))) return fs.join(root, name);
  }
  return undefined;
}

function detectChangelog(fs: SafeFileSystem, root: string): string | undefined {
  for (const name of ["CHANGELOG.md", "changelog.md", "CHANGES.md"]) {
    if (fs.isFile(fs.join(root, name))) return fs.join(root, name);
  }
  return undefined;
}

/** Discover workspace packages via simple workspace glob expansion. */
function discoverPackages(
  fs: SafeFileSystem,
  root: string,
  workspaces: unknown,
): DetectedPackage[] {
  const packages: DetectedPackage[] = [];
  if (!Array.isArray(workspaces)) return packages;
  const globs = workspaces.filter((g): g is string => typeof g === "string");
  for (const pattern of globs) {
    const base = pattern.replace(/\/\*+\/?$/, "").replace(/^\*\/?/, ".");
    const dir = fs.join(root, base);
    if (!fs.isDirectory(dir)) continue;
    for (const name of fs.listDir(dir)) {
      const pkgPath = fs.join(dir, name, "package.json");
      if (!fs.isFile(pkgPath)) continue;
      try {
        const meta = JSON.parse(fs.readFile(pkgPath)) as PackageMeta;
        if (meta.name) packages.push({ name: meta.name, description: meta.description });
      } catch {
        // ignore malformed package manifests
      }
    }
  }
  return packages;
}

/**
 * Detects project metadata through the filesystem seam. Mirrors the
 * information `detectProject` provides but works against in-memory roots.
 */
export function detectProjectInfo(fs: SafeFileSystem, root: string): DetectedProject {
  const pkg = readPackageMeta(fs, root);
  const isMonorepo =
    fs.isFile(fs.join(root, "pnpm-workspace.yaml")) ||
    fs.isFile(fs.join(root, "lerna.json")) ||
    (Array.isArray(pkg.workspaces) && pkg.workspaces.length > 0);
  const packages = isMonorepo ? discoverPackages(fs, root, pkg.workspaces) : [];
  return {
    rootDir: root,
    name: pkg.name ?? "My Project",
    description: pkg.description ?? "",
    projectType: isMonorepo ? "monorepo" : "library",
    packageManager: detectPackageManager(fs, root),
    packages,
    hasTypeScript: detectTypeScript(fs, root),
    hasGit: detectGit(fs, root),
    readmePath: detectReadme(fs, root),
    changelogPath: detectChangelog(fs, root),
  };
}

/** Find an existing documentation configuration file. */
export function findConfigFile(fs: SafeFileSystem, root: string): string | undefined {
  for (const name of CONFIG_FILE_NAMES) {
    const candidate = fs.join(root, name);
    if (fs.isFile(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Resolve the project root: explicit option wins, otherwise walk up from the
 * start directory to the nearest `package.json` / workspace marker.
 */
export function resolveProjectRoot(
  fs: SafeFileSystem,
  options: { rootDir?: string; cwd?: string },
): string {
  if (options.rootDir !== undefined) return options.rootDir;
  let dir = options.cwd ?? process.cwd();
  if (!fs.isDirectory(dir)) dir = "/";
  // Walk up to find a package.json or workspace marker.
  let current = dir;
  while (true) {
    if (
      fs.isFile(fs.join(current, "package.json")) ||
      fs.isFile(fs.join(current, "pnpm-workspace.yaml")) ||
      fs.isFile(fs.join(current, "lerna.json"))
    ) {
      return current;
    }
    const parent = fs.join(current, "..");
    if (parent === current) break;
    current = parent;
  }
  return dir;
}
