import {
  CompilerDiagnosticCode,
  createCompilerDiagnostic,
  type CompilerDiagnostic,
} from "../contracts/diagnostics.js";
import type { CompilerMetadata } from "../contracts/metadata.js";
import { normalizeExtension } from "../../languages/utils/extension.js";

/** Validates compiler metadata, returning configuration diagnostics. */
export function validateCompilerMetadata(
  metadata: CompilerMetadata,
): readonly CompilerDiagnostic[] {
  const diagnostics: CompilerDiagnostic[] = [];
  const push = (message: string): void => {
    diagnostics.push(
      createCompilerDiagnostic({
        code: CompilerDiagnosticCode.ConfigurationError,
        severity: "error",
        message,
        compilerId: metadata.id,
      }),
    );
  };
  if (!metadata.id || !/^[a-z0-9][a-z0-9._-]*$/.test(metadata.id)) {
    push(`Invalid compiler id "${metadata.id}".`);
  }
  if (!metadata.displayName) push(`Compiler "${metadata.id}" is missing a displayName.`);
  if (!metadata.languageId) push(`Compiler "${metadata.id}" is missing a languageId.`);
  if (!metadata.version) push(`Compiler "${metadata.id}" is missing a version.`);
  if (typeof metadata.priority !== "number" || Number.isNaN(metadata.priority)) {
    push(`Compiler "${metadata.id}" has an invalid priority.`);
  }
  if (!Array.isArray(metadata.extensions) || metadata.extensions.length === 0) {
    push(`Compiler "${metadata.id}" must declare at least one extension.`);
  } else {
    for (const extension of metadata.extensions) {
      const normalized = normalizeExtension(extension);
      if (!normalized) push(`Compiler "${metadata.id}" has an invalid extension "${extension}".`);
    }
  }
  return diagnostics;
}
