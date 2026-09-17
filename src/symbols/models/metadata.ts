import type { CompilerRange } from "../../compiler/index.js";
import type { SymbolKind } from "./kind.js";

/** The visibility of a symbol. */
export type SymbolVisibility = "public" | "protected" | "private" | "internal" | "package";

/** Where a symbol lives in its source file. */
export interface SymbolLocation {
  /** The relative source file path. */
  readonly file: string;
  /** The source range, when known. */
  readonly range?: CompilerRange;
}

/** A single documentation tag (e.g. `@param name - text`). */
export interface DocumentationTag {
  /** The tag name without the leading `@` (e.g. `param`, `returns`). */
  readonly tag: string;
  /** The first identifier after the tag, when present (e.g. a parameter name). */
  readonly name?: string;
  /** The tag body text, when present. */
  readonly text?: string;
}

/**
 * A captured documentation comment.
 *
 * The raw comment is stored alongside its structural tags. Comments are
 * captured, not interpreted: no semantic meaning is attached here.
 */
export interface DocumentationComment {
  /** The raw comment text, including the `/**` delimiters. */
  readonly text: string;
  /** The free-text summary (the part before the first tag), trimmed. */
  readonly summary?: string;
  /** The parsed structural tags. */
  readonly tags: readonly DocumentationTag[];
  /** The comment format. */
  readonly format: "tsdoc" | "jsdoc" | "docstring" | "plain";
}

/** Compiler provenance for a symbol. */
export interface SymbolCompilerMetadata {
  /** The compiler adapter id that produced the compilation unit. */
  readonly compilerId: string;
  /** The syntax format of the source tree (e.g. `typescript`, `ecmascript`). */
  readonly format: string;
  /** The native compiler version, when known. */
  readonly nativeVersion?: string;
}

/**
 * The universal metadata every symbol exposes.
 *
 * Immutable and frozen by the {@link createSymbolMetadata} constructor.
 */
export interface SymbolMetadata {
  /** The local identifier. May be a synthetic name for anonymous declarations. */
  readonly identifier: string;
  /** The fully qualified name (package.module.namespace.Class.member). */
  readonly qualifiedName: string;
  /** A human-friendly display name. */
  readonly displayName: string;
  /** The symbol kind. */
  readonly kind: SymbolKind;
  /** The symbol visibility. */
  readonly visibility: SymbolVisibility;
  /** Modifier keywords and structural flags (e.g. `export`, `static`, `const`). */
  readonly modifiers: readonly string[];
  /** Where the symbol is declared. */
  readonly location: SymbolLocation;
  /** The language adapter id. */
  readonly languageId: string;
  /** The owning package name, when known. */
  readonly packageName?: string;
  /** The owning module (file) name, when known. */
  readonly moduleName?: string;
  /** The enclosing namespace names, outermost first. */
  readonly namespace?: readonly string[];
  /** The relative source file path. */
  readonly sourceFile: string;
  /** The captured documentation comment, when present. */
  readonly documentation?: DocumentationComment;
  /** Extractor-supplied key/value attributes (structural, never semantic). */
  readonly attributes: Readonly<Record<string, string>>;
  /** Compiler provenance. */
  readonly compiler: SymbolCompilerMetadata;
  /** The unique symbol id within a project. */
  readonly id: string;
  /** The stable content hash. */
  readonly hash: string;
  /** Whether the symbol is exported from its module. */
  readonly exported: boolean;
  /** Whether the symbol is marked internal (`@internal`). */
  readonly internal: boolean;
  /** Whether the symbol is generated (declaration files, `@generated`). */
  readonly generated: boolean;
  /** Whether the symbol is deprecated (`@deprecated`). */
  readonly deprecated: boolean;
  /** Whether the identifier was synthesized (e.g. anonymous default exports). */
  readonly synthetic: boolean;
}

/** Input required to build a {@link SymbolMetadata}. */
export interface SymbolMetadataInput {
  readonly identifier: string;
  readonly qualifiedName: string;
  readonly displayName?: string;
  readonly kind: SymbolKind;
  readonly visibility?: SymbolVisibility;
  readonly modifiers?: readonly string[];
  readonly file: string;
  readonly range?: CompilerRange;
  readonly languageId: string;
  readonly packageName?: string;
  readonly moduleName?: string;
  readonly namespace?: readonly string[];
  readonly documentation?: DocumentationComment;
  readonly attributes?: Readonly<Record<string, string>>;
  readonly compiler: SymbolCompilerMetadata;
  readonly id: string;
  readonly hash: string;
  readonly exported?: boolean;
  readonly internal?: boolean;
  readonly generated?: boolean;
  readonly deprecated?: boolean;
  readonly synthetic?: boolean;
}

/** Builds an immutable {@link SymbolMetadata}. */
export function createSymbolMetadata(input: SymbolMetadataInput): SymbolMetadata {
  const modifiers = Object.freeze([...(input.modifiers ?? [])]);
  const namespace = Object.freeze([...(input.namespace ?? [])]);
  const attributes = Object.freeze({ ...(input.attributes ?? {}) });
  const location = Object.freeze({
    file: input.file,
    ...(input.range !== undefined ? { range: input.range } : {}),
  });
  const compiler = Object.freeze({
    compilerId: input.compiler.compilerId,
    format: input.compiler.format,
    ...(input.compiler.nativeVersion !== undefined
      ? { nativeVersion: input.compiler.nativeVersion }
      : {}),
  });
  return Object.freeze({
    identifier: input.identifier,
    qualifiedName: input.qualifiedName,
    displayName: input.displayName ?? input.identifier,
    kind: input.kind,
    visibility: input.visibility ?? "public",
    modifiers,
    location,
    languageId: input.languageId,
    ...(input.packageName !== undefined ? { packageName: input.packageName } : {}),
    ...(input.moduleName !== undefined ? { moduleName: input.moduleName } : {}),
    ...(namespace.length > 0 ? { namespace } : {}),
    sourceFile: input.file,
    ...(input.documentation !== undefined ? { documentation: input.documentation } : {}),
    attributes,
    compiler,
    id: input.id,
    hash: input.hash,
    exported: input.exported ?? false,
    internal: input.internal ?? false,
    generated: input.generated ?? false,
    deprecated: input.deprecated ?? false,
    synthetic: input.synthetic ?? false,
  });
}
