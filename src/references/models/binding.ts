/**
 * Per-file binding models.
 *
 * The symbol layer records a module's import *specifiers* but drops the name
 * bindings (`import { A as B }`). Reference resolvers recover those bindings
 * from the normalized syntax trees so the reference engine can resolve names
 * to symbols. All models are immutable and frozen.
 */

/**
 * A named/default/namespace import binding.
 *
 * `importedName` is `default` for default imports, `*` for namespace imports
 * (`import * as ns`), and the source-side name otherwise (`A` in
 * `import { A as B }`).
 */
export interface ReferenceImportBinding {
  /** The module specifier being imported from. */
  readonly specifier: string;
  /** The local binding name (`B` in `import { A as B }`). */
  readonly localName: string;
  /** The name imported from the target module. */
  readonly importedName: string;
}

/**
 * An export-clause binding: either a local re-export alias (`export { a as b }`,
 * no specifier) or a re-export from another module (`export { a as b } from`,
 * `export * as ns from`). `localName` is `*` for namespace re-exports.
 */
export interface ReferenceExportBinding {
  /** The exported name (`b`). */
  readonly exportedName: string;
  /** The backing local name (`a`) or `*` for namespace re-exports. */
  readonly localName: string;
  /** The module specifier, when the binding re-exports from another module. */
  readonly specifier?: string;
}

/** Everything a resolver recovers for one file. */
export interface ReferenceFileBindings {
  /** The relative source file path. */
  readonly file: string;
  /** Named/default/namespace import bindings. */
  readonly imports: readonly ReferenceImportBinding[];
  /** Local export-clause aliases (`export { a as b }`). */
  readonly exportAliases: readonly ReferenceExportBinding[];
  /** Re-export clauses (`export { a as b } from "./x"`, `export * as ns from`). */
  readonly reExports: readonly ReferenceExportBinding[];
}

/** An empty per-file binding set. */
export function emptyFileBindings(file: string): ReferenceFileBindings {
  return Object.freeze({ file, imports: [], exportAliases: [], reExports: [] });
}
