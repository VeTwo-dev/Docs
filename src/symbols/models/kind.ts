/**
 * Universal symbol kinds.
 *
 * The kind vocabulary is language-independent: every extractor maps its
 * native constructs onto these kinds. Framework-oriented kinds
 * (`component`, `hook`, `route`, `middleware`, `configuration`) are part of
 * the universal model and reserved for extensions; the built-in extractors
 * never perform framework-specific classification.
 */
export const SYMBOL_KINDS = [
  "project",
  "package",
  "module",
  "namespace",
  "class",
  "interface",
  "type-alias",
  "enum",
  "enum-member",
  "function",
  "method",
  "constructor",
  "getter",
  "setter",
  "property",
  "field",
  "variable",
  "constant",
  "parameter",
  "decorator",
  "component",
  "hook",
  "route",
  "middleware",
  "configuration",
  "unknown",
] as const;

/** The kind of a {@link Symbol}. */
export type SymbolKind = (typeof SYMBOL_KINDS)[number];

/** Whether `kind` is a known symbol kind. */
export function isSymbolKind(kind: string): kind is SymbolKind {
  return (SYMBOL_KINDS as readonly string[]).includes(kind);
}
