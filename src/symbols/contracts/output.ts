import type { Symbol, SymbolRelationship } from "../models/index.js";
import type { SymbolDiagnostic } from "../models/index.js";

/** Aggregate counters for one extraction pass. */
export interface SymbolExtractionStatistics {
  /** The number of files processed. */
  readonly files: number;
  /** The number of files re-extracted. */
  readonly extractedFiles: number;
  /** The number of files served from the incremental cache. */
  readonly cachedFiles: number;
  /** The total number of symbols produced. */
  readonly symbolCount: number;
  /** The number of module symbols produced. */
  readonly moduleCount: number;
  /** The number of diagnostics produced. */
  readonly diagnosticsCount: number;
  /** Wall-clock extraction time in milliseconds. */
  readonly extractTimeMs: number;
}

/** The output of a {@link SymbolExtractor}. */
export interface SymbolExtractionOutput {
  readonly languageId: string;
  readonly extractorId: string;
  /** The module symbols (one per extracted file). */
  readonly modules: readonly Symbol[];
  /** Every symbol produced, including modules and their descendants. */
  readonly symbols: readonly Symbol[];
  /** Extractor-supplied relationships (optional; most are derived by the graph). */
  readonly relationships: readonly SymbolRelationship[];
  readonly diagnostics: readonly SymbolDiagnostic[];
  /** The files actually extracted (not served from cache). */
  readonly extractedFiles: readonly string[];
  readonly statistics: SymbolExtractionStatistics;
}
