/**
 * The language subsystem — the universal Language Adapter System.
 *
 * The core engine never contains language-specific logic. Every programming
 * language is implemented as an independent adapter registered with the
 * {@link LanguageManager}, the single entry point for registration, resolution,
 * detection and capability discovery.
 *
 * External packages can ship additional languages:
 *
 * ```ts
 * import { createLanguageAdapter, registerLanguage } from "@vetwo/docs/languages";
 * registerLanguage(createLanguageAdapter({ metadata: { id: "python", ... }, capabilities: {...} }));
 * ```
 */
export { createLanguageAdapter } from "./contracts/adapter.js";
export type {
  LanguageAdapter,
  LanguageAdapterHooks,
  LanguageManagerHandle,
} from "./contracts/adapter.js";
export {
  KNOWN_CAPABILITIES,
  isKnownCapability,
  isValidCapabilityValue,
} from "./contracts/capabilities.js";
export type {
  CapabilityValue,
  KnownCapability,
  LanguageCapabilities,
} from "./contracts/capabilities.js";
export type { CommentStandard, CommentStyle } from "./contracts/comment.js";
export type { LanguageConfiguration } from "./contracts/configuration.js";
export type {
  DetectionInput,
  DetectionResult,
  DetectionSignal,
  DetectionSignalSource,
} from "./contracts/detection.js";
export { createDiagnostic, LanguageDiagnosticCode } from "./contracts/diagnostics.js";
export type { LanguageDiagnostic, LanguageDiagnosticSeverity } from "./contracts/diagnostics.js";
export type { FrameworkAssociation } from "./contracts/framework.js";
export type { LanguageMetadata } from "./contracts/metadata.js";

export { createLanguageModel } from "./models/language.js";
export type { LanguageModel } from "./models/language.js";
export { createCapabilityModel } from "./models/capabilities.js";
export type { CapabilityModel } from "./models/capabilities.js";
export { createCommentStandardModel } from "./models/comment.js";
export type { CommentStandardModel } from "./models/comment.js";
export { createConfigurationModel } from "./models/configuration.js";
export type { ConfigurationModel } from "./models/configuration.js";
export { createDetectionResultModel } from "./models/detection.js";
export type { DetectionResultModel } from "./models/detection.js";
export { createFrameworkAssociationModel } from "./models/framework.js";
export type { FrameworkAssociationModel } from "./models/framework.js";

export { createLanguageManager, LanguageManager } from "./manager/index.js";
export type { LanguageManagerOptions } from "./manager/index.js";
export { createLanguageRegistry, LanguageRegistry } from "./registry/index.js";
export type { RegistrationResult } from "./registry/index.js";

export { builtinAdapters } from "./builtin/index.js";
export { typescriptAdapter } from "./builtin/typescript/index.js";
export { javascriptAdapter } from "./builtin/javascript/index.js";

export { compareVersions, parseVersion, satisfiesVersion } from "./utils/version.js";
export {
  extensionOf,
  fileNameOf,
  mimeOfExtension,
  matchesExtension,
  normalizeExtension,
} from "./utils/extension.js";
export {
  capabilityLevel,
  hasAnyCapability,
  hasCapability,
  validateCapabilities,
} from "./utils/capabilities.js";
export type { CapabilityLevel } from "./utils/capabilities.js";
export {
  configurationFiles,
  entryPointFiles,
  matchesConfigurationFile,
  matchesEntryFile,
} from "./utils/config.js";
export { detectionInputFromProjectModel, fingerprintDetectionInput } from "./utils/detection.js";

import type { LanguageAdapter } from "./contracts/adapter.js";
import type { LanguageManager } from "./manager/index.js";
import type { RegistrationResult } from "./registry/index.js";

/** Registers a language adapter into a manager, for external packages. */
export function registerLanguage(
  adapter: LanguageAdapter,
  manager: LanguageManager,
): RegistrationResult {
  return manager.register(adapter);
}
