/**
 * Compiler metadata.
 *
 * Identifies a compiler adapter and declares which language and syntax
 * dialects it understands. The engine resolves compilers exclusively through
 * this metadata — it never inspects the underlying native compiler.
 */
export interface CompilerMetadata {
  /** Stable compiler id (e.g. `typescript`, `babel-parser`). */
  readonly id: string;
  /** Human-readable name. */
  readonly displayName: string;
  /** The language adapter id this compiler compiles (e.g. `typescript`). */
  readonly languageId: string;
  /** The compiler adapter version. */
  readonly version: string;
  /** The native compiler version this adapter wraps, when known. */
  readonly nativeVersion?: string;
  /** Priority used to resolve multiple compilers for one language. */
  readonly priority: number;
  /** File extensions this compiler handles (leading dot). */
  readonly extensions: readonly string[];
  /** Supported syntax dialects (e.g. `typescript`, `tsx`, `ecmascript`). */
  readonly syntax: readonly string[];
  /** Optional description of the compiler. */
  readonly description?: string;
  /** Whether this is a bundled compiler adapter. */
  readonly builtin?: boolean;
}

/** Input required to build a {@link CompilerMetadata}. */
export type CompilerMetadataInput = CompilerMetadata;
