import type { Symbol } from "../../symbols/index.js";
import type { ReferenceGraph } from "../graph/index.js";
import type { ReferenceDiagnostic, ReferenceDiagnosticSeverity } from "../models/index.js";
import { createReferenceDiagnostic } from "../models/index.js";
import type { Reference } from "../models/index.js";
import { isProjectSpecifier } from "../shared/index.js";

/** Context used by unresolved-reference detection. */
export interface ReferenceDiagnosticsSettings {
  /** The symbol store used to attribute references to files. */
  readonly symbols: ReadonlyMap<string, Symbol>;
  /** The language id attached to emitted diagnostics. */
  readonly languageId?: string;
  /** The resolver id attached to emitted diagnostics. */
  readonly resolverId?: string;
}

/** The severity assigned to each reference kind when unresolved. */
const SEVERITY_FOR_KIND: Partial<Record<Reference["kind"], ReferenceDiagnosticSeverity>> = {
  export: "info",
  heritage: "info",
  "import-name": "info",
  "type-use": "info",
};

/**
 * Detects unresolved references in a graph.
 *
 * Relative imports and re-exports that point outside the known files are
 * warnings; unresolved names (heritage, type aliases, imported names,
 * exports) are informational — they may legitimately reference globals,
 * external packages or unparsed files. Bare specifiers never warn.
 */
export function detectUnresolvedReferences(
  graph: ReferenceGraph,
  settings: ReferenceDiagnosticsSettings,
): readonly ReferenceDiagnostic[] {
  const diagnostics: ReferenceDiagnostic[] = [];
  const languageId = settings.languageId ?? "unknown";
  const fileOf = (reference: Reference): string | undefined => {
    return settings.symbols.get(reference.fromId)?.metadata.location.file;
  };

  for (const reference of graph.references) {
    if (reference.resolved) continue;

    if (reference.kind === "import" || reference.kind === "re-export") {
      if (reference.specifier === undefined || !isProjectSpecifier(reference.specifier)) continue;
      diagnostics.push(
        createReferenceDiagnostic({
          code: reference.kind === "import" ? "unresolved-import" : "unresolved-re-export",
          severity: "warning",
          message:
            reference.kind === "import"
              ? `Import of "${reference.specifier}" does not resolve to a known file.`
              : `Re-export of "${reference.specifier}" does not resolve to a known file.`,
          languageId,
          ...(settings.resolverId !== undefined ? { resolverId: settings.resolverId } : {}),
          ...(fileOf(reference) !== undefined ? { file: fileOf(reference) } : {}),
          symbolId: reference.fromId,
          referenceName: reference.specifier,
        }),
      );
      continue;
    }

    if (reference.kind === "export") {
      diagnostics.push(
        createReferenceDiagnostic({
          code: "unresolved-export",
          severity: "info",
          message: `Exported name "${reference.name}" has no backing symbol in the module.`,
          languageId,
          ...(settings.resolverId !== undefined ? { resolverId: settings.resolverId } : {}),
          ...(fileOf(reference) !== undefined ? { file: fileOf(reference) } : {}),
          symbolId: reference.fromId,
          ...(reference.name !== undefined ? { referenceName: reference.name } : {}),
        }),
      );
      continue;
    }

    const severity = SEVERITY_FOR_KIND[reference.kind] ?? "info";
    if (reference.name === undefined) continue;
    diagnostics.push(
      createReferenceDiagnostic({
        code: "unresolved-reference",
        severity,
        message: `Reference to "${reference.name}" does not resolve to a known symbol.`,
        languageId,
        ...(settings.resolverId !== undefined ? { resolverId: settings.resolverId } : {}),
        ...(fileOf(reference) !== undefined ? { file: fileOf(reference) } : {}),
        symbolId: reference.fromId,
        referenceName: reference.name,
      }),
    );
  }

  return Object.freeze(diagnostics);
}

/**
 * Detects kind-specific diagnostics for the expanded reference kinds
 * (aliases, packages, workspaces, dependencies, inheritance, unknown).
 */
