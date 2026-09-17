/**
 * Language detection contract.
 *
 * Detection is signal-based and consumes project facts produced by the
 * scanner: files, extensions, configuration files, dependencies, lockfiles,
 * workspace and repository metadata. A single project may contain multiple
 * languages — detection always returns an ordered list of results.
 */

/** The source of a detection signal. */
export type DetectionSignalSource =
  | "extension"
  | "fileName"
  | "configFile"
  | "dependency"
  | "devDependency"
  | "lockfile"
  | "workspace"
  | "framework"
  | "repository"
  | "custom";

/** A single weighted evidence item contributing to a detection. */
export interface DetectionSignal {
  /** Where the signal came from. */
  readonly source: DetectionSignalSource;
  /** Relative weight (0..1). Contributions are summed and clamped. */
  readonly weight: number;
  /** Optional detail (e.g. the matched extension or dependency). */
  readonly detail?: string;
}

/** Facts about a project used to detect languages. */
export interface DetectionInput {
  /** Absolute or logical project root. */
  readonly rootDir?: string;
  /** File paths or relative paths in the project. */
  readonly files?: readonly string[];
  /** Pre-collected file extensions (with or without leading dot). */
  readonly extensions?: readonly string[];
  /** Pre-collected exact basenames. */
  readonly fileNames?: readonly string[];
  /** Configuration file basenames. */
  readonly configFiles?: readonly string[];
  /** Lockfile basenames. */
  readonly lockfiles?: readonly string[];
  /** Runtime dependencies (`name -> version`). */
  readonly dependencies?: Readonly<Record<string, string>>;
  /** Dev dependencies (`name -> version`). */
  readonly devDependencies?: Readonly<Record<string, string>>;
  /** Explicit framework hints. */
  readonly frameworks?: readonly string[];
  /** Workspace metadata. */
  readonly workspace?: {
    readonly manager?: string;
    readonly packages?: readonly string[];
    readonly monorepo?: boolean;
  };
  /** Repository metadata. */
  readonly repository?: {
    readonly topics?: readonly string[];
    readonly language?: string;
  };
}

/** The result of detecting a single language in a project. */
export interface DetectionResult {
  /** The detected language id. */
  readonly languageId: string;
  /** Confidence score in `0..1`. */
  readonly confidence: number;
  /** The signals that contributed to this result. */
  readonly signals: readonly DetectionSignal[];
  /** Framework ids associated with the detected language. */
  readonly frameworks: readonly string[];
}
