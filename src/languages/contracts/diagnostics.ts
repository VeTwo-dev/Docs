/**
 * Language subsystem diagnostics.
 *
 * Diagnostics surface configuration problems (duplicate registration,
 * conflicting adapters, invalid capability declarations, ...) without
 * throwing, so extension loading stays resilient.
 */

/** Canonical diagnostic codes. */
export const LanguageDiagnosticCode = {
  UnknownLanguage: "unknown-language",
  ConflictingAdapters: "conflicting-adapters",
  MissingAdapter: "missing-adapter",
  UnsupportedLanguage: "unsupported-language",
  DuplicateRegistration: "duplicate-registration",
  InvalidCapability: "invalid-capability",
  VersionIncompatibility: "version-incompatibility",
  InvalidAdapter: "invalid-adapter",
} as const;

/** A canonical diagnostic code. */
export type LanguageDiagnosticCode =
  (typeof LanguageDiagnosticCode)[keyof typeof LanguageDiagnosticCode];

/** Diagnostic severity. */
export type LanguageDiagnosticSeverity = "error" | "warning" | "info";

/** An immutable language subsystem diagnostic. */
export interface LanguageDiagnostic {
  /** The diagnostic code. */
  readonly code: LanguageDiagnosticCode;
  /** Severity. */
  readonly severity: LanguageDiagnosticSeverity;
  /** Human-readable message. */
  readonly message: string;
  /** The language the diagnostic relates to, when applicable. */
  readonly languageId?: string;
  /** Related language ids, when applicable. */
  readonly related?: readonly string[];
}

/** Input required to build a {@link LanguageDiagnostic}. */
export interface LanguageDiagnosticInput {
  readonly code: LanguageDiagnosticCode;
  readonly severity: LanguageDiagnosticSeverity;
  readonly message: string;
  readonly languageId?: string;
  readonly related?: readonly string[];
}

/** Builds an immutable {@link LanguageDiagnostic}. */
export function createDiagnostic(input: LanguageDiagnosticInput): LanguageDiagnostic {
  return Object.freeze({
    code: input.code,
    severity: input.severity,
    message: input.message,
    ...(input.languageId !== undefined ? { languageId: input.languageId } : {}),
    ...(input.related !== undefined ? { related: Object.freeze([...input.related]) } : {}),
  });
}
