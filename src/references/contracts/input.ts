import type { CompilationUnit } from "../../compiler/index.js";

/** Options controlling a single binding-extraction pass. */
export interface ReferenceResolutionOptions {
  /** Skip the incremental binding cache. */
  readonly skipCache?: boolean;
}

/**
 * Input handed to a {@link ReferenceResolver}.
 *
 * Units are pre-grouped for the resolver's language. Only files that changed
 * (or were never cached) are handed over; unchanged files are rebuilt from
 * the reference cache.
 */
export interface ReferenceBindingInput {
  /** The project root directory. */
  readonly rootDir: string;
  /** The caller-supplied (or generated) request id. */
  readonly requestId: string;
  /** The language adapter id. */
  readonly languageId: string;
  /** The resolver id. */
  readonly resolverId: string;
  /** The compilation units to read bindings from (all for this language). */
  readonly units: readonly CompilationUnit[];
  /** Options for this pass. */
  readonly options?: ReferenceResolutionOptions;
}
