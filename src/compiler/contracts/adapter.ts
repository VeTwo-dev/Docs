import type { CompilerCapabilities } from "./capabilities.js";
import type { CompilerConfiguration } from "./configuration.js";
import type { CompilerDiagnostic } from "./diagnostics.js";
import type { CompilerMetadata } from "./metadata.js";
import type { CompileRequest, CompilerRequestOptions } from "./request.js";
import type { CompilationResult, CompilationUnit } from "../results/index.js";

/**
 * Input passed to a compiler adapter's {@link CompilerAdapter.compile}.
 *
 * `files` is the affected set (the full requested set, or only the files that
 * changed for incremental requests). `contents` guarantees the adapter never
 * needs to read from disk.
 */
export interface AdapterCompileInput {
  readonly rootDir: string;
  /** The relative paths to compile. */
  readonly files: readonly string[];
  /** File contents keyed by relative path. */
  readonly contents: Readonly<Record<string, string>>;
  /** The language adapter id being compiled. */
  readonly languageId: string;
  /** Compiler options. */
  readonly options?: CompilerRequestOptions;
  /** The caller-supplied request id. */
  readonly requestId: string;
}

/**
 * The common output every compiler adapter produces.
 *
 * Units already use the universal {@link CompilationUnit} shape; the manager
 * validates, freezes and merges them with cached units. No language-specific
 * data leaks outside this shape.
 */
export interface NativeCompilationOutput {
  /** One unit per compiled file. */
  readonly units: readonly CompilationUnit[];
  /** File → resolved relative dependencies (syntactic, not semantic). */
  readonly dependencies: Readonly<Record<string, readonly string[]>>;
  /** Relative paths of files that failed to compile. */
  readonly failedFiles: readonly string[];
  /** Compiler-level diagnostics (configuration, missing compiler, ...). */
  readonly diagnostics: readonly CompilerDiagnostic[];
  /** The native compiler version, when known. */
  readonly nativeVersion?: string;
}

/**
 * An incremental compilation session created by an adapter.
 *
 * Sessions cache parsed source files and reuse them across requests, so
 * recompiling unchanged files avoids re-parsing. Created lazily via
 * {@link CompilerAdapter.createIncrementalSession}.
 */
export interface CompilerSession {
  /** The owning compiler adapter id. */
  readonly compilerId: string;
  /** Compiles the affected files, reusing cached parse results. */
  compile(input: AdapterCompileInput): Promise<NativeCompilationOutput>;
  /** Optional hook to remove/refresh internal state for removed/added files. */
  update?(changes: {
    readonly added: readonly string[];
    readonly removed: readonly string[];
  }): void;
  /** Releases session state. */
  dispose(): void;
}

/**
 * The subset of the compiler-manager surface available to adapter lifecycle
 * hooks. Kept intentionally small so adapters cannot reach the engine.
 */
export interface CompilerManagerHandle {
  register(adapter: CompilerAdapter): { readonly compilerId: string };
  unregister(id: string): boolean;
  get(id: string): { readonly id: string; readonly displayName: string } | undefined;
  compile(request: CompileRequest): Promise<CompilationResult>;
}

/** Lifecycle hooks a compiler adapter may declare. */
export interface CompilerAdapterHooks {
  /** Runs after the adapter is registered. */
  readonly onRegister?: (manager: CompilerManagerHandle) => void | Promise<void>;
  /** Runs after the adapter is unregistered. */
  readonly onUnregister?: (manager: CompilerManagerHandle) => void;
  /** Runs when the manager is disposed. */
  readonly onDispose?: () => void;
}

/**
 * The universal compiler adapter contract.
 *
 * Every language compiler is implemented as an independent adapter wrapping
 * its native compiler. The engine communicates with compilers exclusively
 * through this interface and the {@link CompilerManager}.
 */
export interface CompilerAdapter {
  /** Compiler metadata (id, language, syntax, version, priority, ...). */
  readonly metadata: CompilerMetadata;
  /** Declared capabilities. */
  readonly capabilities: CompilerCapabilities;
  /** Configuration recognised by the compiler. */
  readonly configuration?: CompilerConfiguration;
  /** Compiles the affected files into universal units. */
  compile(input: AdapterCompileInput): Promise<NativeCompilationOutput>;
  /**
   * Optionally creates an incremental session. When present and the request
   * allows it, the manager routes compiles through the session.
   */
  createIncrementalSession?(input: AdapterCompileInput): CompilerSession | undefined;
  /** Lifecycle hooks. */
  readonly hooks?: CompilerAdapterHooks;
  /** Minimum compiler-manager API version required by this adapter. */
  readonly minimumApiVersion?: string;
}

/**
 * Creates a frozen, plain compiler adapter. This is the public factory for
 * external compiler packages.
 */
export function createCompilerAdapter(config: CompilerAdapter): CompilerAdapter {
  return Object.freeze({ ...config });
}
