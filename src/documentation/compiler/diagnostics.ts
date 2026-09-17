/**
 * Documentation Compiler Diagnostics.
 *
 * Structured, code-stable diagnostics produced during compilation.
 * Levels: info / warning / error. Codes are part of the public contract.
 */

export type DiagnosticSeverity = "info" | "warning" | "error";

/** Stable diagnostic codes emitted by the compiler and content system. */
export type DocumentationDiagnosticCode =
  | "DOC_UNDOCUMENTED_PUBLIC_API"
  | "DOC_ORPHAN_PAGE"
  | "DOC_DUPLICATE_CONTENT"
  | "DOC_BROKEN_RELATIONSHIP"
  | "DOC_LOW_CONFIDENCE_CLAIM"
  | "DOC_MISSING_EXAMPLE"
  | "DOC_NAVIGATION_DEPTH"
  | "DOC_EMPTY_SECTION"
  | "DOC_EMPTY_PAGE"
  | "DOC_STALE_PAGE"
  | "DOC_UNSTABLE_NAVIGATION"
  | "DOC_CANONICAL_CONFLICT"
  // Content authoring & composition (Phase 17)
  | "DOC_UNKNOWN_COMPONENT"
  | "DOC_MISSING_REQUIRED_PROP"
  | "DOC_INVALID_PROP_TYPE"
  | "DOC_INVALID_NESTING"
  | "DOC_CONTENT_CONFLICT"
  | "DOC_CONTENT_CYCLE"
  | "DOC_GENERATED_FILE_MODIFIED"
  | "DOC_STALE_TRANSLATION"
  | "DOC_BROKEN_LINK"
  | "DOC_MISSING_ANCHOR"
  | "DOC_DUPLICATE_TITLE"
  | "DOC_DUPLICATE_BREADCRUMB"
  | "DOC_DUPLICATE_HEADING_ID"
  | "DOC_INVALID_HEADING_HIERARCHY"
  | "DOC_EMPTY_HEADING"
  | "DOC_EXCESSIVE_HEADING_DEPTH"
  | "DOC_MISSING_ALT_TEXT"
  | "DOC_INVALID_FRONTMATTER"
  | "DOC_INCONSISTENT_TERMINOLOGY"
  | "DOC_INVALID_CODE_LANGUAGE"
  | "DOC_MISSING_DESCRIPTION"
  | "DOC_LOCKED_CONTENT_CHANGED"
  | "DOC_PROTECTED_PAGE_REGENERATED";

/** A single structured diagnostic. */
export interface DocumentationDiagnostic {
  /** Stable machine-readable code. */
  readonly code: DocumentationDiagnosticCode;
  readonly severity: DiagnosticSeverity;
  /** Human-readable message. */
  readonly message: string;
  /** Page slug or section id this diagnostic applies to. */
  readonly subject?: string;
  /** Suggested remediation. */
  readonly suggestion?: string;
}

/** Create a diagnostic (keeps construction terse at call sites). */
export function diagnostic(
  code: DocumentationDiagnosticCode,
  severity: DiagnosticSeverity,
  message: string,
  subject?: string,
  suggestion?: string,
): DocumentationDiagnostic {
  return { code, severity, message, subject, suggestion };
}