export function detectSpecialReferenceDiagnostics(
  graph: ReferenceGraph,
  settings: ReferenceDiagnosticsSettings,
): readonly ReferenceDiagnostic[] {
  const diagnostics: ReferenceDiagnostic[] = [];
  const languageId = settings.languageId ?? "unknown";
  const fileOf = (reference: Reference): string | undefined => {
    return settings.symbols.get(reference.fromId)?.metadata.location.file;
  };

  for (const reference of graph.references) {
    if (reference.kind === "alias" && !reference.resolved) {
      diagnostics.push(
        createReferenceDiagnostic({
          code: "broken-alias",
          severity: "warning",
          message: `Alias "${reference.name ?? reference.payload?.aliasName}" does not resolve to a target symbol.`,
          languageId,
          ...(settings.resolverId !== undefined ? { resolverId: settings.resolverId } : {}),
          ...(fileOf(reference) !== undefined ? { file: fileOf(reference) } : {}),
          symbolId: reference.fromId,
          ...(reference.name !== undefined ? { referenceName: reference.name } : {}),
        }),
      );
      continue;
    }

    if (reference.kind === "package" && !reference.resolved) {
      diagnostics.push(
        createReferenceDiagnostic({
          code: "invalid-package-export",
          severity: "warning",
          message: `Package "${reference.payload?.packageName ?? reference.specifier}" does not resolve to a known package export.`,
          languageId,
          ...(settings.resolverId !== undefined ? { resolverId: settings.resolverId } : {}),
          ...(fileOf(reference) !== undefined ? { file: fileOf(reference) } : {}),
          symbolId: reference.fromId,
          ...(reference.specifier !== undefined ? { referenceName: reference.specifier } : {}),
        }),
      );
      continue;
    }

    if (reference.kind === "workspace" && !reference.resolved) {
      diagnostics.push(
        createReferenceDiagnostic({
          code: "broken-workspace-reference",
          severity: "warning",
          message: `Workspace reference "${reference.payload?.workspaceName ?? reference.specifier}" does not resolve to a discovered workspace package.`,
          languageId,
          ...(settings.resolverId !== undefined ? { resolverId: settings.resolverId } : {}),
          ...(fileOf(reference) !== undefined ? { file: fileOf(reference) } : {}),
          symbolId: reference.fromId,
          ...(reference.specifier !== undefined ? { referenceName: reference.specifier } : {}),
        }),
      );
      continue;
    }

    if (reference.kind === "dependency" && !reference.resolved) {
      diagnostics.push(
        createReferenceDiagnostic({
          code: "missing-dependency",
          severity: "warning",
          message: `Dependency "${reference.payload?.packageName ?? reference.name}" is not declared in the project's package metadata.`,
          languageId,
          ...(settings.resolverId !== undefined ? { resolverId: settings.resolverId } : {}),
          ...(fileOf(reference) !== undefined ? { file: fileOf(reference) } : {}),
          symbolId: reference.fromId,
          ...(reference.name !== undefined ? { referenceName: reference.name } : {}),
        }),
      );
      continue;
    }

    if ((reference.kind === "extends" || reference.kind === "implements") && !reference.resolved) {
      diagnostics.push(
        createReferenceDiagnostic({
          code: "invalid-inheritance",
          severity: "info",
          message: `Inheritance "${reference.name}" does not resolve to a known symbol.`,
          languageId,
          ...(settings.resolverId !== undefined ? { resolverId: settings.resolverId } : {}),
          ...(fileOf(reference) !== undefined ? { file: fileOf(reference) } : {}),
          symbolId: reference.fromId,
          ...(reference.name !== undefined ? { referenceName: reference.name } : {}),
        }),
      );
      continue;
    }

    if (reference.kind === "unknown") {
      diagnostics.push(
        createReferenceDiagnostic({
          code: "unsupported-reference",
          severity: "info",
          message: `Reference of unsupported kind "${reference.name ?? "unknown"}" was recorded.`,
          languageId,
          ...(settings.resolverId !== undefined ? { resolverId: settings.resolverId } : {}),
          ...(fileOf(reference) !== undefined ? { file: fileOf(reference) } : {}),
          symbolId: reference.fromId,
          ...(reference.name !== undefined ? { referenceName: reference.name } : {}),
        }),
      );
    }
  }

  return Object.freeze(diagnostics);
}
