import type { PackageManager, ProjectType } from "../../types/public.js";
import type { ProjectClassification, ScanSource } from "../types/categories.js";
import type { AssetModel } from "./asset.js";
import type { ConfigurationModel } from "./configuration.js";
import type { DiagnosticModel } from "./diagnostics.js";
import type { DirectoryModel } from "./directory.js";
import type { FileModel } from "./file.js";
import type { PackageModel } from "./package.js";
import type { RelationshipModel } from "./relationships.js";
import type { WorkspaceModel } from "./workspace.js";

/** Aggregate counters computed at the end of a scan. */
export interface ScanStats {
  /** Total scanned (non-ignored) files. */
  readonly totalFiles: number;
  /** Total scanned (non-ignored) directories. */
  readonly totalDirectories: number;
  /** Total bytes across scanned files. */
  readonly totalBytes: number;
  /** File counts grouped by category. */
  readonly filesByCategory: Readonly<Record<string, number>>;
  /** File counts grouped by extension. */
  readonly filesByExtension: Readonly<Record<string, number>>;
  /** File counts grouped by language. */
  readonly filesByLanguage: Readonly<Record<string, number>>;
  /** The deepest directory depth reached. */
  readonly maxDepth: number;
}

/**
 * The unified project index — the single output of a scanner pass.
 *
 * The index is the source of truth for the whole project structure and feeds
 * every downstream phase (compiler, analyzer, renderer). It is immutable:
 * every collection is frozen and nested models are frozen.
 */
export interface ProjectModel {
  /** Absolute path of the scanned project root. */
  readonly rootPath: string;
  /** Project/package name, when available. */
  readonly name: string;
  /** Project/package version, when available. */
  readonly version?: string;
  /** The detected package manager. */
  readonly packageManager: PackageManager;
  /** Coarse project type, compatible with the public {@link ProjectType}. */
  readonly projectType: ProjectType;
  /** Rich multi-class classification of the project. */
  readonly classification: readonly ProjectClassification[];
  /** Detected workspaces (empty for single-package projects). */
  readonly workspaces: readonly WorkspaceModel[];
  /** Detected packages. */
  readonly packages: readonly PackageModel[];
  /** Scanned directories (non-ignored). */
  readonly directories: readonly DirectoryModel[];
  /** Scanned files (non-ignored). */
  readonly files: readonly FileModel[];
  /** Detected asset files. */
  readonly assets: readonly AssetModel[];
  /** Detected configuration files. */
  readonly configurations: readonly ConfigurationModel[];
  /** Resource relationships. */
  readonly relationships: readonly RelationshipModel[];
  /** Diagnostics raised during the scan. */
  readonly diagnostics: readonly DiagnosticModel[];
  /** Aggregate scan statistics. */
  readonly stats: ScanStats;
  /** Number of resources pruned by ignore rules. */
  readonly ignoredCount: number;
  /** Number of ignored rules that took effect during the scan. */
  readonly ignoreRuleCount: number;
  /** Epoch ms when the scan completed. */
  readonly scannedAt: number;
  /** Wall-clock duration of the scan in milliseconds. */
  readonly scanDurationMs: number;
  /** Whether this index is the result of a full or incremental scan. */
  readonly source: ScanSource;
  /** The provider backing the scan. */
  readonly providerName: string;
}

/** Input required to build a {@link ProjectModel}. */
export interface ProjectModelInput {
  readonly rootPath: string;
  readonly name: string;
  readonly version?: string;
  readonly packageManager: PackageManager;
  readonly projectType: ProjectType;
  readonly classification?: readonly ProjectClassification[];
  readonly workspaces?: readonly WorkspaceModel[];
  readonly packages?: readonly PackageModel[];
  readonly directories?: readonly DirectoryModel[];
  readonly files?: readonly FileModel[];
  readonly assets?: readonly AssetModel[];
  readonly configurations?: readonly ConfigurationModel[];
  readonly relationships?: readonly RelationshipModel[];
  readonly diagnostics?: readonly DiagnosticModel[];
  readonly stats: ScanStats;
  readonly ignoredCount?: number;
  readonly ignoreRuleCount?: number;
  readonly scannedAt?: number;
  readonly scanDurationMs?: number;
  readonly source?: ScanSource;
  readonly providerName: string;
}

/** Builds an immutable, frozen {@link ProjectModel} (a.k.a. project index). */
export function createProjectModel(input: ProjectModelInput): ProjectModel {
  return Object.freeze({
    rootPath: input.rootPath,
    name: input.name,
    ...(input.version !== undefined ? { version: input.version } : {}),
    packageManager: input.packageManager,
    projectType: input.projectType,
    classification: Object.freeze([...(input.classification ?? [])]),
    workspaces: Object.freeze([...(input.workspaces ?? [])]),
    packages: Object.freeze([...(input.packages ?? [])]),
    directories: Object.freeze([...(input.directories ?? [])]),
    files: Object.freeze([...(input.files ?? [])]),
    assets: Object.freeze([...(input.assets ?? [])]),
    configurations: Object.freeze([...(input.configurations ?? [])]),
    relationships: Object.freeze([...(input.relationships ?? [])]),
    diagnostics: Object.freeze([...(input.diagnostics ?? [])]),
    stats: Object.freeze({ ...input.stats }),
    ignoredCount: input.ignoredCount ?? 0,
    ignoreRuleCount: input.ignoreRuleCount ?? 0,
    scannedAt: input.scannedAt ?? Date.now(),
    scanDurationMs: input.scanDurationMs ?? 0,
    source: input.source ?? "full",
    providerName: input.providerName,
  });
}
