import type { CompilerRange } from "../../compiler/index.js";
import type { Symbol, SymbolDiagnostic } from "../models/index.js";
import { createSymbolDiagnostic, isErrorDiagnostic } from "../models/index.js";

/** Settings that tune heuristic detections. */
export interface SymbolDiagnosticsSettings {
  readonly languageId: string;
  readonly extractorId: string;
  /** Relative file being analyzed. */
  readonly file: string;
  /** Also emit `info` diagnostics (unsupported constructs). */
  readonly verbose?: boolean;
}

/** Runs the standard heuristic detections over an extracted module tree. */
export function detectSymbolDiagnostics(
  symbols: readonly Symbol[],
  settings: SymbolDiagnosticsSettings,
): readonly SymbolDiagnostic[] {
  const diagnostics: SymbolDiagnostic[] = [];
  const seenNames = new Map<string, Symbol>();

  for (const symbol of symbols) {
    const range = symbol.metadata.location.range;

    if (symbol.name.length === 0) {
      diagnostics.push(unnamedSymbol(symbol, range, settings));
      continue;
    }

    const seen = seenNames.get(symbol.name);
    if (seen !== undefined && seen.parentId === symbol.parentId) {
      diagnostics.push(
        createSymbolDiagnostic({
          code: "duplicate-symbol",
          severity: "warning",
          message: `Duplicate symbol "${symbol.name}" in the same scope.`,
          languageId: settings.languageId,
          extractorId: settings.extractorId,
          file: settings.file,
          ...(range !== undefined ? { range } : {}),
          symbolId: symbol.id,
          symbolName: symbol.name,
        }),
      );
    } else {
      seenNames.set(symbol.name, symbol);
    }
  }

  return diagnostics;
}

/** Detects duplicate symbol names at module top level. */
export function detectDuplicateSymbols(
  symbols: readonly Symbol[],
  settings: SymbolDiagnosticsSettings,
): readonly SymbolDiagnostic[] {
  const diagnostics: SymbolDiagnostic[] = [];
  const names = new Map<string, string>();
  for (const symbol of symbols) {
    const range = symbol.metadata.location.range;
    const prior = names.get(symbol.name);
    if (prior !== undefined && prior === symbol.parentId) {
      diagnostics.push(
        createSymbolDiagnostic({
          code: "duplicate-symbol",
          severity: "warning",
          message: `Duplicate symbol "${symbol.name}" in the same scope.`,
          languageId: settings.languageId,
          extractorId: settings.extractorId,
          file: settings.file,
          ...(range !== undefined ? { range } : {}),
          symbolId: symbol.id,
          symbolName: symbol.name,
        }),
      );
    } else {
      names.set(symbol.name, symbol.parentId ?? "");
    }
  }
  return diagnostics;
}

/** Flags anonymous symbols (empty names) that cannot be referenced. */
export function detectUnnamedSymbols(
  symbols: readonly Symbol[],
  settings: SymbolDiagnosticsSettings,
): readonly SymbolDiagnostic[] {
  const diagnostics: SymbolDiagnostic[] = [];
  for (const symbol of symbols) {
    if (symbol.name.length === 0) {
      const range = symbol.metadata.location.range;
      diagnostics.push(unnamedSymbol(symbol, range, settings));
    }
  }
  return diagnostics;
}

/** Whether `diagnostics` contains any error-severity diagnostic. */
export function hasErrorDiagnostics(diagnostics: readonly SymbolDiagnostic[]): boolean {
  return diagnostics.some(isErrorDiagnostic);
}

function unnamedSymbol(
  symbol: Symbol,
  range: CompilerRange | undefined,
  settings: SymbolDiagnosticsSettings,
): SymbolDiagnostic {
  return createSymbolDiagnostic({
    code: "unnamed-symbol",
    severity: "warning",
    message: `An anonymous ${symbol.kind} cannot be referenced.`,
    languageId: settings.languageId,
    extractorId: settings.extractorId,
    file: settings.file,
    ...(range !== undefined ? { range } : {}),
    symbolId: symbol.id,
    symbolName: symbol.name,
  });
}
