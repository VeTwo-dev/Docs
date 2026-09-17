import type { CompilerRange } from "../../compiler/index.js";
import type { SymbolKind } from "./kind.js";
import type { DocumentationComment, SymbolCompilerMetadata, SymbolMetadata } from "./metadata.js";
import { createSymbolMetadata } from "./metadata.js";

/** A re-export from a module (`export { a } from "./x"` / `export * from "./x"`). */
export interface SymbolReExport {
  /** The module specifier being re-exported from. */
  readonly specifier: string;
  /** The specific names re-exported; `undefined` means `export *`. */
  readonly names?: readonly string[];
}

/** A read-only registry of symbols by id, used to resolve ownership edges. */
export type SymbolStore = ReadonlyMap<string, Symbol>;

/** An empty symbol store (used when a symbol stands alone). */
export const EMPTY_SYMBOL_STORE: SymbolStore = new Map<string, Symbol>();

/**
 * A normalized, language-independent symbol.
 *
 * Every construct — module, class, method, parameter, decorator — collapses
 * to this shape. Ownership is explicit through {@link Symbol.parentId} and
 * {@link Symbol.childrenIds}; structural detail lives in the kind-specific
 * payload fields. Immutable and frozen by {@link createSymbol}.
 */
export interface Symbol {
  /** The symbol kind. */
  readonly kind: SymbolKind;
  /** The local identifier (mirrors `metadata.identifier`). */
  readonly name: string;
  /** The unique symbol id within a project (mirrors `metadata.id`). */
  readonly id: string;
  /** The universal metadata. */
  readonly metadata: SymbolMetadata;
  /** The owning symbol id (module, class, namespace, ...). */
  readonly parentId?: string;
  /** The ids of directly owned symbols. */
  readonly childrenIds: readonly string[];
  /** The shared store all symbols of a module resolve through. */
  readonly symbols: SymbolStore;

  // Kind-specific payload (structural only — never semantic).
  /** Class/interface heritage names (extends/implements). */
  readonly heritage?: readonly string[];
  /** The target type name for a type alias, when syntactically available. */
  readonly typeName?: string;
  /** Enum member names. */
  readonly enumMembers?: readonly string[];
  /** Overload signatures (parameter lists), one per declared overload. */
  readonly signatures?: readonly string[];
  /** A literal value (enum member, constant initializer), when known. */
  readonly value?: string;
  /** The declared parameter count for callables. */
  readonly parameterCount?: number;
  /** Names exported from a module. */
  readonly exports?: readonly string[];
  /** Module specifiers imported by a module. */
  readonly imports?: readonly string[];
  /** Re-exports declared by a module. */
  readonly reExports?: readonly SymbolReExport[];
  /** The package version of a package symbol. */
  readonly version?: string;
}

/** The root project symbol. */
export type ProjectSymbol = Symbol & { readonly kind: "project" };
/** A package within a project. */
export type PackageSymbol = Symbol & { readonly kind: "package" };
/** A module (source file) within a package. */
export type ModuleSymbol = Symbol & { readonly kind: "module" };
/** A namespace (TypeScript `namespace`/`module` block). */
export type NamespaceSymbol = Symbol & { readonly kind: "namespace" };
/** A class declaration. */
export type ClassSymbol = Symbol & { readonly kind: "class" };
/** An interface declaration. */
export type InterfaceSymbol = Symbol & { readonly kind: "interface" };
/** A type alias declaration. */
export type TypeAliasSymbol = Symbol & { readonly kind: "type-alias" };
/** An enum declaration. */
export type EnumSymbol = Symbol & { readonly kind: "enum" };
/** An enum member. */
export type EnumMemberSymbol = Symbol & { readonly kind: "enum-member" };
/** A function declaration or expression. */
export type FunctionSymbol = Symbol & { readonly kind: "function" };
/** A method declaration. */
export type MethodSymbol = Symbol & { readonly kind: "method" };
/** A constructor declaration. */
export type ConstructorSymbol = Symbol & { readonly kind: "constructor" };
/** A getter accessor. */
export type GetterSymbol = Symbol & { readonly kind: "getter" };
/** A setter accessor. */
export type SetterSymbol = Symbol & { readonly kind: "setter" };
/** A class/interface property. */
export type PropertySymbol = Symbol & { readonly kind: "property" };
/** A field. */
export type FieldSymbol = Symbol & { readonly kind: "field" };
/** A mutable variable. */
export type VariableSymbol = Symbol & { readonly kind: "variable" };
/** A constant binding. */
export type ConstantSymbol = Symbol & { readonly kind: "constant" };
/** A callable parameter. */
export type ParameterSymbol = Symbol & { readonly kind: "parameter" };
/** A decorator attached to a declaration. */
export type DecoratorSymbol = Symbol & { readonly kind: "decorator" };
/** A component (reserved for extension extractors). */
export type ComponentSymbol = Symbol & { readonly kind: "component" };
/** A hook (reserved for extension extractors). */
export type HookSymbol = Symbol & { readonly kind: "hook" };
/** A route (reserved for extension extractors). */
export type RouteSymbol = Symbol & { readonly kind: "route" };
/** A middleware (reserved for extension extractors). */
export type MiddlewareSymbol = Symbol & { readonly kind: "middleware" };
/** A configuration object (reserved for extension extractors). */
export type ConfigurationSymbol = Symbol & { readonly kind: "configuration" };
/** A construct the extractor could not classify. */
export type UnknownSymbol = Symbol & { readonly kind: "unknown" };

