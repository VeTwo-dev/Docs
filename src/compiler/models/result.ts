import type { CompilerDiagnostic } from "../contracts/diagnostics.js";
import type { CompilationContext, CompilationResult } from "../results/index.js";
import type { CompilationUnit } from "../results/index.js";
import type { CompilationStatistics } from "../results/index.js";

/** Input required to build a {@link CompilationResult}. */
export interface CompilationResultInput {
  readonly requestId: string;
  readonly compilerId: string;
  readonly languageId: string;
  readonly rootDir: string;
  readonly units?: readonly CompilationUnit[];
  readonly failedFiles?: readonly string[];
  readonly cachedFiles?: readonly string[];
  readonly skippedFiles?: readonly string[];
  readonly changedFiles?: readonly string[];
  readonly removedFiles?: readonly string[];
  readonly dependencies?: Readonly<Record<string, readonly string[]>>;
  readonly diagnostics?: readonly CompilerDiagnostic[];
  readonly statistics: CompilationStatistics;
  readonly context: CompilationContext;
  readonly timestamp?: number;
}

function freezeDependencies(
  input: Readonly<Record<string, readonly string[]>> | undefined,
): Readonly<Record<string, readonly string[]>> {
  if (input === undefined) return Object.freeze({});
  const frozen: Record<string, readonly string[]> = {};
  for (const key of Object.keys(input)) frozen[key] = Object.freeze([...input[key]!]);
  return Object.freeze(frozen);
}

/** Builds an immutable {@link CompilationResult}, computing `ok`. */
export function createCompilationResult(input: CompilationResultInput): CompilationResult {
  const units = input.units !== undefined ? Object.freeze([...input.units]) : Object.freeze([]);
  const failedFiles =
    input.failedFiles !== undefined ? Object.freeze([...input.failedFiles]) : Object.freeze([]);
  const ok =
    failedFiles.length === 0 &&
    !units.some((unit) => unit.status === "failed") &&
    !(input.diagnostics ?? []).some((diagnostic) => diagnostic.severity === "error");
  return Object.freeze({
    requestId: input.requestId,
    compilerId: input.compilerId,
    languageId: input.languageId,
    rootDir: input.rootDir,
    units,
    failedFiles,
    cachedFiles:
      input.cachedFiles !== undefined ? Object.freeze([...input.cachedFiles]) : Object.freeze([]),
    skippedFiles:
      input.skippedFiles !== undefined ? Object.freeze([...input.skippedFiles]) : Object.freeze([]),
    changedFiles:
      input.changedFiles !== undefined ? Object.freeze([...input.changedFiles]) : Object.freeze([]),
    removedFiles:
      input.removedFiles !== undefined ? Object.freeze([...input.removedFiles]) : Object.freeze([]),
    dependencies: freezeDependencies(input.dependencies),
    diagnostics:
      input.diagnostics !== undefined ? Object.freeze([...input.diagnostics]) : Object.freeze([]),
    statistics: input.statistics,
    context: input.context,
    timestamp: input.timestamp ?? Date.now(),
    ok,
  });
}
