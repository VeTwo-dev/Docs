import type { CompilerDiagnostic } from "../contracts/diagnostics.js";
import type { CompilationUnit, SourceMap, SyntaxTree } from "../results/index.js";

/** Input required to build a {@link CompilationUnit}. */
export interface CompilationUnitInput {
  readonly file: string;
  readonly languageId: string;
  readonly compilerId: string;
  readonly status?: "ok" | "failed" | "skipped";
  readonly syntaxTree?: SyntaxTree;
  readonly diagnostics?: readonly CompilerDiagnostic[];
  readonly sourceMap?: SourceMap;
  readonly hash: string;
  readonly compileTimeMs?: number;
}

/** Builds an immutable {@link CompilationUnit}. */
export function createCompilationUnit(input: CompilationUnitInput): CompilationUnit {
  return Object.freeze({
    file: input.file,
    languageId: input.languageId,
    compilerId: input.compilerId,
    status: input.status ?? "ok",
    ...(input.syntaxTree !== undefined ? { syntaxTree: input.syntaxTree } : {}),
    diagnostics:
      input.diagnostics !== undefined ? Object.freeze([...input.diagnostics]) : Object.freeze([]),
    ...(input.sourceMap !== undefined ? { sourceMap: input.sourceMap } : {}),
    hash: input.hash,
    compileTimeMs: input.compileTimeMs ?? 0,
  });
}
