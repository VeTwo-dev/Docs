import type { CompilerRange } from "../../compiler/index.js";

/** The codes emitted by the reference layer. */
export const REFERENCE_DIAGNOSTIC_CODES = [
  "unresolved-import",
  "unresolved-re-export",
  "unresolved-export",
  "unresolved-reference",
  "missing-resolver",
  "broken-symbol-metadata",

  "broken-alias",
  "invalid-package-export",
  "missing-dependency",
  "circular-reference",
  "invalid-inheritance",
  "broken-workspace-reference",
  "unsupported-reference",
] as const;

/** The kind of reference diagnostic. */
export type ReferenceDiagnosticCode = (typeof REFERENCE_DIAGNOSTIC_CODES)[number];

/** The severity of a reference diagnostic. */
export type ReferenceDiagnosticSeverity = "error" | "warning" | "info";

/** A normalized reference diagnostic. */
export interface ReferenceDiagnostic {
  readonly code: ReferenceDiagnosticCode;
  readonly severity: ReferenceDiagnosticSeverity;
  readonly message: string;
  readonly languageId: string;
  /** The resolver that produced the diagnostic, when applicable. */
  readonly resolverId?: string;
  /** The relative source file, when applicable. */
  readonly file?: string;
  /** The source range, when applicable. */
  readonly range?: CompilerRange;
  /** The source symbol id, when applicable. */
  readonly symbolId?: string;
  /** The referenced name or specifier, when applicable. */
  readonly referenceName?: string;
}

/** Input required to build a {@link ReferenceDiagnostic}. */
export interface ReferenceDiagnosticInput {
  readonly code: ReferenceDiagnosticCode;
  readonly severity: ReferenceDiagnosticSeverity;
  readonly message: string;
  readonly languageId: string;
  readonly resolverId?: string;
  readonly file?: string;
  readonly range?: CompilerRange;
  readonly symbolId?: string;
  readonly referenceName?: string;
}

/** Builds an immutable {@link ReferenceDiagnostic}. */
export function createReferenceDiagnostic(input: ReferenceDiagnosticInput): ReferenceDiagnostic {
  return Object.freeze({
    code: input.code,
    severity: input.severity,
    message: input.message,
    languageId: input.languageId,
    ...(input.resolverId !== undefined ? { resolverId: input.resolverId } : {}),
    ...(input.file !== undefined ? { file: input.file } : {}),
    ...(input.range !== undefined ? { range: input.range } : {}),
    ...(input.symbolId !== undefined ? { symbolId: input.symbolId } : {}),
    ...(input.referenceName !== undefined ? { referenceName: input.referenceName } : {}),
  });
}

/** Whether a diagnostic is an error. */
export function isErrorDiagnostic(diagnostic: ReferenceDiagnostic): boolean {
  return diagnostic.severity === "error";
}
