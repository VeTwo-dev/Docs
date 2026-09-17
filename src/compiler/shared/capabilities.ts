import {
  CompilerDiagnosticCode,
  createCompilerDiagnostic,
  type CompilerDiagnostic,
} from "../contracts/diagnostics.js";
import {
  isValidCompilerCapabilityValue,
  type CompilerCapabilities,
} from "../contracts/capabilities.js";

export {
  capabilityLevel,
  hasAnyCapability,
  hasCapability,
} from "../../languages/utils/capabilities.js";

/** Validates a compiler capability map, returning invalid-declaration diagnostics. */
export function validateCompilerCapabilities(
  capabilities: CompilerCapabilities,
  compilerId = "unknown",
): readonly CompilerDiagnostic[] {
  const diagnostics: CompilerDiagnostic[] = [];
  for (const [name, value] of Object.entries(capabilities)) {
    if (value === undefined) continue;
    if (!isValidCompilerCapabilityValue(name, value)) {
      diagnostics.push(
        createCompilerDiagnostic({
          code: CompilerDiagnosticCode.ConfigurationError,
          severity: "error",
          message: `Invalid value for compiler capability "${name}" on compiler "${compilerId}".`,
          compilerId,
        }),
      );
    }
  }
  return diagnostics;
}

/** Whether a compiler declares `capability` (in a map). */
export function hasCompilerCapability(capabilities: CompilerCapabilities, name: string): boolean {
  return (capabilities as Readonly<Record<string, unknown>>)[name] !== undefined;
}
