import type { PackageManager } from "../../types/public.js";
import { normalizePackageManager } from "../classifiers/project-classifier.js";
import type { ScannerProvider } from "../providers/types.js";
import type { WorkspaceKind } from "../types/categories.js";
import { toPosixPath, toRelativePath } from "../utils/path.js";

/** The result of workspace detection. */
export interface WorkspaceDetection {
  readonly kind: WorkspaceKind;
  readonly packageManager: PackageManager;
  /** Workspace manifest path relative to the root, when present. */
  readonly configPath?: string;
  /** Workspace glob patterns. */
  readonly patterns: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;
}

/** Workspace-defining tool manifests, in detection priority order. */
const WORKSPACE_MANIFESTS: readonly { readonly file: string; readonly kind: WorkspaceKind }[] = [
  { file: "pnpm-workspace.yaml", kind: "pnpm" },
  { file: "lerna.json", kind: "lerna" },
  { file: "nx.json", kind: "nx" },
  { file: "turbo.json", kind: "turbo" },
  { file: "rush.json", kind: "rush" },
  { file: "moon.yml", kind: "moonrepo" },
  { file: ".moon/toolchain.yml", kind: "moonrepo" },
];

/** Reads a small JSON file, returning `undefined` on any failure. */
export async function readJsonFile(
  provider: ScannerProvider,
  path: string,
): Promise<Readonly<Record<string, unknown>> | undefined> {
  try {
    const content = await provider.readFile(path);
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined;
    return parsed as Readonly<Record<string, unknown>>;
  } catch {
    return undefined;
  }
}

/** Extracts workspace patterns from a `package.json` workspaces field. */
export function extractWorkspacesField(pkg: Readonly<Record<string, unknown>>): readonly string[] {
  const workspaces = pkg["workspaces"];
  if (Array.isArray(workspaces)) {
    return workspaces.filter((entry): entry is string => typeof entry === "string");
  }
  if (typeof workspaces === "object" && workspaces !== null) {
    const packages = (workspaces as Readonly<Record<string, unknown>>)["packages"];
    if (Array.isArray(packages)) {
      return packages.filter((entry): entry is string => typeof entry === "string");
    }
  }
  return [];
}

function trimQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, "");
}

/** Crudely extracts a top-level YAML list under the given key. */
export function extractYamlList(content: string, key: string): readonly string[] {
  const out: string[] = [];
  let inSection = false;
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (inSection) {
      if (line.startsWith("- ")) {
        out.push(trimQuotes(line.slice(2).trim()));
      } else if (line !== "" && !line.startsWith("#")) {
        inSection = false;
      }
    } else if (line === `${key}:` || line.startsWith(`${key}: `)) {
      inSection = true;
    }
  }
  return out;
}

/** Reads workspace patterns for a specific workspace kind. */
async function readWorkspacePatterns(
  provider: ScannerProvider,
  rootDir: string,
  kind: WorkspaceKind,
  file: string,
): Promise<readonly string[]> {
  const path = toPosixPath(`${rootDir}/${file}`);
  if (kind === "pnpm" || kind === "moonrepo") {
    try {
      const content = await provider.readFile(path);
      return kind === "moonrepo"
        ? extractYamlList(content, "projects")
        : extractYamlList(content, "packages");
    } catch {
      return [];
    }
  }
  if (kind === "lerna") {
    const json = await readJsonFile(provider, path);
    const packages = json?.["packages"];
    if (Array.isArray(packages)) {
      return packages.filter((entry): entry is string => typeof entry === "string");
    }
    return [];
  }
  if (kind === "rush") {
    const json = await readJsonFile(provider, path);
    const projects = json?.["projects"];
    if (Array.isArray(projects)) {
      return projects
        .map((project) => {
          if (typeof project !== "object" || project === null) return undefined;
          const folder = (project as Readonly<Record<string, unknown>>)["projectFolder"];
          return typeof folder === "string" ? folder : undefined;
        })
        .filter((folder): folder is string => folder !== undefined);
    }
    return [];
  }
  return [];
}

