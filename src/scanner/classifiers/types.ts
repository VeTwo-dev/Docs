import type { PackageManager } from "../../types/public.js";
import type { IgnoreRule } from "../filters/ignore.js";
import type { ProjectModel } from "../models/project.js";
import type {
  AssetType,
  ConfigFormat,
  DirectoryCategory,
  FileCategory,
  ProjectClassification,
} from "../types/categories.js";

/** Input to file, config and asset classifiers. */
export interface FileClassificationInput {
  /** File basename. */
  readonly name: string;
  /** Path relative to the project root (POSIX). */
  readonly relativePath: string;
  /** Extension including the leading dot (may be empty). */
  readonly extension: string;
  /** Relative parent directory (`.` at the root). */
  readonly dir: string;
}

/** The classification assigned to a file. */
export interface FileClassification {
  readonly category: FileCategory;
  readonly language: string;
  readonly generated: boolean;
}

/** A file classifier hook: returns a classification or `null` to defer. */
export type FileClassifier = (input: FileClassificationInput) => FileClassification | null;

/** Input to a directory classifier. */
export interface DirectoryClassificationInput {
  /** Directory basename (`.` at the root). */
  readonly name: string;
  /** Path relative to the project root (POSIX). */
  readonly relativePath: string;
  /** Depth (root is 0). */
  readonly depth: number;
}

/** A directory classifier hook. */
export type DirectoryClassifier = (input: DirectoryClassificationInput) => DirectoryCategory | null;

/** Input to a project classifier. */
export interface ProjectClassificationInput {
  readonly name: string;
  readonly keywords: readonly string[];
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
  readonly peerDependencies: Readonly<Record<string, string>>;
  readonly scripts: Readonly<Record<string, string>>;
  readonly hasWorkspaces: boolean;
  readonly packageCount: number;
  readonly packageManager: PackageManager;
  /** Tools detected from configuration files (e.g. `typescript`, `vite`). */
  readonly configTools: readonly string[];
  readonly isRootPackage: boolean;
}

/** A project classifier hook. */
export type ProjectClassifier = (
  input: ProjectClassificationInput,
) => readonly ProjectClassification[] | null;

/** A detected configuration binding. */
export interface ConfigDetection {
  readonly tool: string;
  readonly format: ConfigFormat;
  readonly schemaPath?: string;
}

/** A config classifier hook. */
export type ConfigClassifier = (input: FileClassificationInput) => ConfigDetection | null;

/** An asset classifier hook. */
export type AssetClassifier = (input: FileClassificationInput) => AssetType | null;

/** Metadata collector hook, invoked after a file is classified. */
export type MetadataCollector = (
  input: FileClassificationInput,
  classification: FileClassification,
) => Readonly<Record<string, unknown>> | null;

/**
 * A scanner plugin extends the scanner's classification, ignore and metadata
 * behaviour without modifying scanner core code.
 */
export interface ScannerPlugin {
  /** Unique plugin name. */
  readonly name: string;
  /** Priority relative to other plugins (lower runs first). Defaults to `100`. */
  readonly order?: number;
  /** Extra ignore rules contributed by the plugin. */
  readonly ignoreRules?: readonly IgnoreRule[];
  readonly fileClassifier?: FileClassifier;
  readonly directoryClassifier?: DirectoryClassifier;
  readonly projectClassifier?: ProjectClassifier;
  readonly configClassifier?: ConfigClassifier;
  readonly assetClassifier?: AssetClassifier;
  readonly metadataCollector?: MetadataCollector;
  /** Runs before scanning begins. */
  readonly onScanStart?: () => void | Promise<void>;
  /** Runs after the project index is built; may return a modified index. */
  readonly onScanComplete?: (index: ProjectModel) => ProjectModel | Promise<ProjectModel>;
}

/** Combines plugin hooks with the built-in classifiers. */
export interface ClassifierSet {
  readonly file: readonly FileClassifier[];
  readonly directory: readonly DirectoryClassifier[];
  readonly project: readonly ProjectClassifier[];
  readonly config: readonly ConfigClassifier[];
  readonly asset: readonly AssetClassifier[];
  readonly metadata: readonly MetadataCollector[];
}

/** Builds a {@link ClassifierSet} from the built-in classifiers and plugins. */
export function buildClassifierSet(
  builtin: {
    readonly file: FileClassifier;
    readonly directory: DirectoryClassifier;
    readonly project: ProjectClassifier;
    readonly config: ConfigClassifier;
    readonly asset: AssetClassifier;
  },
  plugins: readonly ScannerPlugin[],
): ClassifierSet {
  const sorted = [...plugins].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
  return {
    file: [
      ...sorted.flatMap((plugin) => (plugin.fileClassifier ? [plugin.fileClassifier] : [])),
      builtin.file,
    ],
    directory: [
      ...sorted.flatMap((plugin) =>
        plugin.directoryClassifier ? [plugin.directoryClassifier] : [],
      ),
      builtin.directory,
    ],
    project: [
      ...sorted.flatMap((plugin) => (plugin.projectClassifier ? [plugin.projectClassifier] : [])),
      builtin.project,
    ],
    config: [
      ...sorted.flatMap((plugin) => (plugin.configClassifier ? [plugin.configClassifier] : [])),
      builtin.config,
    ],
    asset: [
      ...sorted.flatMap((plugin) => (plugin.assetClassifier ? [plugin.assetClassifier] : [])),
      builtin.asset,
    ],
    metadata: sorted.flatMap((plugin) =>
      plugin.metadataCollector ? [plugin.metadataCollector] : [],
    ),
  };
}
