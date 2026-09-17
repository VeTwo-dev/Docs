/**
 * Compiler subsystem diagnostics.
 *
 * Raw compiler diagnostics are never exposed directly. Every native
 * diagnostic (TypeScript, Babel, ...) is normalized into this unified shape
 * before it leaves the compiler layer.
 */

/** A source position (1-based line/column, optional 0-based offset). */
export interface CompilerPosition {
  /** 1-based line. */
  readonly line: number;
  /** 1-based column. */
  readonly column: number;
  /** 0-based character offset, when known. */
  readonly offset?: number;
}

/** A source range between two {@link CompilerPosition}s. */
export interface CompilerRange {
  readonly start: CompilerPosition;
  readonly end: CompilerPosition;
}

/** Canonical diagnostic codes. */
export const CompilerDiagnosticCode = {
  SyntaxError: "syntax-error",
  CompilerWarning: "compiler-warning",
  UnsupportedSyntax: "unsupported-syntax",
  ConfigurationError: "configuration-error",
  MissingCompiler: "missing-compiler",
  InvalidProject: "invalid-project",
  CompilationFailed: "compilation-failed",
  CompilerError: "compiler-error",
} as const;

/** A canonical compiler diagnostic code. */
export type CompilerDiagnosticCode =
  (typeof CompilerDiagnosticCode)[keyof typeof CompilerDiagnosticCode];

/** Diagnostic severity. */
export type CompilerDiagnosticSeverity = "error" | "warning" | "info";

/** An immutable, normalized compiler diagnostic. */
export interface CompilerDiagnostic {
  /** The diagnostic code. */
  readonly code: CompilerDiagnosticCode;
  /** Severity. */
  readonly severity: CompilerDiagnosticSeverity;
  /** Human-readable message. */
  readonly message: string;
  /** The relative file the diagnostic relates to, when applicable. */
  readonly file?: string;
  /** The source range the diagnostic relates to, when known. */
  readonly range?: CompilerRange;
  /** The compiler that produced the diagnostic. */
  readonly compilerId?: string;
  /** The language the diagnostic relates to. */
  readonly languageId?: string;
  /** Related diagnostics or file paths, when applicable. */
  readonly related?: readonly string[];
}

/** Input required to build a {@link CompilerDiagnostic}. */
export interface CompilerDiagnosticInput {
  readonly code: CompilerDiagnosticCode;
  readonly severity: CompilerDiagnosticSeverity;
  readonly message: string;
  readonly file?: string;
  readonly range?: CompilerRange;
  readonly compilerId?: string;
  readonly languageId?: string;
  readonly related?: readonly string[];
}

/** Builds an immutable {@link CompilerDiagnostic}. */
export function createCompilerDiagnostic(input: CompilerDiagnosticInput): CompilerDiagnostic {
  return Object.freeze({
    code: input.code,
    severity: input.severity,
    message: input.message,
    ...(input.file !== undefined ? { file: input.file } : {}),
    ...(input.range !== undefined
      ? {
          range: Object.freeze({
            start: Object.freeze({ ...input.range.start }),
            end: Object.freeze({ ...input.range.end }),
          }),
        }
      : {}),
    ...(input.compilerId !== undefined ? { compilerId: input.compilerId } : {}),
    ...(input.languageId !== undefined ? { languageId: input.languageId } : {}),
    ...(input.related !== undefined ? { related: Object.freeze([...input.related]) } : {}),
  });
}
