import {
  CompilerDiagnosticCode,
  createCompilerDiagnostic,
  type CompilerDiagnostic,
  type CompilerDiagnosticCode as CompilerDiagnosticCodeType,
  type CompilerDiagnosticSeverity,
} from "../contracts/diagnostics.js";

/**
 * Normalization of native compiler diagnostics.
 *
 * Raw TypeScript/Babel/other diagnostics are duck-typed into the unified
 * {@link CompilerDiagnostic} shape. No native diagnostic ever escapes the
 * compiler layer unnormalized.
 */

interface NormalizationContext {
  readonly compilerId?: string;
  readonly languageId?: string;
  readonly defaultFile?: string;
}

/** Maps a native severity hint to a normalized severity. */
export function mapDiagnosticSeverity(severity: unknown): CompilerDiagnosticSeverity {
  if (severity === "error" || severity === 1) return "error";
  if (severity === "info" || severity === 3 || severity === 4) return "info";
  if (severity === "warning" || severity === 2) return "warning";
  return "error";
}

/** Flattens a TypeScript message chain into a plain string. */
export function flattenMessageText(messageText: unknown): string {
  if (typeof messageText === "string") return messageText;
  if (messageText !== null && typeof messageText === "object") {
    const part = messageText as { messageText?: unknown; next?: unknown };
    const head = typeof part.messageText === "string" ? part.messageText : "";
    const tail = part.next !== undefined ? flattenMessageText(part.next) : "";
    return tail ? `${head} ${tail}` : head;
  }
  return String(messageText);
}

function toNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** 1-based line/column from a native position value. */
export function toOneBasedPosition(value: unknown):
  | {
      readonly line: number;
      readonly column: number;
    }
  | undefined {
  if (value !== null && typeof value === "object") {
    const record = value as { line?: unknown; column?: unknown };
    const line = toNumber(record.line);
    const column = toNumber(record.column);
    if (line !== undefined && column !== undefined) {
      return {
        line: line + (line >= 1 ? 0 : 1),
        column: column + (column >= 1 ? 0 : 1),
      };
    }
  }
  return undefined;
}

/** Builds a normalized {@link CompilerRange} from common native shapes. */
export function toCompilerRange(raw: unknown): CompilerDiagnostic["range"] | undefined {
  if (raw === null || raw === undefined) return undefined;
  const record = raw as {
    start?: unknown;
    end?: unknown;
    line?: unknown;
    column?: unknown;
    loc?: unknown;
    pos?: unknown;
    startPos?: unknown;
    length?: unknown;
  };
  const loc = toOneBasedPosition(record.loc);
  if (loc !== undefined) {
    const end =
      toNumber(record.end) !== undefined
        ? { line: loc.line, column: loc.column, offset: toNumber(record.end) }
        : { line: loc.line, column: loc.column };
    return Object.freeze({
      start: Object.freeze(loc),
      end: Object.freeze(end),
    });
  }
  if (record.start !== undefined && record.end !== undefined) {
    const start = toOneBasedPosition(record.start);
    const end = toOneBasedPosition(record.end);
    if (start !== undefined && end !== undefined) {
      return Object.freeze({
        start: Object.freeze({ line: start.line, column: start.column }),
        end: Object.freeze({ line: end.line, column: end.column }),
      });
    }
  }
  return undefined;
}

/**
 * Maps a raw diagnostic to a canonical code. Severity takes precedence; Babel
 * style errors (reasonCode present) are syntax errors.
 */
export function mapDiagnosticCode(
  raw: unknown,
  severity: CompilerDiagnosticSeverity,
): CompilerDiagnosticCodeType {
  const record = raw as { reasonCode?: unknown };
  if (record.reasonCode !== undefined) return CompilerDiagnosticCode.SyntaxError;
  if (severity === "warning") return CompilerDiagnosticCode.CompilerWarning;
  if (severity === "info") return CompilerDiagnosticCode.CompilerWarning;
  return CompilerDiagnosticCode.CompilationFailed;
}

/** Extracts the file path from a native diagnostic. */
export function diagnosticFile(raw: unknown, context: NormalizationContext): string | undefined {
  if (raw === null || raw === undefined) return context.defaultFile;
  const record = raw as { file?: unknown; fileName?: unknown; path?: unknown; filename?: unknown };
  const nativeFile =
    (record.file as { fileName?: unknown } | undefined)?.fileName ??
    record.fileName ??
    record.path ??
    record.filename;
  if (typeof nativeFile === "string" && nativeFile) return nativeFile;
  return context.defaultFile;
}

/** Normalizes a single native diagnostic, or returns `null` when unusable. */
export function normalizeCompilerDiagnostic(
  raw: unknown,
  context: NormalizationContext = {},
): CompilerDiagnostic | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object") return null;
  const record = raw as {
    message?: unknown;
    messageText?: unknown;
    severity?: unknown;
    category?: unknown;
    code?: unknown;
    start?: unknown;
    end?: unknown;
    length?: unknown;
    line?: unknown;
    column?: unknown;
    range?: CompilerDiagnostic["range"];
  };
  const rawMessage = record.messageText ?? record.message;
  if (rawMessage === undefined || rawMessage === null) return null;
  const message = flattenMessageText(rawMessage);
  if (!message) return null;

  const severity = mapDiagnosticSeverity(record.severity ?? record.category);
  const code = mapDiagnosticCode(raw, severity);
  const file = diagnosticFile(raw, context);
  const range = record.range ?? toCompilerRange(raw);
  const related = record.code !== undefined ? [String(record.code)] : undefined;

  return createCompilerDiagnostic({
    code,
    severity,
    message,
    ...(file !== undefined ? { file } : {}),
    ...(range !== undefined ? { range } : {}),
    ...(context.compilerId !== undefined ? { compilerId: context.compilerId } : {}),
    ...(context.languageId !== undefined ? { languageId: context.languageId } : {}),
    ...(related !== undefined ? { related } : {}),
  });
}

/** Normalizes a list of native diagnostics. */
export function normalizeCompilerDiagnostics(
  rawList: readonly unknown[],
  context: NormalizationContext = {},
): CompilerDiagnostic[] {
  return rawList
    .map((raw) => normalizeCompilerDiagnostic(raw, context))
    .filter((diagnostic): diagnostic is CompilerDiagnostic => diagnostic !== null);
}
