import {
  createDiagnostic,
  LanguageDiagnosticCode,
  type LanguageDiagnostic,
} from "../contracts/diagnostics.js";
import {
  isKnownCapability,
  isValidCapabilityValue,
  type CapabilityValue,
  type LanguageCapabilities,
} from "../contracts/capabilities.js";

/** A normalised capability level: `0` none, `1` partial, `2` full. */
export type CapabilityLevel = 0 | 1 | 2;

/**
 * Returns the capability level of `name` within `capabilities`.
 *
 * - `false`, `"none"` and absent → `0`
 * - `"basic"`, string arrays and strings → `1`
 * - `true` and `"full"` → `2`
 */
export function capabilityLevel(capabilities: LanguageCapabilities, name: string): CapabilityLevel {
  const value = capabilities[name];
  if (value === true || value === "full") return 2;
  if (value === false || value === "none" || value === undefined) return 0;
  return 1;
}

/** Whether `name` is declared at any level above none. */
export function hasCapability(capabilities: LanguageCapabilities, name: string): boolean {
  return capabilityLevel(capabilities, name) > 0;
}

/** Whether any of `names` is declared. */
export function hasAnyCapability(
  capabilities: LanguageCapabilities,
  names: readonly string[],
): boolean {
  return names.some((name) => hasCapability(capabilities, name));
}

/** The declared capability names (excluding `undefined` entries). */
export function declaredCapabilities(capabilities: LanguageCapabilities): readonly string[] {
  return Object.entries(capabilities)
    .filter(([, value]) => value !== undefined)
    .map(([name]) => name);
}

/** Validates a capability map, returning invalid-declaration diagnostics. */
export function validateCapabilities(
  capabilities: LanguageCapabilities,
  languageId = "unknown",
): readonly LanguageDiagnostic[] {
  const diagnostics: LanguageDiagnostic[] = [];
  for (const [name, value] of Object.entries(capabilities)) {
    if (value === undefined) continue;
    if (!isValidCapabilityValue(name, value)) {
      diagnostics.push(
        createDiagnostic({
          code: LanguageDiagnosticCode.InvalidCapability,
          severity: "error",
          message: `Invalid value for capability "${name}" on language "${languageId}".`,
          languageId,
        }),
      );
    } else if (isKnownCapability(name) && typeof value === "boolean") {
      // Boolean declarations are valid; nothing further to check.
    }
  }
  return diagnostics;
}

/** Reads a typed capability value, returning a default when absent. */
export function capabilityValue<T extends CapabilityValue>(
  capabilities: LanguageCapabilities,
  name: string,
  fallback: T,
): T | Exclude<CapabilityValue, undefined> {
  const value = capabilities[name];
  return value === undefined ? fallback : value;
}
