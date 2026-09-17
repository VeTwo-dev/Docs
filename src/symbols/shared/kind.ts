import type { SymbolKind } from "../models/kind.js";

/**
 * Maps normalized tree node kind strings to symbol kinds.
 *
 * The compiler layer normalizes node kinds to native enum/type names
 * (`FunctionDeclaration`, `ClassDeclaration`, ...), which differ per syntax
 * format. Extractors translate through these tables — the symbols layer never
 * inspects native nodes.
 */

/** TypeScript `SyntaxKind` enum-name → symbol kind. */
export const TYPESCRIPT_NODE_KIND_MAP: Readonly<Record<string, SymbolKind>> = Object.freeze({
  FunctionDeclaration: "function",
  ClassDeclaration: "class",
  InterfaceDeclaration: "interface",
  TypeAliasDeclaration: "type-alias",
  EnumDeclaration: "enum",
  EnumMember: "enum-member",
  ModuleDeclaration: "namespace",
  MethodDeclaration: "method",
  MethodSignature: "method",
  Constructor: "constructor",
  GetAccessor: "getter",
  SetAccessor: "setter",
  PropertyDeclaration: "property",
  PropertySignature: "property",
  VariableDeclaration: "variable",
  Parameter: "parameter",
  Decorator: "decorator",
  FunctionExpression: "function",
  ArrowFunction: "function",
});

/** Babel node type → symbol kind. */
export const BABEL_NODE_KIND_MAP: Readonly<Record<string, SymbolKind>> = Object.freeze({
  FunctionDeclaration: "function",
  ClassDeclaration: "class",
  ClassMethod: "method",
  ClassPrivateMethod: "method",
  ClassProperty: "property",
  ClassPrivateProperty: "property",
  ClassAccessorProperty: "property",
  ObjectMethod: "method",
  ObjectProperty: "property",
  VariableDeclarator: "variable",
  FunctionExpression: "function",
  ArrowFunctionExpression: "function",
  ObjectPattern: "parameter",
  ArrayPattern: "parameter",
  AssignmentPattern: "parameter",
  RestElement: "parameter",
  Identifier: "parameter",
  Decorator: "decorator",
});

/** The symbol kind for an unmapped node kind. */
export const UNKNOWN_SYMBOL_KIND: SymbolKind = "unknown";

/** Maps a TypeScript node kind string to a symbol kind. */
export function typeScriptKindFor(nodeKind: string): SymbolKind {
  return TYPESCRIPT_NODE_KIND_MAP[nodeKind] ?? UNKNOWN_SYMBOL_KIND;
}

/** Maps a Babel node type string to a symbol kind. */
export function babelKindFor(nodeType: string): SymbolKind {
  return BABEL_NODE_KIND_MAP[nodeType] ?? UNKNOWN_SYMBOL_KIND;
}
