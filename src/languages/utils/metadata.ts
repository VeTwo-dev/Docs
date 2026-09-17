import {
  createDiagnostic,
  LanguageDiagnosticCode,
  type LanguageDiagnostic,
} from "../contracts/diagnostics.js";
import type { LanguageMetadata } from "../contracts/metadata.js";
import { normalizeExtension } from "./extension.js";

/** A fully-normalised metadata object with all optional fields defaulted. */
export interface NormalizedMetadata {
  readonly id: string;
  readonly displayName: string;
  readonly aliases: readonly string[];
  readonly version?: string;
  readonly priority: number;
  readonly extensions: readonly string[];
  readonly fileNames: readonly string[];
  readonly mimeTypes: readonly string[];
  readonly lockfiles: readonly string[];
  readonly configFiles: readonly string[];
  readonly defaultEntryFiles: readonly string[];
  readonly color?: string;
  readonly icon?: string;
}

/** Deduplicates values while preserving order. */
function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].map((value) => value.trim()).filter(Boolean);
}

/** Normalises metadata, filling defaults. Ids and extensions are lowercased. */
export function normalizeMetadata(metadata: LanguageMetadata): NormalizedMetadata {
  return {
    id: metadata.id.toLowerCase(),
    displayName: metadata.displayName,
    aliases: unique((metadata.aliases ?? []).map((alias) => alias.toLowerCase())),
    version: metadata.version,
    priority: metadata.priority ?? 0,
    extensions: unique((metadata.extensions ?? []).map(normalizeExtension)),
    fileNames: unique(metadata.fileNames ?? []),
    mimeTypes: unique((metadata.mimeTypes ?? []).map((mime) => mime.toLowerCase())),
    lockfiles: unique(metadata.lockfiles ?? []),
    configFiles: unique(metadata.configFiles ?? []),
    defaultEntryFiles: unique(metadata.defaultEntryFiles ?? []),
    color: metadata.color,
    icon: metadata.icon,
  };
}

/** Validates metadata, returning invalid-adapter diagnostics. */
export function validateMetadata(metadata: LanguageMetadata): readonly LanguageDiagnostic[] {
  const diagnostics: LanguageDiagnostic[] = [];
  if (!metadata.id || !metadata.id.trim()) {
    diagnostics.push(
      createDiagnostic({
        code: LanguageDiagnosticCode.InvalidAdapter,
        severity: "error",
        message: "Language adapter metadata requires a non-empty `id`.",
      }),
    );
  }
  if (!metadata.displayName || !metadata.displayName.trim()) {
    diagnostics.push(
      createDiagnostic({
        code: LanguageDiagnosticCode.InvalidAdapter,
        severity: "error",
        message: `Language adapter "${metadata.id}" requires a non-empty \`displayName\`.`,
        languageId: metadata.id,
      }),
    );
  }
  const extensions = metadata.extensions ?? [];
  for (const extension of extensions) {
    const normalized = extension.trim().toLowerCase();
    if (!normalized.startsWith(".")) {
      diagnostics.push(
        createDiagnostic({
          code: LanguageDiagnosticCode.InvalidAdapter,
          severity: "warning",
          message: `Extension "${extension}" on language "${metadata.id}" must start with a dot.`,
          languageId: metadata.id,
        }),
      );
    }
  }
  return diagnostics;
}
