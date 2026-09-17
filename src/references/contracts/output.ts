import type { ReferenceDiagnostic, ReferenceFileBindings } from "../models/index.js";

/** Aggregate counters for one binding-extraction pass. */
export interface ReferenceBindingStatistics {
  /** The number of files processed. */
  readonly files: number;
  /** The number of files re-extracted. */
  readonly extractedFiles: number;
  /** The number of import/export bindings produced. */
  readonly bindingsCount: number;
  /** The number of diagnostics produced. */
  readonly diagnosticsCount: number;
  /** Wall-clock extraction time in milliseconds. */
  readonly extractTimeMs: number;
}

/** The output of a {@link ReferenceResolver}. */
export interface ReferenceBindingOutput {
  readonly languageId: string;
  readonly resolverId: string;
  /** Per-file bindings keyed by relative file path. */
  readonly bindings: Readonly<Record<string, ReferenceFileBindings>>;
  readonly diagnostics: readonly ReferenceDiagnostic[];
  readonly statistics: ReferenceBindingStatistics;
}
