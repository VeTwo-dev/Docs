import type { Symbol } from "../models/index.js";
import type { SymbolKind } from "../models/index.js";

/** A predicate over symbols. */
export type SymbolFilter = (symbol: Symbol) => boolean;

/** A fully serializable filter description. */
export interface SymbolFilterPredicate {
  readonly kinds?: readonly SymbolKind[];
  readonly exported?: boolean;
  readonly internal?: boolean;
  readonly deprecated?: boolean;
  readonly generated?: boolean;
  readonly name?: string;
  readonly namePattern?: RegExp;
}

/** Predicate symbols the {@link SymbolFilterPredicate} describes. */
export function symbolMatchesFilter(symbol: Symbol, predicate: SymbolFilterPredicate): boolean {
  if (predicate.kinds !== undefined && !predicate.kinds.includes(symbol.kind)) return false;
  if (predicate.exported !== undefined && symbol.metadata.exported !== predicate.exported) {
    return false;
  }
  if (predicate.internal !== undefined && symbol.metadata.internal !== predicate.internal) {
    return false;
  }
  if (predicate.deprecated !== undefined && symbol.metadata.deprecated !== predicate.deprecated) {
    return false;
  }
  if (predicate.generated !== undefined && symbol.metadata.generated !== predicate.generated) {
    return false;
  }
  if (predicate.name !== undefined && symbol.name !== predicate.name) return false;
  if (
    predicate.namePattern !== undefined &&
    !predicate.namePattern.test(symbol.metadata.qualifiedName)
  ) {
    return false;
  }
  return true;
}

/** A collection of predicates, each of which must pass. */
export function and(...filters: readonly SymbolFilter[]): SymbolFilter {
  return (symbol) => filters.every((filter) => filter(symbol));
}

/** A collection of predicates, any of which may pass. */
export function or(...filters: readonly SymbolFilter[]): SymbolFilter {
  return (symbol) => filters.some((filter) => filter(symbol));
}

/** A predicate that always passes. */
export const acceptAll: SymbolFilter = () => true;

/** Predicate symbols whose kind is in `kinds`. */
export function ofKind(...kinds: readonly SymbolKind[]): SymbolFilter {
  const set = new Set(kinds);
  return (symbol) => set.has(symbol.kind);
}

/** Predicate symbols declared in the given file. */
export function inFile(file: string): SymbolFilter {
  return (symbol) => symbol.metadata.sourceFile === file;
}

/** Predicate symbols inside the given package. */
export function inPackage(packageName: string): SymbolFilter {
  return (symbol) => symbol.metadata.packageName === packageName;
}

/** Predicate exported symbols. */
export const exported: SymbolFilter = (symbol) => symbol.metadata.exported;

/** Predicate deprecated symbols. */
export const deprecated: SymbolFilter = (symbol) => symbol.metadata.deprecated;

/** Predicate symbols matching a predicate description. */
export function matches(predicate: SymbolFilterPredicate): SymbolFilter {
  return (symbol) => symbolMatchesFilter(symbol, predicate);
}

/** Composes a symbol filter from a predicate description. */
export function composeFilter(predicate: SymbolFilterPredicate): SymbolFilter {
  return matches(predicate);
}
