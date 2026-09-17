/**
 * Content Ownership Manifest & Safe Regeneration.
 *
 * Maintains a hash-based manifest of every generated file so manual
 * modifications are detected (DOC_GENERATED_FILE_MODIFIED) and
 * regeneration only touches what is safe. Powers `--dry-run` and
 * force mode that still respects protected content.
 */

import { hashString } from "../utils/hash.js";
import { diagnostic } from "../documentation/compiler/diagnostics.js";
import type { DocumentationDiagnostic } from "../documentation/compiler/diagnostics.js";
import type { DocumentationContentOwnership, RegenerationPlanEntry } from "./types.js";

/** One tracked file in the ownership manifest. */
export interface OwnedFileEntry {
  readonly path: string;
  readonly slug?: string;
  readonly owner: DocumentationContentOwnership;
  /** Content hash at last write by the generator. */
  readonly contentHash: string;
  /** Page fingerprint at last write. */
  readonly fingerprint?: string;
  readonly generatorVersion?: string;
  readonly compilerVersion?: string;
  readonly provider?: string;
  readonly model?: string;
}

/** The ownership manifest (persisted under `.vetwo/docs/manifests/`). */
export interface ContentOwnershipManifest {
  readonly schemaVersion: 1;
  readonly files: Readonly<Record<string, OwnedFileEntry>>;
}

export function createOwnershipManifest(
  files: readonly OwnedFileEntry[] = [],
): ContentOwnershipManifest {
  const map: Record<string, OwnedFileEntry> = {};
  for (const entry of files) map[entry.path] = entry;
  return { schemaVersion: 1, files: map };
}

/** Hash file contents the same way the manifest does. */
export function hashContent(contents: string): string {
  return hashString(contents);
}

/** Result of checking the working tree against the manifest. */
export interface OwnershipAudit {
  /** Generated files modified manually since last generation. */
  readonly modified: readonly string[];
  /** Generated files deleted manually. */
  readonly missing: readonly string[];
  /** User-authored files (never touched by generation). */
  readonly userFiles: readonly string[];
  readonly diagnostics: readonly DocumentationDiagnostic[];
}

/**
 * Audit current on-disk contents against the ownership manifest.
 *
 * @param currentContents path → current file text (only existing files)
 * @param protectedSlugs pages explicitly marked protected
 */
export function auditOwnership(
  manifest: ContentOwnershipManifest,
  currentContents: Readonly<Record<string, string>>,
  protectedSlugs: readonly string[] = [],
): OwnershipAudit {
  const modified: string[] = [];
  const missing: string[] = [];
  const userFiles: string[] = [];
  const diagnostics: DocumentationDiagnostic[] = [];
  const protectedSet = new Set(protectedSlugs);

  for (const [path, entry] of Object.entries(manifest.files)) {
    const isUserOwned = entry.owner === "user-authored" || entry.owner === "protected";
    if (isUserOwned) continue;

    if (!(path in currentContents)) {
      missing.push(path);
      continue;
    }
    if (hashContent(currentContents[path] ?? "") !== entry.contentHash) {
      modified.push(path);
      const isProtected = entry.slug !== undefined && protectedSet.has(entry.slug);
      diagnostics.push(
        diagnostic(
          "DOC_GENERATED_FILE_MODIFIED",
          isProtected ? "error" : "warning",
          `"${path}" was modified manually after generation.`,
          entry.slug,
          "Your edits will be preserved; adopt ownership or revert to regenerate safely.",
        ),
      );
    }
  }

  for (const path of Object.keys(currentContents)) {
    if (manifest.files[path] === undefined) userFiles.push(path);
  }

  return { modified, missing, userFiles, diagnostics };
}

// ─── Regeneration planning ───────────────────────────────────────────────

/** Input page for regeneration planning. */
export interface RegenerationCandidate {
  readonly slug: string;
  readonly path: string;
  readonly desiredFingerprint: string;
  readonly existsOnDisk: boolean;
}

