/**
 * Semantic API Symbol Model.
 *
 * Rich, structured representation of a public API surface — every
 * function, class, interface, enum, type alias, and variable. Produced by
 * the semantic analyzer using the TypeScript Compiler API's type checker.
 *
 * This model is the single source of truth for API documentation. It feeds
 * into the Documentation IR via the page generator and is also used for
 * API change detection, validation, and search indexing.
 */

/** The kind of an API symbol. */
export type ApiSymbolKind =
  | "function"
  | "class"
  | "interface"
  | "type-alias"
  | "enum"
  | "variable"
  | "constant"
  | "method"
  | "constructor"
  | "property"
  | "getter"
  | "setter"
  | "enum-member";

/** Visibility modifier on a member. */
export type ApiAccess = "public" | "protected" | "private";

/** Documentation boundary for symbols. */
export type ApiBoundary = "public" | "semi-public" | "internal" | "private";

/** A generic type parameter. */
export interface ApiTypeParameter {
  readonly name: string;
  readonly constraint?: string;
  readonly default?: string;
}

/** A parameter of a callable symbol. */
export interface ApiParameter {
  readonly name: string;
  readonly type: string;
  readonly description: string;
  readonly required: boolean;
  readonly defaultValue?: string;
  readonly rest: boolean;
}

/** A member of a class or interface. */
export interface ApiMember {
  readonly name: string;
  readonly kind: "method" | "property" | "constructor" | "getter" | "setter";
  readonly signature: string;
  readonly description: string;
  readonly tags: Readonly<Record<string, readonly string[]>>;
  readonly required: boolean;
  readonly static: boolean;
  readonly readonly: boolean;
  readonly access: ApiAccess;
  readonly type?: string;
  readonly returnType?: string;
  readonly parameters?: readonly ApiParameter[];
  readonly typeParameters?: readonly ApiTypeParameter[];
  readonly line: number;
  readonly column: number;
  readonly deprecated: boolean | string;
}

/** An enum member with its value. */
export interface ApiEnumMember {
  readonly name: string;
  readonly value: string | number;
  readonly description: string;
  readonly line: number;
}

/** Parsed documentation comment. */
export interface ApiDocComment {
  readonly summary: string;
  readonly params: ReadonlyArray<{
    readonly name: string;
    readonly description: string;
  }>;
  readonly returns?: string;
  readonly examples: ReadonlyArray<{
    readonly title?: string;
    readonly code: string;
    readonly language: string;
  }>;
  readonly since?: string;
  readonly deprecated?: string;
  readonly throws: ReadonlyArray<{ readonly type?: string; readonly description: string }>;
  readonly see: ReadonlyArray<{ readonly text: string; readonly url?: string }>;
  readonly links: ReadonlyArray<{ readonly text: string; readonly target: string }>;
  readonly tags: Readonly<Record<string, readonly string[]>>;
  readonly raw: string;
}

/** A semantic API symbol with full type information. */
export interface ApiSymbol {
  /** Project-unique identifier (hash of qualified name + source file). */
  readonly id: string;
  /** Local identifier. */
  readonly name: string;
  /** Qualified name: "moduleName.symbolName" or "ClassName.methodName". */
  readonly qualifiedName: string;
  /** The symbol kind. */
  readonly kind: ApiSymbolKind;

  // ─── Type Information ──────────────────────────────────────────────

  /** Human-readable return type (for callables). */
  readonly returnType?: string;
  /** Generic type parameters. */
  readonly typeParameters?: readonly ApiTypeParameter[];
  /** Parameters (for functions, constructors, methods). */
  readonly parameters?: readonly ApiParameter[];

  // ─── Heritage ──────────────────────────────────────────────────────

  /** The resolved superclass name (for classes/interfaces). */
  readonly extends?: string;
  /** The resolved interface names this symbol implements. */
  readonly implements?: readonly string[];

  // ─── Members ───────────────────────────────────────────────────────

  /** Members of a class or interface. */
  readonly members?: readonly ApiMember[];

  // ─── Enum ──────────────────────────────────────────────────────────

  /** Enum members with values. */
  readonly enumMembers?: readonly ApiEnumMember[];

  // ─── Documentation ─────────────────────────────────────────────────

  /** Parsed documentation comment. */
  readonly documentation: ApiDocComment;

  // ─── Source Location ───────────────────────────────────────────────

  /** Source file path (relative to project root). */
  readonly sourceFile: string;
  /** 1-based line number. */
  readonly line: number;
  /** 1-based column number. */
  readonly column: number;

  // ─── Metadata ──────────────────────────────────────────────────────

  /** Whether this symbol is exported. */
  readonly exported: boolean;
  /** Deprecation status: `false` not deprecated, `string` is the message. */
  readonly deprecated: boolean | string;
  /** The `@since` tag value, if present. */
  readonly since?: string;
  /** Documentation boundary classification. */
  readonly boundary: ApiBoundary;

  // ─── Overloads ─────────────────────────────────────────────────────

  /** Overloaded signatures (for functions/methods with multiple call signatures). */
  readonly overloads?: readonly ApiSymbol[];
}

/** The result of a semantic API analysis. */
export interface ApiAnalysisResult {
  /** All analyzed API symbols. */
  readonly symbols: readonly ApiSymbol[];
  /** Symbols indexed by id for O(1) lookup. */
  readonly symbolsById: ReadonlyMap<string, ApiSymbol>;
  /** Symbols indexed by qualified name. */
  readonly symbolsByName: ReadonlyMap<string, ApiSymbol>;
  /** Files analyzed. */
  readonly files: readonly string[];
  /** Analysis timestamp. */
  readonly analyzedAt: string;
  /** Source file hashes for incremental detection. */
  readonly fileHashes: ReadonlyMap<string, string>;
}