/** Reads extra workspace metadata for a specific workspace kind. */
async function readWorkspaceMetadata(
  provider: ScannerProvider,
  rootDir: string,
  kind: WorkspaceKind,
  file: string,
): Promise<Readonly<Record<string, unknown>>> {
  const path = toPosixPath(`${rootDir}/${file}`);
  if (kind === "lerna" || kind === "rush" || kind === "nx") {
    const json = await readJsonFile(provider, path);
    return json ?? {};
  }
  if (kind === "pnpm") {
    try {
      const content = await provider.readFile(path);
      const catalogs = extractYamlList(content, "catalog");
      return catalogs.length > 0 ? { catalog: catalogs } : {};
    } catch {
      return {};
    }
  }
  return {};
}

/** Detects the package manager from lock files and the `packageManager` field. */
export async function detectPackageManager(
  provider: ScannerProvider,
  rootDir: string,
): Promise<PackageManager> {
  if (await provider.isFile(toPosixPath(`${rootDir}/pnpm-lock.yaml`))) return "pnpm";
  if (await provider.isFile(toPosixPath(`${rootDir}/yarn.lock`))) return "yarn";
  if (await provider.isFile(toPosixPath(`${rootDir}/bun.lockb`))) return "bun";
  if (await provider.isFile(toPosixPath(`${rootDir}/bun.lock`))) return "bun";
  if (await provider.isFile(toPosixPath(`${rootDir}/package-lock.json`))) return "npm";

  const pkg = await readJsonFile(provider, toPosixPath(`${rootDir}/package.json`));
  const field = pkg?.["packageManager"];
  if (typeof field === "string") {
    const candidate = field.split("@")[0] ?? "";
    if (
      candidate === "pnpm" ||
      candidate === "yarn" ||
      candidate === "bun" ||
      candidate === "npm"
    ) {
      return candidate;
    }
  }
  return normalizePackageManager(undefined, "npm");
}

/**
 * Detects the workspace layout of a project root.
 *
 * Supports pnpm, npm, yarn, bun, lerna, nx, turbo, rush and moonrepo layouts.
 *
 * @param provider - The resource provider.
 * @param rootDir - The project root.
 * @returns The workspace detection result.
 */
export async function detectWorkspaceKind(
  provider: ScannerProvider,
  rootDir: string,
): Promise<WorkspaceDetection> {
  for (const { file, kind } of WORKSPACE_MANIFESTS) {
    if (await provider.isFile(toPosixPath(`${rootDir}/${file}`))) {
      const [patterns, metadata] = await Promise.all([
        readWorkspacePatterns(provider, rootDir, kind, file),
        readWorkspaceMetadata(provider, rootDir, kind, file),
      ]);
      return {
        kind,
        packageManager: await detectPackageManager(provider, rootDir),
        configPath: file,
        patterns,
        metadata,
      };
    }
  }

  const pkgJsonPath = toPosixPath(`${rootDir}/package.json`);
  if (await provider.isFile(pkgJsonPath)) {
    const pkg = await readJsonFile(provider, pkgJsonPath);
    const workspaces = extractWorkspacesField(pkg ?? {});
    if (workspaces.length > 0) {
      return {
        kind: await detectPackageManager(provider, rootDir),
        packageManager: await detectPackageManager(provider, rootDir),
        configPath: "package.json",
        patterns: workspaces,
        metadata: {},
      };
    }
  }

  return {
    kind: "none",
    packageManager: await detectPackageManager(provider, rootDir),
    patterns: [],
    metadata: {},
  };
}

/**
 * Expands workspace glob patterns into concrete package directories.
 *
 * @param provider - The resource provider.
 * @param rootDir - The project root.
 * @param patterns - The workspace glob patterns.
 * @returns Sorted, deduplicated relative directory paths.
 */
export async function expandWorkspacePatterns(
  provider: ScannerProvider,
  rootDir: string,
  patterns: readonly string[],
): Promise<readonly string[]> {
  if (patterns.length === 0) return [];
  const matches = await provider.glob(patterns, { cwd: rootDir, onlyDirectories: true });
  const dirs = new Set<string>();
  for (const match of matches) {
    if (match === rootDir) continue;
    const rel = toRelativePath(rootDir, match);
    if (rel === "") continue;
    dirs.add(toPosixPath(rel));
  }
  return [...dirs].sort();
}
