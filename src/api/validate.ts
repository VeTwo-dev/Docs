/**
 * API Validation + Diagnostics (21.12 + 21.15).
 *
 * Validates the semantic model itself and cross-checks it against the
 * eventual documentation intent. Pure: no I/O.
 */

import type { ApiSymbol } from "./models.js";
import type { ApiGraph } from "./graph.js";

export type ApiDiagnosticCode =
  | "API_UNDOCUMENTED"
  | "API_PARAM_MISMATCH"
  | "API_MISSING_RETURNS"
  | "API_BROKEN_LINK";

export interface ApiDiagnostic {
  readonly code: ApiDiagnosticCode;
  readonly severity: "error" | "warning" | "info";
  readonly message: string;
  readonly symbolName: string;
  readonly sourceFile: string;
  readonly line: number;
}

export interface ValidateOptions {
  /** Require `@param` descriptions to be non-empty. */
  readonly requireParamDocs?: boolean;
  /** Require non-void callables to have `@returns`/`returns` text. */
  readonly requireReturns?: boolean;
}

export function validateApis(
  symbols: readonly ApiSymbol[],
  graph: ApiGraph,
  options: ValidateOptions = {},
): ApiDiagnostic[] {
  const diags: ApiDiagnostic[] = [];
  const byName = new Map(symbols.map((s) => [s.name, s] as const));
  const byQN = new Map(symbols.map((s) => [s.qualifiedName, s] as const));

  for (const s of symbols) {
    if (s.boundary === "public" && s.documentation.summary.length === 0) {
      diags.push({
        code: "API_UNDOCUMENTED",
        severity: "warning",
        message: `Public ${s.kind} "${s.qualifiedName}" is undocumented.`,
        symbolName: s.name,
        sourceFile: s.sourceFile,
        line: s.line,
      });
    }

    const docParamNames = new Set(s.documentation.params.map((p) => p.name));
    const realParamNames = new Set(s.parameters?.map((p) => p.name) ?? []);
    for (const rp of realParamNames) {
      if (!docParamNames.has(rp) && s.parameters !== undefined && s.parameters.length > 0 && options.requireParamDocs !== false) {
        // Only warn if there is at least one documented param but this one is missing — avoids noise on fully undocumented.
        if (docParamNames.size > 0) {
          diags.push({
            code: "API_PARAM_MISMATCH",
            severity: "warning",
            message: `Parameter "${rp}" of "${s.qualifiedName}" has no @param entry.`,
            symbolName: s.name,
            sourceFile: s.sourceFile,
            line: s.line,
          });
        }
      }
    }
    for (const dp of docParamNames) {
      if (!realParamNames.has(dp)) {
        diags.push({
          code: "API_PARAM_MISMATCH",
          severity: "warning",
          message: `@param "${dp}" documents no such parameter of "${s.qualifiedName}".`,
          symbolName: s.name,
          sourceFile: s.sourceFile,
          line: s.line,
        });
      }
    }

    if (options.requireReturns === true && s.returnType !== undefined && s.returnType !== "void" && s.returnType !== "never") {
      const hasReturns = (s.documentation.returns !== undefined && s.documentation.returns.length > 0) || s.documentation.tags["returns"] !== undefined || s.documentation.tags["return"] !== undefined;
      if (!hasReturns && (s.kind === "function" || s.kind === "method" || s.kind === "getter")) {
        diags.push({
          code: "API_MISSING_RETURNS",
          severity: "info",
          message: `"${s.qualifiedName}" returns ${s.returnType} but has no @returns.`,
          symbolName: s.name,
          sourceFile: s.sourceFile,
          line: s.line,
        });
      }
    }

    for (const link of s.documentation.links) {
      const target = byQN.get(link.target) ?? byName.get(link.target);
      if (target === undefined) {
        // Also check graph edges: if no symbol with that name exists
        const exists = [...byName.keys()].some((k) => k === link.target);
        if (!exists) {
          diags.push({
            code: "API_BROKEN_LINK",
            severity: "warning",
            message: `{@link ${link.target}} in "${s.qualifiedName}" resolves to no known symbol.`,
            symbolName: s.name,
            sourceFile: s.sourceFile,
            line: s.line,
          });
        }
      } else {
        // Valid link — optionally could emit an edge, but we just validate
        void graph;
      }
    }
  }

  return diags;
}
