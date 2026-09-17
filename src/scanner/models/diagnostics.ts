import type { DiagnosticSeverity } from "../types/categories.js";

/** An immutable diagnostic produced during a scan. */
export interface DiagnosticModel {
  /** The diagnostic category. */
  readonly category: string;
  /** The severity of the diagnostic. */
  readonly severity: DiagnosticSeverity;
  /** Human-readable message. */
  readonly message: string;
  /** The absolute path the diagnostic relates to, when applicable. */
  readonly path?: string;
  /** Related paths, when applicable. */
  readonly related?: readonly string[];
  /** Source of the diagnostic (e.g. `scanner`, `workspace-detector`). */
  readonly source?: string;
}

/** Input required to build a {@link DiagnosticModel}. */
export interface DiagnosticModelInput {
  readonly category: string;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly path?: string;
  readonly related?: readonly string[];
  readonly source?: string;
}

/** Builds an immutable, frozen {@link DiagnosticModel}. */
export function createDiagnostic(input: DiagnosticModelInput): DiagnosticModel {
  return Object.freeze({
    category: input.category,
    severity: input.severity,
    message: input.message,
    ...(input.path !== undefined ? { path: input.path } : {}),
    ...(input.related !== undefined ? { related: Object.freeze([...input.related]) } : {}),
    ...(input.source !== undefined ? { source: input.source } : {}),
  });
}
