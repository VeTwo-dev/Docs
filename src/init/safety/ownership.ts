import type { SafeFileSystem } from "../filesystem/interface.js";
import type { Ownership } from "../types/plan.js";
import type { WorkspaceManifest, ManifestFileEntry } from "../types/manifest.js";

/** Input needed to classify a path's ownership. */
export interface OwnershipContext {
  readonly fs: SafeFileSystem;
  /** Project root, used to relativise paths for manifest lookups. */
  readonly root: string;
  /** The workspace manifest, when one exists. */
  readonly manifest: WorkspaceManifest | undefined;
  /** Absolute path to classify. */
  readonly path: string;
  /** The template the system would write for this path (when applicable). */
  readonly expectedTemplate?: string;
}

/** Result of an ownership classification. */
export interface OwnershipResult {
  readonly ownership: Ownership;
  readonly reason: string;
}

/** Whether an ownership value may be overwritten automatically. */
export function isSystemOwned(ownership: Ownership): boolean {
  return ownership === "system-managed" || ownership === "system-generated";
}

/**
 * Classifies a path's ownership.
 *
 * Priority:
 * 1. Path does not exist → treated as `system-generated` (safe to create).
 * 2. Path is tracked in the manifest → honour recorded ownership, but promote
 *    to `user-modified-generated` when the system template no longer matches.
 * 3. Untracked path whose content equals the system template → generated.
 * 4. Everything else → user-authored (never touch).
 */
export function classifyPath(ctx: OwnershipContext): OwnershipResult {
  const { fs, root, path } = ctx;
  const relative = fs.relative(root, path);

  if (!fs.exists(path)) {
    return { ownership: "system-generated", reason: "Does not exist yet; safe to create" };
  }

  const entry = findManifestEntry(ctx.manifest, relative);
  if (entry !== undefined) {
    if (!isSystemOwned(entry.ownership)) {
      return {
        ownership: entry.ownership,
        reason: `Manifest records this path as ${entry.ownership}`,
      };
    }
    if (ctx.expectedTemplate !== undefined && fs.readFile(path) !== ctx.expectedTemplate) {
      return {
        ownership: "user-modified-generated",
        reason: "Generated file was modified by the user",
      };
    }
    return {
      ownership: entry.ownership,
      reason: `Manifest records this path as ${entry.ownership} and content is unchanged`,
    };
  }

  if (ctx.expectedTemplate !== undefined) {
    if (fs.readFile(path) === ctx.expectedTemplate) {
      return { ownership: "system-generated", reason: "Content matches the system template" };
    }
    return {
      ownership: "user-authored",
      reason: "Untracked file differs from the system template",
    };
  }

  return { ownership: "user-authored", reason: "Untracked path; treated as user content" };
}

function findManifestEntry(
  manifest: WorkspaceManifest | undefined,
  relative: string,
): ManifestFileEntry | undefined {
  if (manifest === undefined) return undefined;
  return manifest.files.find((file) => file.path === relative);
}
