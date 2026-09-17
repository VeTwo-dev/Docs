import type * as ts from "typescript";
import { loadNativeModule } from "../../shared/native.js";
import { extensionOf, normalizeExtension } from "../../../languages/utils/extension.js";

/**
 * The subset of the TypeScript compiler API the adapter consumes.
 *
 * The native module is loaded dynamically and cast to this structural type so
 * the adapter can degrade gracefully when the compiler is not installed
 * without pulling it into the eager module graph.
 */
export interface TypeScriptApi {
  readonly version: string;
  readonly ScriptTarget: { readonly Latest: ts.ScriptTarget };
  readonly ScriptKind: {
    readonly TS: ts.ScriptKind;
    readonly TSX: ts.ScriptKind;
    readonly JS: ts.ScriptKind;
    readonly JSX: ts.ScriptKind;
  };
  readonly JsxEmit: { readonly Preserve: ts.JsxEmit };
  readonly SyntaxKind: {
    readonly ImportKeyword: number;
  } & Readonly<Record<number, string>>;
  readonly NodeFlags: { readonly Const: number; readonly Let: number; readonly Using: number };
  readonly createSourceFile: (
    fileName: string,
    sourceText: string,
    languageVersion: ts.ScriptTarget,
    setParentNodes: boolean,
    scriptKind?: ts.ScriptKind,
  ) => ts.SourceFile;
  readonly forEachChild: (node: ts.Node, cbNode: (node: ts.Node) => void) => void;
  readonly isTokenKind: (kind: number) => boolean;
  readonly isIdentifier: (node: ts.Node) => node is ts.Identifier;
  readonly isStringLiteral: (node: ts.Node) => node is ts.StringLiteral;
  readonly isImportDeclaration: (node: ts.Node) => node is ts.ImportDeclaration;
  readonly isExportDeclaration: (node: ts.Node) => node is ts.ExportDeclaration;
  readonly isImportEqualsDeclaration: (node: ts.Node) => node is ts.ImportEqualsDeclaration;
  readonly isExternalModuleReference: (node: ts.Node) => node is ts.ExternalModuleReference;
  readonly isCallExpression: (node: ts.Node) => node is ts.CallExpression;
  readonly isDecorator: (node: ts.Node) => boolean;
  readonly isModifier: (node: ts.Node) => boolean;
  readonly isVariableDeclarationList: (node: ts.Node) => boolean;
  readonly getLeadingCommentRanges: (
    text: string,
    pos: number,
  ) => readonly { readonly kind: number; readonly pos: number; readonly end: number }[] | undefined;
  readonly transpileModule: (
    input: string,
    options: {
      compilerOptions?: ts.CompilerOptions;
      fileName?: string;
      moduleName?: string;
      reportDiagnostics?: boolean;
    },
  ) => { readonly outputText: string; readonly sourceMapText?: string };
}

/** The TypeScript compiler module namespace (injected at runtime). */
export type TypeScriptModule = TypeScriptApi;

let tsModule: Promise<TypeScriptModule | undefined> | undefined;

/** Lazily loads the TypeScript compiler, caching the module reference. */
export function loadTypeScript(): Promise<TypeScriptModule | undefined> {
  tsModule ??= loadNativeModule("typescript").then(
    (module) => module as TypeScriptModule | undefined,
  );
  return tsModule;
}

/** Maps a relative file path to the matching TypeScript script kind. */
export function scriptKindFor(file: string, ts: TypeScriptModule): ts.ScriptKind {
  const extension = normalizeExtension(extensionOf(file));
  switch (extension) {
    case ".tsx":
      return ts.ScriptKind.TSX;
    case ".jsx":
      return ts.ScriptKind.JSX;
    case ".js":
    case ".mjs":
    case ".cjs":
      return ts.ScriptKind.JS;
    case ".mts":
    case ".cts":
    case ".d.mts":
    case ".d.cts":
    case ".d.ts":
      return ts.ScriptKind.TS;
    default:
      return ts.ScriptKind.TS;
  }
}

/** The file extensions the TypeScript adapter can compile. */
export const TYPESCRIPT_EXTENSIONS: readonly string[] = Object.freeze([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
]);
