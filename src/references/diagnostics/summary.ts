import type { ReferenceDiagnostic } from "../models/index.js";
import type { ReferenceDiagnosticCode } from "../models/index.js";

/** Aggregated counts for a diagnostic list. */
export interface ReferenceDiagnosticSummary {
  readonly total: number;
  readonly errors: number;
  readonly warnings: number;
  readonly infos: number;
  /** Code → count. */
  readonly byCode: Readonly<Record<string, number>>;
  /** Severity → count. */
  readonly bySeverity: Readonly<Record<string, number>>;
}

/** Summarizes a diagnostic list by severity and code. */
export function summarizeReferenceDiagnostics(
  diagnostics: readonly ReferenceDiagnostic[],
): ReferenceDiagnosticSummary {
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  const byCode: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};

  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === "error") errors += 1;
    else if (diagnostic.severity === "warning") warnings += 1;
    else infos += 1;
    byCode[diagnostic.code] = (byCode[diagnostic.code] ?? 0) + 1;
    bySeverity[diagnostic.severity] = (bySeverity[diagnostic.severity] ?? 0) + 1;
  }

  return Object.freeze({
    total: diagnostics.length,
    errors,
    warnings,
    infos,
    byCode: Object.freeze(byCode),
    bySeverity: Object.freeze(bySeverity),
  });
}

/** The codes emitted by the reference layer (re-exported for convenience). */
export function referenceDiagnosticCodes(): readonly ReferenceDiagnosticCode[] {
  return [
    "unresolved-import",
    "unresolved-re-export",
    "unresolved-export",
    "unresolved-reference",
    "missing-resolver",
    "broken-symbol-metadata",
  ];
}
