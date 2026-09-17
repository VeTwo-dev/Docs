import type { Symbol } from "../../symbols/index.js";
import type { Reference, ReferenceKind } from "../models/index.js";
import { isResolvedReference, isUnresolvedReference } from "../models/index.js";

/** The symbol context available to reference filters. */
export interface ReferenceFilterContext {
  readonly symbols: ReadonlyMap<string, Symbol>;
}

/** A predicate over references, with optional symbol context. */
export type ReferenceFilterPredicate = (
  reference: Reference,
  context?: ReferenceFilterContext,
) => boolean;

/** A {@link ReferenceFilter} (composable). */
export type ReferenceFilter = ReferenceFilterPredicate;

/** Accepts every reference. */
export function acceptAll(_reference: Reference): boolean {
  return true;
}

/** Only resolved references. */
export function resolved(reference: Reference): boolean {
  return isResolvedReference(reference);
}

/** Only unresolved references. */
export function unresolved(reference: Reference): boolean {
  return isUnresolvedReference(reference);
}

/** References of the given kind(s). */
export function ofKind(...kinds: readonly ReferenceKind[]): ReferenceFilter {
  const set = new Set(kinds);
  return (reference) => set.has(reference.kind);
}

/** References whose source symbol lives in `file`. */
export function inFile(file: string): ReferenceFilter {
  return (reference, context) => {
    if (context === undefined) return false;
    const symbol = context.symbols.get(reference.fromId);
    return symbol?.metadata.location.file === file;
  };
}

/** References whose source symbol id is `symbolId`. */
export function fromSymbol(symbolId: string): ReferenceFilter {
  return (reference) => reference.fromId === symbolId;
}

/** References whose resolved target symbol id is `symbolId`. */
export function toSymbol(symbolId: string): ReferenceFilter {
  return (reference) => reference.toId === symbolId;
}

/** References whose name matches `pattern`. */
export function matches(pattern: RegExp): ReferenceFilter {
  return (reference) => {
    if (reference.name === undefined) return false;
    return pattern.test(reference.name);
  };
}

/** Combines filters with AND. */
export function and(...filters: readonly ReferenceFilter[]): ReferenceFilter {
  return (reference, context) => filters.every((filter) => filter(reference, context));
}

/** Combines filters with OR. */
export function or(...filters: readonly ReferenceFilter[]): ReferenceFilter {
  return (reference, context) => filters.some((filter) => filter(reference, context));
}

/** Negates a filter. */
export function not(filter: ReferenceFilter): ReferenceFilter {
  return (reference, context) => !filter(reference, context);
}

/** Composes a filter list into a single predicate. */
export function composeFilter(...filters: readonly ReferenceFilter[]): ReferenceFilterPredicate {
  return and(...filters);
}

/** Applies a filter to a single reference. */
export function referenceMatchesFilter(
  reference: Reference,
  filter: ReferenceFilter,
  context?: ReferenceFilterContext,
): boolean {
  return filter(reference, context);
}
