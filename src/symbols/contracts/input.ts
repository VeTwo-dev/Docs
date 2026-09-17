import type { CompilationUnit } from "../../compiler/index.js";

/** Options controlling a single extraction pass. */
export interface SymbolExtractionOptions {
  /** Skip the incremental extraction cache. */
  readonly skipCache?: boolean;
  /** Cap the total number of symbols produced for a unit. */
  readonly maxSymbols?: number;
}

/**
 * Input handed to a {@link SymbolExtractor}.
 *
 * Units are pre-grouped for the extractor's language and the engine supplies
 * project context (package assignment) so symbols can be fully qualified
 * before they are cached.
 */
export interface SymbolExtractionInput {
  /** The project root directory. */
  readonly rootDir: string;
  /** The caller-supplied (or generated) request id. */
  readonly requestId: string;
  /** The language adapter id. */
  readonly languageId: string;
  /** The extractor id. */
  readonly extractorId: string;
  /** The project name. */
  readonly projectName: string;
  /** The compilation units to extract from (all for this language). */
  readonly units: readonly CompilationUnit[];
  /** Maps a relative file path to its package name. */
  readonly fileToPackage: Readonly<Record<string, string>>;
  /** Options for this pass. */
  readonly options?: SymbolExtractionOptions;
}
