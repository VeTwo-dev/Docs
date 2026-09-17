/**
 * The capability system.
 *
 * Languages declare capabilities instead of the core making assumptions.
 * Known capabilities are the canonical set the engine understands; adapters
 * may also declare custom capability keys, which the engine treats
 * opaquely.
 */

/** Canonical capability keys understood by the engine. */
export const KNOWN_CAPABILITIES = [
  "scanning",
  "compilation",
  "parsing",
  "ast",
  "typeSystem",
  "comments",
  "imports",
  "exports",
  "modules",
  "packages",
  "generics",
  "decorators",
  "macros",
  "reflection",
  "incrementalCompilation",
  "sourceMaps",
  "diagnostics",
  "documentationComments",
  "examples",
  "languageServer",
  "semanticTokens",
] as const;

/** A canonical capability key. */
export type KnownCapability = (typeof KNOWN_CAPABILITIES)[number];

/** A value a capability may declare. */
export type CapabilityValue =
  boolean | "none" | "basic" | "full" | readonly string[] | string | number;

/**
 * A capability map. Each key is either a {@link KnownCapability} or a custom
 * adapter-specific capability.
 */
export interface LanguageCapabilities {
  readonly [capability: string]: CapabilityValue | undefined;
}

/** Whether `name` is one of the canonical capability keys. */
export function isKnownCapability(name: string): name is KnownCapability {
  return (KNOWN_CAPABILITIES as readonly string[]).includes(name);
}

/**
 * Whether `value` is a valid declaration for capability `name`.
 *
 * Known capabilities accept booleans, the `none`/`basic`/`full` levels and
 * string arrays (e.g. `documentationComments: ["jsdoc", "tsdoc"]`). Custom
 * capabilities additionally accept arbitrary strings and numbers.
 */
export function isValidCapabilityValue(name: string, value: unknown): value is CapabilityValue {
  if (value === undefined || value === null) return false;
  if (typeof value === "boolean") return true;
  if (value === "none" || value === "basic" || value === "full") return true;
  if (Array.isArray(value)) return value.every((item) => typeof item === "string");
  if (typeof value === "string" || typeof value === "number") return !isKnownCapability(name);
  return false;
}
