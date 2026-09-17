import type { PackageModel } from "../models/package.js";
import type { WorkspaceModel } from "../models/workspace.js";
import type { RawWatchEvent, ScannerWatchEvent } from "../types/events.js";
import { toPosixPath } from "../utils/path.js";

/** Context used to classify a raw watch event into a scanner event. */
export interface WatchClassifyContext {
  readonly rootDir: string;
  readonly packages?: readonly PackageModel[];
  readonly workspaces?: readonly WorkspaceModel[];
}

/** Maps a raw watch event to a normalised scanner event. */
export function classifyWatchEvent(
  raw: RawWatchEvent,
  context: WatchClassifyContext,
): ScannerWatchEvent {
  const relativePath = toPosixPath(raw.path.replace(context.rootDir, "")).replace(/^\/+/, "");
  const timestamp = Date.now();
  const base = { path: raw.path, relativePath, timestamp };

  const packageModel = findOwningPackage(relativePath, context.packages ?? []);
  if (packageModel && isManifestPath(relativePath, packageModel)) {
    return {
      ...base,
      type:
        raw.type === "unlink" || raw.type === "unlinkDir"
          ? "package-removed"
          : raw.type === "add" || raw.type === "addDir"
            ? "package-added"
            : "package-modified",
      subject: packageModel.name,
    };
  }

  const workspace = context.workspaces?.find((ws) => {
    const config = ws.configPath;
    return config !== undefined && ws.relativePath !== undefined && ws.relativePath === "."
      ? relativePath === config
      : false;
  });
  if (workspace) {
    return { ...base, type: "workspace-changed", subject: workspace.name };
  }

  if (isConfigurationPath(relativePath)) {
    return { ...base, type: "configuration-changed" };
  }

  switch (raw.type) {
    case "add":
      return { ...base, type: "file-added" };
    case "change":
      return { ...base, type: "file-modified" };
    case "unlink":
      return { ...base, type: "file-removed" };
    case "addDir":
      return { ...base, type: "directory-added" };
    case "unlinkDir":
      return { ...base, type: "directory-removed" };
  }
}

function isManifestPath(relativePath: string, pkg: PackageModel): boolean {
  return relativePath === pkg.manifestRelativePath;
}

function findOwningPackage(
  relativePath: string,
  packages: readonly PackageModel[],
): PackageModel | undefined {
  const dir = relativePath.includes("/")
    ? relativePath.slice(0, relativePath.lastIndexOf("/"))
    : ".";
  for (const pkg of packages) {
    if (dir === pkg.relativePath) return pkg;
  }
  return undefined;
}

const CONFIGURATION_NAME_PATTERN =
  /^(tsconfig|vite\.config|vitest\.config|jest\.config|eslint\.config|playwright\.config|webpack\.config|rollup\.config|biome\.json|prettier|\.prettierrc|\.eslintrc|\.editorconfig|turbo\.json|nx\.json|docker-compose|compose\.(yml|yaml)|Dockerfile|\.nvmrc|\.node-version|\.tool-versions|renovate\.json|\.renovaterc|\.github\/dependabot|\.github\/workflows)/;

/** Whether a relative path points at a well-known configuration file. */
export function isConfigurationPath(relativePath: string): boolean {
  return CONFIGURATION_NAME_PATTERN.test(relativePath);
}
