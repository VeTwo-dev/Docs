/** The value type of a symbol extractor capability. */
export type SymbolCapabilityValue =
  boolean | "none" | "basic" | "full" | readonly string[] | string | number;

/** A map of capability names to levels. */
export type SymbolExtractorCapabilities = Readonly<Record<string, SymbolCapabilityValue>>;

/** Capabilities a symbol extractor can declare. */
export const KNOWN_SYMBOL_CAPABILITIES = [
  "documents",
  "generics",
  "overloads",
  "namespaces",
  "decorators",
  "re-exports",
  "barrels",
  "anonymous",
  "incremental",
  "parallel",
] as const;

/** A known symbol extractor capability name. */
export type KnownSymbolCapability = (typeof KNOWN_SYMBOL_CAPABILITIES)[number];

/** Whether `capability` is a known capability name. */
export function isKnownSymbolCapability(capability: string): boolean {
  return (KNOWN_SYMBOL_CAPABILITIES as readonly string[]).includes(capability);
}
