import type { CompilationStatistics } from "../results/index.js";

/** Input required to build {@link CompilationStatistics}. */
export interface CompilationStatisticsInput {
  readonly totalFiles?: number;
  readonly compiledFiles?: number;
  readonly skippedFiles?: number;
  readonly cachedFiles?: number;
  readonly failedFiles?: number;
  readonly totalTimeMs?: number;
  readonly compileTimeMs?: number;
  readonly treeNodes?: number;
  readonly cached?: boolean;
  readonly nativeVersion?: string;
}

/** Builds an immutable {@link CompilationStatistics}. */
export function createCompilationStatistics(
  input: CompilationStatisticsInput,
): CompilationStatistics {
  return Object.freeze({
    totalFiles: input.totalFiles ?? 0,
    compiledFiles: input.compiledFiles ?? 0,
    skippedFiles: input.skippedFiles ?? 0,
    cachedFiles: input.cachedFiles ?? 0,
    failedFiles: input.failedFiles ?? 0,
    totalTimeMs: input.totalTimeMs ?? 0,
    compileTimeMs: input.compileTimeMs ?? 0,
    treeNodes: input.treeNodes ?? 0,
    cached: input.cached ?? false,
    ...(input.nativeVersion !== undefined ? { nativeVersion: input.nativeVersion } : {}),
  });
}
