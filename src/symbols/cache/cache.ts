import type { Symbol, SymbolInput } from "../models/index.js";
import { buildSymbols } from "../models/index.js";

/** A serializable snapshot of one file's extraction, keyed by content hash. */
interface CachedFileEntry {
  readonly hash: string;
  /** The symbols of the file, serialized to inputs. */
  readonly inputs: readonly SymbolInput[];
  /** The ids of the top-level module symbols (roots). */
  readonly moduleIds: readonly string[];
}

/**
 * An in-memory per-file extraction cache.
 *
 * Entries are keyed by the compiler unit hash; when a file's hash matches,
 * its symbols are rebuilt from serialized inputs without re-extraction. The
 * cache never observes file contents — hashing is the compiler's job.
 */
export class SymbolCache {
  private readonly entries = new Map<string, CachedFileEntry>();

  /** Whether `file` has a cached entry matching `hash`. */
  has(file: string, hash: string): boolean {
    const entry = this.entries.get(file);
    return entry !== undefined && entry.hash === hash;
  }

  /** Rebuilds the cached symbols for `file`, or undefined on a hash mismatch. */
  get(file: string, hash: string): readonly Symbol[] | undefined {
    const entry = this.entries.get(file);
    if (entry === undefined || entry.hash !== hash) return undefined;
    const { symbols } = buildSymbols(entry.inputs);
    return symbols;
  }

  /** Rebuilds the cached symbols for `file` regardless of its hash. */
  peek(file: string): readonly Symbol[] | undefined {
    const entry = this.entries.get(file);
    if (entry === undefined) return undefined;
    const { symbols } = buildSymbols(entry.inputs);
    return symbols;
  }

  /** Stores the extracted symbols of `file` under `hash`. */
  put(file: string, hash: string, symbols: readonly Symbol[]): void {
    this.entries.set(file, {
      hash,
      inputs: symbols.map((symbol) => symbolToInput(symbol)),
      moduleIds: symbols.filter((symbol) => symbol.kind === "module").map((symbol) => symbol.id),
    });
  }

  /** Drops a file from the cache. */
  delete(file: string): boolean {
    return this.entries.delete(file);
  }

  /** The cached files. */
  files(): readonly string[] {
    return [...this.entries.keys()];
  }

  /** The cached module ids. */
  moduleIds(): readonly string[] {
    return [...this.entries.values()].flatMap((entry) => entry.moduleIds);
  }

  /** The number of cached files. */
  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }
}

/** Dehydrates a symbol into a cacheable input. */
export function symbolToInput(symbol: Symbol): SymbolInput {
  return {
    kind: symbol.kind,
    identifier: symbol.metadata.identifier,
    qualifiedName: symbol.metadata.qualifiedName,
    displayName: symbol.metadata.displayName,
    visibility: symbol.metadata.visibility,
    modifiers: symbol.metadata.modifiers,
    file: symbol.metadata.location.file,
    ...(symbol.metadata.location.range !== undefined
      ? { range: symbol.metadata.location.range }
      : {}),
    languageId: symbol.metadata.languageId,
    ...(symbol.metadata.packageName !== undefined
      ? { packageName: symbol.metadata.packageName }
      : {}),
    ...(symbol.metadata.moduleName !== undefined ? { moduleName: symbol.metadata.moduleName } : {}),
    ...(symbol.metadata.namespace !== undefined ? { namespace: symbol.metadata.namespace } : {}),
    ...(symbol.metadata.documentation !== undefined
      ? { documentation: symbol.metadata.documentation }
      : {}),
    attributes: symbol.metadata.attributes,
    compiler: symbol.metadata.compiler,
    ...(symbol.parentId !== undefined ? { parentId: symbol.parentId } : {}),
    childrenIds: symbol.childrenIds,
    exported: symbol.metadata.exported,
    internal: symbol.metadata.internal,
    generated: symbol.metadata.generated,
    deprecated: symbol.metadata.deprecated,
    synthetic: symbol.metadata.synthetic,
    id: symbol.id,
    hash: symbol.metadata.hash,
    ...(symbol.heritage !== undefined ? { heritage: symbol.heritage } : {}),
    ...(symbol.typeName !== undefined ? { typeName: symbol.typeName } : {}),
    ...(symbol.enumMembers !== undefined ? { enumMembers: symbol.enumMembers } : {}),
    ...(symbol.signatures !== undefined ? { signatures: symbol.signatures } : {}),
    ...(symbol.value !== undefined ? { value: symbol.value } : {}),
    ...(symbol.parameterCount !== undefined ? { parameterCount: symbol.parameterCount } : {}),
    ...(symbol.exports !== undefined ? { exports: symbol.exports } : {}),
    ...(symbol.imports !== undefined ? { imports: symbol.imports } : {}),
    ...(symbol.reExports !== undefined ? { reExports: symbol.reExports } : {}),
    ...(symbol.version !== undefined ? { version: symbol.version } : {}),
  };
}