/** Plan produced by safe regeneration analysis. */
export interface RegenerationPlan {
  readonly entries: readonly RegenerationPlanEntry[];
  readonly summary: Readonly<
    Record<"create" | "update" | "delete" | "preserve" | "conflict" | "review", number>
  >;
  readonly diagnostics: readonly DocumentationDiagnostic[];
}

/**
 * Compute what regeneration would do — without touching anything.
 * This is the core of `docs generate --dry-run`.
 */
export function planRegeneration(input: {
  readonly manifest: ContentOwnershipManifest;
  readonly candidates: readonly RegenerationCandidate[];
  /** Current hashes of files on disk (existing files only). */
  readonly currentHashes: Readonly<Record<string, string>>;
  /** Slugs the user locked/protected. */
  readonly protectedSlugs?: readonly string[];
  /** Slugs with unresolved conflicts. */
  readonly conflictedSlugs?: readonly string[];
  /** Force mode: update modified generated pages, never protected ones. */
  readonly force?: boolean;
}): RegenerationPlan {
  const entries: RegenerationPlanEntry[] = [];
  const protectedSet = new Set(input.protectedSlugs ?? []);
  const conflictSet = new Set(input.conflictedSlugs ?? []);

  const knownPaths = new Set<string>();
  let create = 0;
  let update = 0;
  let del = 0;
  let preserve = 0;
  let conflict = 0;
  let review = 0;

  for (const candidate of input.candidates) {
    knownPaths.add(candidate.path);
    const previous = input.manifest.files[candidate.path];

    if (!candidate.existsOnDisk && previous === undefined) {
      entries.push({ slug: candidate.slug, action: "create", reason: "New generated page." });
      create++;
      continue;
    }

    if (protectedSet.has(candidate.slug)) {
      entries.push({
        slug: candidate.slug,
        action: "preserve",
        reason: "Page is protected; never regenerated automatically.",
      });
      preserve++;
      continue;
    }

    if (conflictSet.has(candidate.slug)) {
      entries.push({
        slug: candidate.slug,
        action: "conflict",
        reason: "Generated changes conflict with user edits.",
      });
      conflict++;
      continue;
    }

    const diskHash = input.currentHashes[candidate.path];
    const manuallyModified =
      previous !== undefined && diskHash !== undefined && diskHash !== previous.contentHash;

    const contentChanged = previous?.fingerprint !== candidate.desiredFingerprint;

    if (!candidate.existsOnDisk && previous !== undefined) {
      entries.push({
        slug: candidate.slug,
        action: "review",
        reason: "Generated file was deleted manually; recreate?",
      });
      review++;
      continue;
    }

    if (manuallyModified && !input.force) {
      entries.push({
        slug: candidate.slug,
        action: "review",
        reason: "Manually edited since last generation; requires adoption or force.",
      });
      review++;
      continue;
    }

    if (!contentChanged && !manuallyModified) {
      entries.push({ slug: candidate.slug, action: "preserve", reason: "Unchanged." });
      preserve++;
      continue;
    }

    entries.push({
      slug: candidate.slug,
      action: "update",
      reason: manuallyModified ? "Force update of manually edited page." : "Content changed.",
    });
    update++;
  }

  // Deletions: generated files no longer planned.
  for (const [path, entry] of Object.entries(input.manifest.files)) {
    if (entry.owner !== "generated" && entry.owner !== "ai-generated") continue;
    if (knownPaths.has(path)) continue;
    if (entry.slug !== undefined && protectedSet.has(entry.slug)) {
      entries.push({ slug: entry.slug, action: "preserve", reason: "Protected orphan kept." });
      preserve++;
      continue;
    }
    entries.push({ slug: entry.slug ?? path, action: "delete", reason: "No longer generated." });
    del++;
  }

  return {
    entries,
    summary: { create, update, delete: del, preserve, conflict, review },
    diagnostics: [],
  };
}
