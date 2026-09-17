import type { IgnoreSource } from "../filters/ignore.js";
import type { ScannerProvider } from "../providers/types.js";
import type { ScannerPlugin } from "../classifiers/types.js";
import type { ResourceKind } from "./categories.js";

/**
 * Options controlling a single scan.
 *
 * The options object is immutable by convention; scanners never mutate it.
 */
export interface ScanOptions {
  /**
   * Glob patterns (relative to the root) that restrict scanning. When
   * provided, only paths matching at least one pattern are included — all
   * other resources are excluded as if ignored.
   */
  readonly include?: readonly string[];
  /**
   * Glob patterns (relative to the root) excluded in addition to ignore
   * rules. Negation (`!`) is supported.
   */
  readonly exclude?: readonly string[];
  /** Ignore sources that should be disabled for this scan. */
  readonly disabledIgnoreSources?: readonly IgnoreSource[];
  /** The kinds of resources to collect. Omit to collect everything. */
  readonly resourceKinds?: readonly ResourceKind[];
  /** Maximum directory depth to descend into (root is depth 0). */
  readonly maxDepth?: number;
  /** Whether to read and hash file contents. Off by default (stat only). */
  readonly collectMetadata?: boolean;
  /** Whether to follow directory symlinks. Off by default. */
  readonly followSymlinks?: boolean;
  /** Whether ignore patterns may match dotfiles. Defaults to `false`. */
  readonly dot?: boolean;
}

/** Configuration for the scanner cache. */
export interface ScannerCacheOptions {
  /** Where to persist the cache manifest (relative to the project root). */
  readonly path?: string;
  /** Whether persistence is enabled. Defaults to `true` when a path is set. */
  readonly enabled?: boolean;
}

/** Options for building a {@link ScannerEngine}. */
export interface ScannerEngineOptions {
  /** The provider to scan through. Defaults to a local filesystem provider. */
  readonly provider?: ScannerProvider;
  /** The project root directory. Defaults to the engine root. */
  readonly rootDir?: string;
  /** Cache options. When disabled no hashes are reused between scans. */
  readonly cache?: ScannerCacheOptions | boolean;
  /** The scanner plugins to apply. */
  readonly plugins?: readonly ScannerPlugin[];
}
