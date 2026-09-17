import type { CapabilityValue, LanguageCapabilities } from "../contracts/capabilities.js";
import { deepFreeze } from "./freeze.js";

/** An immutable, normalised capability map. */
export type CapabilityModel = Readonly<Record<string, CapabilityValue>>;

/** Builds an immutable capability model, dropping `undefined` entries. */
export function createCapabilityModel(capabilities: LanguageCapabilities): CapabilityModel {
  const normalized: Record<string, CapabilityValue> = {};
  for (const [name, value] of Object.entries(capabilities)) {
    if (value !== undefined) normalized[name] = value;
  }
  return deepFreeze(normalized);
}
