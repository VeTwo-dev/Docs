import { loadNativeModule } from "../../shared/native.js";
import type { BabelFileNode } from "./tree.js";

interface BabelParserModule {
  readonly parse?: (code: string, options?: unknown) => BabelFileNode;
}

let babelModule: Promise<BabelParserModule | undefined> | undefined;

/** Lazily loads the Babel parser, caching the module reference. */
export function loadBabelParser(): Promise<BabelParserModule | undefined> {
  babelModule ??= loadNativeModule("@babel/parser").then(
    (module) => module as BabelParserModule | undefined,
  );
  return babelModule;
}

/** The parser plugins the JavaScript adapter enables. */
export const BABEL_PLUGINS: readonly unknown[] = Object.freeze([
  "jsx",
  "decorators-legacy",
  "decoratorAutoAccessors",
  "importMeta",
  "dynamicImport",
  "topLevelAwait",
  "classProperties",
  "classPrivateProperties",
  "classPrivateMethods",
  "exportDefaultFrom",
  "exportNamespaceFrom",
  "importAttributes",
]);

/** The file extensions the JavaScript adapter can compile. */
export const JAVASCRIPT_EXTENSIONS: readonly string[] = Object.freeze([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);