/** Every {@link Symbol} variant. */
export type AnySymbol =
  | ProjectSymbol
  | PackageSymbol
  | ModuleSymbol
  | NamespaceSymbol
  | ClassSymbol
  | InterfaceSymbol
  | TypeAliasSymbol
  | EnumSymbol
  | EnumMemberSymbol
  | FunctionSymbol
  | MethodSymbol
  | ConstructorSymbol
  | GetterSymbol
  | SetterSymbol
  | PropertySymbol
  | FieldSymbol
  | VariableSymbol
  | ConstantSymbol
  | ParameterSymbol
  | DecoratorSymbol
  | ComponentSymbol
  | HookSymbol
  | RouteSymbol
  | MiddlewareSymbol
  | ConfigurationSymbol
  | UnknownSymbol;

/** Input required to build a {@link Symbol}. */
export interface SymbolInput {
  readonly kind: SymbolKind;
  readonly identifier: string;
  readonly qualifiedName: string;
  readonly displayName?: string;
  readonly visibility?: SymbolMetadata["visibility"];
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
  readonly parentId?: string;
  readonly childrenIds?: readonly string[];
  readonly exported?: boolean;
  readonly internal?: boolean;
  readonly generated?: boolean;
  readonly deprecated?: boolean;
  readonly synthetic?: boolean;
  readonly id: string;
  readonly hash: string;
  /** The shared store the built symbol resolves through. */
  readonly symbols?: SymbolStore;
  readonly heritage?: readonly string[];
  readonly typeName?: string;
  readonly enumMembers?: readonly string[];
  readonly signatures?: readonly string[];
  readonly value?: string;
  readonly parameterCount?: number;
  readonly exports?: readonly string[];
  readonly imports?: readonly string[];
  readonly reExports?: readonly SymbolReExport[];
  readonly version?: string;
}

/** Builds an immutable {@link Symbol}. */
export function createSymbol(input: SymbolInput): Symbol {
  const metadata = createSymbolMetadata({
    identifier: input.identifier,
    qualifiedName: input.qualifiedName,
    displayName: input.displayName,
    kind: input.kind,
    visibility: input.visibility,
    modifiers: input.modifiers,
    file: input.file,
    range: input.range,
    languageId: input.languageId,
    packageName: input.packageName,
    moduleName: input.moduleName,
    namespace: input.namespace,
    documentation: input.documentation,
    attributes: input.attributes,
    compiler: input.compiler,
    id: input.id,
    hash: input.hash,
    exported: input.exported,
    internal: input.internal,
    generated: input.generated,
    deprecated: input.deprecated,
    synthetic: input.synthetic,
  });
  const childrenIds = Object.freeze([...(input.childrenIds ?? [])]);
  return Object.freeze({
    kind: input.kind,
    name: metadata.identifier,
    id: metadata.id,
    metadata,
    ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
    childrenIds,
    symbols: input.symbols ?? EMPTY_SYMBOL_STORE,
    ...(input.heritage !== undefined ? { heritage: Object.freeze([...input.heritage]) } : {}),
    ...(input.typeName !== undefined ? { typeName: input.typeName } : {}),
    ...(input.enumMembers !== undefined
      ? { enumMembers: Object.freeze([...input.enumMembers]) }
      : {}),
    ...(input.signatures !== undefined ? { signatures: Object.freeze([...input.signatures]) } : {}),
    ...(input.value !== undefined ? { value: input.value } : {}),
    ...(input.parameterCount !== undefined ? { parameterCount: input.parameterCount } : {}),
    ...(input.exports !== undefined ? { exports: Object.freeze([...input.exports]) } : {}),
    ...(input.imports !== undefined ? { imports: Object.freeze([...input.imports]) } : {}),
    ...(input.reExports !== undefined
      ? {
          reExports: Object.freeze(
            input.reExports.map((re) =>
              Object.freeze({
                specifier: re.specifier,
                ...(re.names !== undefined ? { names: Object.freeze([...re.names]) } : {}),
              }),
            ),
          ),
        }
      : {}),
    ...(input.version !== undefined ? { version: input.version } : {}),
  });
}

/** The result of building a set of symbols that share a store. */
export interface SymbolCollection {
  readonly store: SymbolStore;
  readonly symbols: readonly Symbol[];
}

/**
 * Builds symbols and a shared store from inputs.
 *
 * Ownership edges (`parentId`/`childrenIds`) resolve through `store`, so
 * callers must include every symbol of a module in one call.
 */
export function buildSymbols(inputs: readonly SymbolInput[]): SymbolCollection {
  const store = new Map<string, Symbol>();
  const symbols = inputs.map((input) => {
    const symbol = createSymbol({ ...input, symbols: store });
    store.set(symbol.id, symbol);
    return symbol;
  });
  return Object.freeze({ store, symbols: Object.freeze(symbols) });
}

/** Whether a symbol has the given kind. */
export function isSymbolOfKind<K extends SymbolKind>(
  symbol: Symbol,
  kind: K,
): symbol is Symbol & { readonly kind: K } {
  return symbol.kind === kind;
}

/** Whether a symbol is a module (file) symbol. */
export function isModuleSymbol(symbol: Symbol): symbol is ModuleSymbol {
  return symbol.kind === "module";
}

/** Whether a symbol is callable (function, method, constructor). */
export function isCallableSymbol(
  symbol: Symbol,
): symbol is FunctionSymbol | MethodSymbol | ConstructorSymbol {
  return symbol.kind === "function" || symbol.kind === "method" || symbol.kind === "constructor";
}
