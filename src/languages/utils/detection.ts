import type { DetectionInput } from "../contracts/detection.js";
import type { ProjectModel } from "../../scanner/models/project.js";

/** Sorts a value's keys recursively for a stable fingerprint. */
function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue).sort();
  }
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortValue((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Builds a stable cache key for a detection input, normalising key order and
 * array order so semantically identical inputs share a cache entry.
 */
export function fingerprintDetectionInput(input: DetectionInput): string {
  return JSON.stringify(sortValue(input));
}

/**
 * Derives a {@link DetectionInput} from a scanner {@link ProjectModel}, so
 * language detection consumes the project index produced by the scanner.
 */
export function detectionInputFromProjectModel(model: ProjectModel): DetectionInput {
  const fileNames = model.files.map((file) => file.name);
  const extensions = model.files
    .map((file) => file.extension)
    .filter((extension): extension is string => extension.length > 0);
  const configFiles = model.configurations.map((config) => config.file.name);
  const lockfiles = fileNames.filter(
    (name) =>
      name === "package-lock.json" ||
      name === "yarn.lock" ||
      name === "pnpm-lock.yaml" ||
      name === "bun.lock" ||
      name === "bun.lockb" ||
      name === "deno.lock" ||
      name === "go.sum" ||
      name === "Cargo.lock" ||
      name === "poetry.lock",
  );
  const rootPackage = model.packages.find((pkg) => pkg.isWorkspaceRoot) ?? model.packages[0];
  const workspace = model.workspaces[0];

  return {
    rootDir: model.rootPath,
    files: model.files.map((file) => file.relativePath),
    extensions,
    fileNames,
    configFiles: configFiles.filter(Boolean),
    lockfiles,
    dependencies: rootPackage?.dependencies,
    devDependencies: rootPackage?.devDependencies,
    workspace:
      workspace !== undefined
        ? {
            manager: model.packageManager,
            packages: workspace.packages,
            monorepo: model.packages.length > 1,
          }
        : undefined,
  };
}
