import type { PackageManager } from "../../types/public.js";
import type { WorkspaceKind } from "../types/categories.js";

/** An immutable model of a detected workspace. */
export interface WorkspaceModel {
  /** The tool defining the workspace layout. */
  readonly kind: WorkspaceKind;
  /** Workspace name (root package name, or the kind for rootless workspaces). */
  readonly name: string;
  /** Absolute path of the workspace root. */
  readonly path: string;
  /** Path relative to the project root (`.` for the root). */
  readonly relativePath: string;
  /** Whether this is the root workspace. */
  readonly root: boolean;
  /** Number of packages contained in the workspace. */
  readonly packageCount: number;
  /** Package directories relative to the workspace root (POSIX). */
  readonly packages: readonly string[];
  /** Glob patterns that define the workspace packages. */
  readonly patterns: readonly string[];
  /** Relative path of the workspace manifest file, when present. */
  readonly configPath?: string;
  /** The detected package manager. */
  readonly packageManager: PackageManager;
  /** Tool-specific metadata (e.g. `catalog`, `overrides`). */
  readonly metadata: Readonly<Record<string, unknown>>;
}

/** Input required to build a {@link WorkspaceModel}. */
export interface WorkspaceModelInput {
  readonly kind: WorkspaceKind;
  readonly name: string;
  readonly path: string;
  readonly relativePath: string;
  readonly root?: boolean;
  readonly packageCount?: number;
  readonly packages?: readonly string[];
  readonly patterns?: readonly string[];
  readonly configPath?: string;
  readonly packageManager: PackageManager;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Builds an immutable, frozen {@link WorkspaceModel}. */
export function createWorkspaceModel(input: WorkspaceModelInput): WorkspaceModel {
  return Object.freeze({
    kind: input.kind,
    name: input.name,
    path: input.path,
    relativePath: input.relativePath,
    root: input.root ?? false,
    packageCount: input.packageCount ?? 0,
    packages: Object.freeze([...(input.packages ?? [])]),
    patterns: Object.freeze([...(input.patterns ?? [])]),
    ...(input.configPath !== undefined ? { configPath: input.configPath } : {}),
    packageManager: input.packageManager,
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}
