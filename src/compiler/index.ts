/**
 * The compiler layer — the universal Compiler Layer.
 *
 * The single gateway between the documentation engine and every language's
 * native parser/compiler. The engine only ever sees {@link CompilerManager}
 * and the normalized {@link CompilationResult}; it never knows which native
 * compiler produced a result.
 *
 * No symbol extraction, semantic analysis, documentation generation, AI,
 * knowledge graph or page generation lives here.
 */
export { createCompilerAdapter } from "./contracts/adapter.js";
export type {
  AdapterCompileInput,
  CompilerAdapter,
  CompilerAdapterHooks,
  CompilerManagerHandle,
  CompilerSession,
  NativeCompilationOutput,
} from "./contracts/adapter.js";
export {
  KNOWN_COMPILER_CAPABILITIES,
  isKnownCompilerCapability,
  isValidCompilerCapabilityValue,
} from "./contracts/capabilities.js";
export type { CompilerCapabilities, KnownCompilerCapability } from "./contracts/capabilities.js";
export type {
  CompilerConfiguration,
  CompilerConfigurationInput,
} from "./contracts/configuration.js";
export { CompilerDiagnosticCode, createCompilerDiagnostic } from "./contracts/diagnostics.js";
export type {
  CompilerDiagnostic,
  CompilerDiagnosticCode as CompilerDiagnosticCodeType,
  CompilerDiagnosticInput,
  CompilerDiagnosticSeverity,
  CompilerPosition,
  CompilerRange,
} from "./contracts/diagnostics.js";
export type {
  CompilerEvent,
  CompilerEventListener,
  CompilerEventPayload,
  CompilerEvents,
  CompilerSubscription,
} from "./contracts/events.js";
export type { CompileRequest, CompilerRequestOptions } from "./contracts/request.js";
export type { CompilerMetadata, CompilerMetadataInput } from "./contracts/metadata.js";

export type {
  CompilationContext,
  CompilationResult,
  CompilationStatistics,
  CompilationUnit,
  SourceMap,
  SyntaxNode,
  SyntaxTree,
} from "./results/index.js";

export {
  createCompilationContext,
  createCompilationResult,
  createCompilationStatistics,
  createCompilationUnit,
  createSourceMap,
  createSyntaxTree,
} from "./models/index.js";

export {
  flattenMessageText,
  mapDiagnosticCode,
  mapDiagnosticSeverity,
  normalizeCompilerDiagnostic,
  normalizeCompilerDiagnostics,
} from "./diagnostics/index.js";

export {
  DEFAULT_TREE_LIMITS,
  createEventEmitter,
  fingerprintCompileRequest,
  hashContent,
  isRelativeSpecifier,
  limitsFromOptions,
  loadNativeModule,
  nowMs,
  resolveRelativeTarget,
  resolveSpecifiers,
} from "./shared/index.js";
export type { EventEmitter, EventMap, TreeLimits } from "./shared/index.js";

export { CompilerCache, createCompilerCache } from "./cache/index.js";
export type { CompilerCacheOptions } from "./cache/index.js";

export { CompilerRegistry, createCompilerRegistry } from "./registry/index.js";
export type { CompilerResolveOptions, RegistrationResult } from "./registry/index.js";

export { CompilerManager, createCompilerManager } from "./manager/index.js";
export type { CompilerManagerOptions } from "./manager/index.js";

export { builtinCompilers, javascriptCompiler, typescriptCompiler } from "./builtin/index.js";

import type { CompilerAdapter } from "./contracts/adapter.js";
import type { CompilerManager } from "./manager/index.js";
import type { RegistrationResult } from "./registry/index.js";

/** Registers a compiler adapter into a manager, for external compiler packages. */
export function registerCompiler(
  adapter: CompilerAdapter,
  manager: CompilerManager,
): RegistrationResult {
  return manager.register(adapter);
}
