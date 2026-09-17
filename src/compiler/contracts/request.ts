/**
 * Compilation request.
 *
 * The single input shape accepted by the {@link CompilerManager}. All paths
 * are forward-slash relative paths from `rootDir`.
 */
export interface CompilerRequestOptions {
  /** Maximum depth of the normalized syntax tree (default adapter-specific). */
  readonly maxDepth?: number;
  /** Maximum number of normalized syntax nodes (default adapter-specific). */
  readonly maxNodes?: number;
  /** Request source maps for compilers that support them. Defaults to `false`. */
  readonly sourceMaps?: boolean;
  /** Relative path of a language configuration file (e.g. `tsconfig.json`). */
  readonly configPath?: string;
  /** Native compiler options, forwarded verbatim. */
  readonly config?: Readonly<Record<string, unknown>>;
  /** Skip the compiler cache for this request. Defaults to `false`. */
  readonly skipCache?: boolean;
}

/** A compilation request. */
export interface CompileRequest {
  /** The project root directory. */
  readonly rootDir: string;
  /** Relative paths of the files to compile. */
  readonly files: readonly string[];
  /** File contents keyed by relative path (avoids disk reads). */
  readonly contents?: Readonly<Record<string, string>>;
  /** The language to compile. Detected when omitted. */
  readonly languageId?: string;
  /** An explicit compiler id. Resolved by language when omitted. */
  readonly compilerId?: string;
  /** Compiler options. */
  readonly options?: CompilerRequestOptions;
  /** Enable incremental compilation. Defaults to the manager's cache setting. */
  readonly incremental?: boolean;
  /** A caller-supplied request id (auto-generated when omitted). */
  readonly requestId?: string;
  /** Workspace context, when compiling a monorepo/workspace. */
  readonly workspace?: {
    readonly manager?: string;
    readonly packages?: readonly string[];
    readonly monorepo: boolean;
  };
}
