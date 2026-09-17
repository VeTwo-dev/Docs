import type { CapabilityValue } from "../../languages/contracts/capabilities.js";

/**
 * Compiler capabilities.
 *
 * The engine queries capabilities instead of assuming support. Values follow
 * the language subsystem convention: booleans and `none|basic|full` levels for
 * canonical capabilities, plus arbitrary values for custom capabilities.
 */

/** Canonical compiler capabilities. */
export const KNOWN_COMPILER_CAPABILITIES = [
  "parsing",
  "incremental",
  "watch",
  "sourceMaps",
  "comments",
  "modules",
  "decorators",
  "jsx",
  "generics",
  "diagnostics",
  "projectReferences",
  "cache",
  "parallel",
] as const;

/** A canonical compiler capability key. */
export type KnownCompilerCapability = (typeof KNOWN_COMPILER_CAPABILITIES)[number];

/** Whether `capability` is a canonical compiler capability. */
export function isKnownCompilerCapability(capability: string): boolean {
  return (KNOWN_COMPILER_CAPABILITIES as readonly string[]).includes(capability);
}

/** Whether a capability value is valid for a compiler capability. */
export function isValidCompilerCapabilityValue(
  capability: string,
  value: CapabilityValue,
): boolean {
  if (typeof value === "boolean") return true;
  if (value === "none" || value === "basic" || value === "full") return true;
  if (Array.isArray(value)) return value.every((item) => typeof item === "string");
  if (typeof value === "string") return !isKnownCompilerCapability(capability);
  if (typeof value === "number") return !isKnownCompilerCapability(capability);
  return false;
}

/** The capability map a compiler adapter declares. */
export type CompilerCapabilities = Readonly<Record<string, CapabilityValue>>;
