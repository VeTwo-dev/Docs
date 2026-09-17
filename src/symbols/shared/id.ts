/**
 * Deterministic symbol ids.
 *
 * Ids are pure functions of language, file and qualified name so they stay
 * stable across extraction runs — a precondition for incremental caching.
 */

/** The id of the project symbol. */
export function projectSymbolId(projectName: string): string {
  return `project:${projectName}`;
}

/** The id of a package symbol. */
export function packageSymbolId(projectName: string, packageName: string): string {
  return `package:${projectName}:${packageName}`;
}

/** The id of a module (file) symbol. */
export function moduleSymbolId(languageId: string, file: string, moduleName: string): string {
  return `module:${languageId}:${file}:${moduleName}`;
}

/** The id of a declaration symbol within a module. */
export function symbolId(languageId: string, file: string, qualifiedName: string): string {
  return `${languageId}:${file}:${qualifiedName}`;
}

/** Appends an overload discriminator to a symbol id. */
export function overloadId(baseId: string, index: number): string {
  return `${baseId}#${index}`;
}
