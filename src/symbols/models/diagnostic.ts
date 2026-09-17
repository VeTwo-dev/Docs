import type { CompilerRange } from "../../compiler/index.js";

/** The codes emitted by the symbol layer. */
export const SYMBOL_DIAGNOSTIC_CODES = [
  "duplicate-symbol",
  "conflicting-declaration",
  "invalid-export",
  "unnamed-symbol",
  "broken-compiler-metadata",
  "unsupported-construct",
  "extractor-failure",
  "missing-extractor",
] as const;

/** The kind of symbol diagnostic. */
export type SymbolDiagnosticCode = (typeof SYMBOL_DIAGNOSTIC_CODES)[number];

/** The severity of a symbol diagnostic. */
export type SymbolDiagnosticSeverity = "error" | "warning" | "info";

/** A normalized symbol diagnostic. */
export interface SymbolDiagnostic {
  readonly code: SymbolDiagnosticCode;
  readonly severity: SymbolDiagnosticSeverity;
  readonly message: string;
  readonly languageId: string;
  /** The extractor that produced the diagnostic, when applicable. */
  readonly extractorId?: string;
  /** The relative source file, when applicable. */
  readonly file?: string;
  /** The source range, when applicable. */
  readonly range?: CompilerRange;
  /** The affected symbol id, when applicable. */
  readonly symbolId?: string;
  /** The affected symbol identifier, when applicable. */
  readonly symbolName?: string;
}

/** Input required to build a {@link SymbolDiagnostic}. */
export interface SymbolDiagnosticInput {
  readonly code: SymbolDiagnosticCode;
  readonly severity: SymbolDiagnosticSeverity;
  readonly message: string;
  readonly languageId: string;
  readonly extractorId?: string;
  readonly file?: string;
  readonly range?: CompilerRange;
  readonly symbolId?: string;
  readonly symbolName?: string;
}

/** Builds an immutable {@link SymbolDiagnostic}. */
export function createSymbolDiagnostic(input: SymbolDiagnosticInput): SymbolDiagnostic {
  return Object.freeze({
    code: input.code,
    severity: input.severity,
    message: input.message,
    languageId: input.languageId,
    ...(input.extractorId !== undefined ? { extractorId: input.extractorId } : {}),
    ...(input.file !== undefined ? { file: input.file } : {}),
    ...(input.range !== undefined ? { range: input.range } : {}),
    ...(input.symbolId !== undefined ? { symbolId: input.symbolId } : {}),
    ...(input.symbolName !== undefined ? { symbolName: input.symbolName } : {}),
  });
}

/** Whether a diagnostic is an error. */
export function isErrorDiagnostic(diagnostic: SymbolDiagnostic): boolean {
  return diagnostic.severity === "error";
}
