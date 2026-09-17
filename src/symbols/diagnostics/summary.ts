import type { SymbolDiagnostic } from "../models/index.js";

/** A heuristic classifier over a list of symbol diagnostics. */
export interface SymbolDiagnosticSummary {
  readonly total: number;
  readonly errors: number;
  readonly warnings: number;
  readonly infos: number;
  readonly byCode: Readonly<Record<string, number>>;
}

/** Summarizes diagnostics by severity and code. */
export function summarizeSymbolDiagnostics(
  diagnostics: readonly SymbolDiagnostic[],
): SymbolDiagnosticSummary {
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  const byCode: Record<string, number> = {};
  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === "error") errors += 1;
    else if (diagnostic.severity === "warning") warnings += 1;
    else infos += 1;
    byCode[diagnostic.code] = (byCode[diagnostic.code] ?? 0) + 1;
  }
  return Object.freeze({
    total: diagnostics.length,
    errors,
    warnings,
    infos,
    byCode: Object.freeze(byCode),
  });
}
