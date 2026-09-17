/**
 * Metadata every language adapter must expose.
 *
 * Metadata is intentionally data-only. The core engine never branches on a
 * specific language id — all behaviour hangs off the metadata + capabilities
 * declared by the adapter.
 */
export interface LanguageMetadata {
  /** Unique machine-readable id (e.g. `typescript`). */
  readonly id: string;
  /** Human-readable display name (e.g. `TypeScript`). */
  readonly displayName: string;
  /** Alternative ids / aliases (e.g. `ts`). */
  readonly aliases?: readonly string[];
  /** Adapter version (semver-ish). */
  readonly version?: string;
  /** Detection priority; higher wins extension conflicts. Defaults to `0`. */
  readonly priority?: number;
  /** File extensions including the leading dot (lowercase). */
  readonly extensions?: readonly string[];
  /** Exact basenames that identify the language (e.g. `tsconfig.json`). */
  readonly fileNames?: readonly string[];
  /** MIME types served by the language. */
  readonly mimeTypes?: readonly string[];
  /** Lockfile basenames that identify the ecosystem (e.g. `package-lock.json`). */
  readonly lockfiles?: readonly string[];
  /** Configuration files used by the language. */
  readonly configFiles?: readonly string[];
  /** Default entry point basenames (e.g. `index.ts`). */
  readonly defaultEntryFiles?: readonly string[];
  /** Optional display colour (hex, e.g. `#3178c6`). */
  readonly color?: string;
  /** Optional icon id. */
  readonly icon?: string;
}
