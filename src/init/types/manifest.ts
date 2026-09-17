import type { InitLayout } from "./options.js";
import type { Ownership } from "./plan.js";

/** Schema version of the workspace manifest. Bump on breaking changes. */
export const MANIFEST_SCHEMA_VERSION = 1;

/** Version of the built-in skill template. */
export const SKILL_SCHEMA_VERSION = 1;

/**
 * Internal manifests directory inside the canonical state root
 * (`.vetwo/docs/manifests/`), relative to the project root.
 */
export const MANIFEST_DIR = ".vetwo/docs/manifests" as const;

/** Name of the workspace manifest file. */
export const MANIFEST_FILE = "workspace.json" as const;

/** A file record tracked by the workspace manifest. */
export interface ManifestFileEntry {
  /** Path relative to the project root, POSIX-normalised. */
  readonly path: string;
  /** Ownership classification at the time of writing. */
  readonly ownership: Ownership;
  /** Template identifier used to regenerate the file. */
  readonly template?: string;
  /** Template/schema version used to generate the file. */
  readonly version?: number;
}

/**
 * The documentation workspace manifest. Records everything the system has
 * generated so future runs (and `docs upgrade`) can act safely.
 */
export interface WorkspaceManifest {
  readonly schemaVersion: number;
  /** Skill template version. */
  readonly skillVersion: number;
  /** Package that generated the manifest. */
  readonly generatedBy: string;
  /** ISO timestamp of generation. */
  readonly generatedAt: string;
  /** Project name the workspace belongs to. */
  readonly project: string;
  /** Project root the workspace lives under. */
  readonly root: string;
  /** Output configuration captured at generation time. */
  readonly config: {
    readonly outputDirectory: string;
    readonly layout: InitLayout;
    readonly agentEnabled: boolean;
  };
  /** System-generated directories (relative to the project root). */
  readonly directories: readonly string[];
  /** System-generated files with ownership metadata. */
  readonly files: readonly ManifestFileEntry[];
}
