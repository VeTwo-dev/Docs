import type { PackageManager } from "../../types/public.js";

/** An immutable model of a discovered package. */
export interface PackageModel {
  /** Absolute path of the package directory. */
  readonly path: string;
  /** Package directory relative to the project root (POSIX). */
  readonly relativePath: string;
  /** Package name from the manifest. */
  readonly name: string;
  /** Package version. */
  readonly version: string;
  /** Whether the package is private (not published). */
  readonly private: boolean;
  /** Absolute path of the package manifest (`package.json`). */
  readonly manifestPath: string;
  /** Manifest path relative to the project root. */
  readonly manifestRelativePath: string;
  /** Whether this is the workspace root package. */
  readonly isWorkspaceRoot: boolean;
  readonly description?: string;
  readonly license?: string;
  readonly author?: string;
  readonly keywords: readonly string[];
  readonly scripts: Readonly<Record<string, string>>;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
  readonly peerDependencies: Readonly<Record<string, string>>;
  readonly optionalDependencies: Readonly<Record<string, string>>;
  readonly bin?: string | Readonly<Record<string, string>>;
  readonly exports?: unknown;
  readonly main?: string;
  readonly module?: string;
  readonly types?: string;
  readonly packageManager?: string;
  readonly workspaces?: readonly string[];
  /** The raw parsed manifest, preserved for future phases. */
  readonly raw: Readonly<Record<string, unknown>>;
}

/** Input required to build a {@link PackageModel}. */
export interface PackageModelInput {
  readonly path: string;
  readonly relativePath: string;
  readonly name: string;
  readonly version?: string;
  readonly private?: boolean;
  readonly manifestPath: string;
  readonly manifestRelativePath: string;
  readonly isWorkspaceRoot?: boolean;
  readonly description?: string;
  readonly license?: string;
  readonly author?: string;
  readonly keywords?: readonly string[];
  readonly scripts?: Readonly<Record<string, string>>;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
  readonly optionalDependencies?: Readonly<Record<string, string>>;
  readonly bin?: string | Readonly<Record<string, string>>;
  readonly exports?: unknown;
  readonly main?: string;
  readonly module?: string;
  readonly types?: string;
  readonly packageManager?: string;
  readonly workspaces?: readonly string[];
  readonly raw: Readonly<Record<string, unknown>>;
}

/** Builds an immutable, frozen {@link PackageModel}. */
export function createPackageModel(input: PackageModelInput): PackageModel {
  return Object.freeze({
    path: input.path,
    relativePath: input.relativePath,
    name: input.name,
    version: input.version ?? "0.0.0",
    private: input.private ?? false,
    manifestPath: input.manifestPath,
    manifestRelativePath: input.manifestRelativePath,
    isWorkspaceRoot: input.isWorkspaceRoot ?? false,
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.license !== undefined ? { license: input.license } : {}),
    ...(input.author !== undefined ? { author: input.author } : {}),
    keywords: Object.freeze([...(input.keywords ?? [])]),
    scripts: Object.freeze({ ...(input.scripts ?? {}) }),
    dependencies: Object.freeze({ ...(input.dependencies ?? {}) }),
    devDependencies: Object.freeze({ ...(input.devDependencies ?? {}) }),
    peerDependencies: Object.freeze({ ...(input.peerDependencies ?? {}) }),
    optionalDependencies: Object.freeze({ ...(input.optionalDependencies ?? {}) }),
    ...(input.bin !== undefined ? { bin: input.bin } : {}),
    ...(input.exports !== undefined ? { exports: input.exports } : {}),
    ...(input.main !== undefined ? { main: input.main } : {}),
    ...(input.module !== undefined ? { module: input.module } : {}),
    ...(input.types !== undefined ? { types: input.types } : {}),
    ...(input.packageManager !== undefined ? { packageManager: input.packageManager } : {}),
    ...(input.workspaces !== undefined ? { workspaces: Object.freeze([...input.workspaces]) } : {}),
    raw: Object.freeze({ ...input.raw }),
  });
}

/** Convenience type matching the public {@link PackageManager} union. */
export type ScannerPackageManager = PackageManager;
