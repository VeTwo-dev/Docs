import type { SafeFileSystem } from "../filesystem/interface.js";
import {
  MANIFEST_DIR,
  MANIFEST_FILE,
  MANIFEST_SCHEMA_VERSION,
  SKILL_SCHEMA_VERSION,
} from "../types/manifest.js";
import type { ManifestFileEntry, WorkspaceManifest } from "../types/manifest.js";
import type { InitLayout } from "../types/options.js";

/** Compute the workspace manifest path inside the canonical state root. */
export function manifestPathFor(fs: SafeFileSystem, rootDir: string): string {
  return fs.join(rootDir, MANIFEST_DIR, MANIFEST_FILE);
}

/** Read and parse a workspace manifest; returns `undefined` when absent/invalid. */
export function readManifest(
  fs: SafeFileSystem,
  manifestPath: string,
): WorkspaceManifest | undefined {
  if (!fs.isFile(manifestPath)) return undefined;
  try {
    const raw = JSON.parse(fs.readFile(manifestPath)) as Partial<WorkspaceManifest>;
    if (
      raw.schemaVersion === undefined ||
      raw.files === undefined ||
      raw.directories === undefined
    ) {
      return undefined;
    }
    return raw as WorkspaceManifest;
  } catch {
    return undefined;
  }
}

/** Serialise and write a workspace manifest. */
export function writeManifest(
  fs: SafeFileSystem,
  manifestPath: string,
  manifest: WorkspaceManifest,
): void {
  fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
}

/** Context used to create a fresh manifest. */
export interface NewManifestContext {
  readonly project: string;
  readonly root: string;
  readonly outputDirectory: string;
  readonly layout: InitLayout;
  readonly agentEnabled: boolean;
}

/** Build a fresh manifest for a newly initialized workspace. */
export function createManifest(ctx: NewManifestContext, generatedAt: string): WorkspaceManifest {
  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    skillVersion: SKILL_SCHEMA_VERSION,
    generatedBy: "@vetwo/docs",
    generatedAt,
    project: ctx.project,
    root: ctx.root,
    config: {
      outputDirectory: ctx.outputDirectory,
      layout: { ...ctx.layout },
      agentEnabled: ctx.agentEnabled,
    },
    directories: [],
    files: [],
  };
}

/**
 * Merge a freshly-built manifest with an existing one, keeping the union of
 * tracked files/directories while refreshing system metadata.
 */
export function mergeManifest(
  existing: WorkspaceManifest | undefined,
  next: WorkspaceManifest,
): WorkspaceManifest {
  if (existing === undefined) return next;
  const filePaths = new Map<string, ManifestFileEntry>();
  for (const file of [...existing.files, ...next.files]) {
    filePaths.set(file.path, file);
  }
  return {
    ...next,
    files: [...filePaths.values()],
    directories: [...new Set([...existing.directories, ...next.directories])],
  };
}
