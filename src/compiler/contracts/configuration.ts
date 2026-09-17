/**
 * Compiler configuration.
 *
 * Options forwarded to the native compiler. The engine treats the map as
 * opaque — only the owning compiler adapter interprets it.
 */
export interface CompilerConfiguration {
  /** Native compiler options (adapter-specific). */
  readonly options?: Readonly<Record<string, unknown>>;
  /** Path (relative to the project root) of a language config file, if any. */
  readonly configPath?: string;
  /** Free-form description of the configuration. */
  readonly description?: string;
}

/** Options for building a {@link CompilerConfiguration}. */
export interface CompilerConfigurationInput {
  readonly options?: Readonly<Record<string, unknown>>;
  readonly configPath?: string;
  readonly description?: string;
}
