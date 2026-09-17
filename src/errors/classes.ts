import { ErrorCode, type ErrorCode as ErrorCodeType } from "./codes.js";

/**
 * Options for creating a DocsError.
 */
export interface DocsErrorOptions {
  /** The error code identifying the category of error. */
  readonly code: ErrorCodeType;
  /** A human-readable error message. */
  readonly message: string;
  /** The underlying cause, if any. */
  readonly cause?: Error;
  /** Actionable suggestions for fixing the error. */
  readonly suggestion?: string;
  /** Link to relevant documentation. */
  readonly docsUrl?: string;
  /** File path related to the error. */
  readonly file?: string;
  /** Line number (1-based) in the file, if applicable. */
  readonly line?: number;
  /** Column number (1-based) in the file, if applicable. */
  readonly column?: number;
  /** Configuration key involved in the error. */
  readonly configKey?: string;
  /** A short hint to help resolve the error. */
  readonly hint?: string;
}

/**
 * Options for creating a specialized DocsError (subclass).
 * The `code` field is optional and defaults to the subclass's default code.
 */
export interface SpecializedErrorOptions {
  /** A human-readable error message. */
  readonly message: string;
  /** The underlying cause, if any. */
  readonly cause?: Error;
  /** Actionable suggestions for fixing the error. */
  readonly suggestion?: string;
  /** Link to relevant documentation. */
  readonly docsUrl?: string;
  /** File path related to the error. */
  readonly file?: string;
  /** Line number (1-based) in the file, if applicable. */
  readonly line?: number;
  /** Column number (1-based) in the file, if applicable. */
  readonly column?: number;
  /** Configuration key involved in the error. */
  readonly configKey?: string;
  /** A short hint to help resolve the error. */
  readonly hint?: string;
}

/**
 * Base error class for all @vetwo/docs errors.
 *
 * Every error carries a structured payload including an error code,
 * optional file location, configuration key, suggestions, and a
 * documentation URL. This enables the CLI to render rich diagnostics.
 */
export class DocsError extends Error {
  /** The error code identifying the category of error. */
  readonly code: ErrorCodeType;
  /** Actionable suggestions for fixing the error. */
  readonly suggestion?: string;
  /** Link to relevant documentation. */
  readonly docsUrl?: string;
  /** File path related to the error. */
  readonly file?: string;
  /** Line number (1-based) in the file, if applicable. */
  readonly line?: number;
  /** Column number (1-based) in the file, if applicable. */
  readonly column?: number;
  /** Configuration key involved in the error. */
  readonly configKey?: string;
  /** A short hint to help resolve the error. */
  readonly hint?: string;

  constructor(options: DocsErrorOptions) {
    super(options.message, options.cause ? { cause: options.cause } : undefined);
    this.name = "DocsError";
    this.code = options.code;
    this.suggestion = options.suggestion;
    this.docsUrl = options.docsUrl;
    this.file = options.file;
    this.line = options.line;
    this.column = options.column;
    this.configKey = options.configKey;
    this.hint = options.hint;

    Object.setPrototypeOf(this, new.target.prototype);
  }

  /** Whether this error is recoverable (the build can continue). */
  get recoverable(): boolean {
    return false;
  }
}

/**
 * Configuration is invalid or contains errors.
 */
export class ConfigurationError extends DocsError {
  constructor(options: SpecializedErrorOptions) {
    super({ ...options, code: ErrorCode.CONFIG_INVALID });
    this.name = "ConfigurationError";
  }
}

/**
 * A validation error from schema validation (e.g., Zod).
 */
export class ValidationError extends DocsError {
  constructor(options: SpecializedErrorOptions) {
    super({ ...options, code: ErrorCode.CONFIG_INVALID });
    this.name = "ValidationError";
  }
}

/**
 * The documentation build failed.
 */
export class BuildError extends DocsError {
  constructor(options: SpecializedErrorOptions & { readonly code?: ErrorCodeType }) {
    super({ ...options, code: options.code ?? ErrorCode.BUILD_FAILED });
    this.name = "BuildError";
  }
}

/**
 * A plugin encountered an error during execution.
 */
export class PluginError extends DocsError {
  constructor(options: SpecializedErrorOptions & { readonly code?: ErrorCodeType }) {
    super({ ...options, code: options.code ?? ErrorCode.PLUGIN_ERROR });
    this.name = "PluginError";
  }
}

/**
 * A theme encountered an error during processing.
 */
export class ThemeError extends DocsError {
  constructor(options: SpecializedErrorOptions & { readonly code?: ErrorCodeType }) {
    super({ ...options, code: options.code ?? ErrorCode.THEME_ERROR });
    this.name = "ThemeError";
  }
}

/**
 * A rendering error was encountered.
 */
export class RendererError extends DocsError {
  constructor(options: SpecializedErrorOptions & { readonly code?: ErrorCodeType }) {
    super({ ...options, code: options.code ?? ErrorCode.RENDER_ERROR });
    this.name = "RendererError";
  }
}

/**
 * A Markdown processing error was encountered.
 */
export class MarkdownError extends DocsError {
  constructor(options: SpecializedErrorOptions & { readonly code?: ErrorCodeType }) {
    super({ ...options, code: options.code ?? ErrorCode.MARKDOWN_ERROR });
    this.name = "MarkdownError";
  }
}

/**
 * A search indexing error was encountered.
 */
export class SearchError extends DocsError {
  constructor(options: SpecializedErrorOptions) {
    super({ ...options, code: ErrorCode.SEARCH_ERROR });
    this.name = "SearchError";
  }

  override get recoverable(): boolean {
    return true;
  }
}

/**
 * TypeDoc documentation extraction failed.
 */
export class TypeDocError extends DocsError {
  constructor(options: SpecializedErrorOptions) {
    super({ ...options, code: ErrorCode.TYPESDOC_FAILED });
    this.name = "TypeDocError";
  }

  override get recoverable(): boolean {
    return true;
  }
}

/**
 * Pagefind indexing failed.
 */
export class PagefindError extends DocsError {
  constructor(options: SpecializedErrorOptions) {
    super({ ...options, code: ErrorCode.PAGEFIND_FAILED });
    this.name = "PagefindError";
  }

  override get recoverable(): boolean {
    return true;
  }
}

/**
 * A cache operation failed.
 */
export class CacheError extends DocsError {
  constructor(options: SpecializedErrorOptions) {
    super({ ...options, code: ErrorCode.CACHE_ERROR });
    this.name = "CacheError";
  }

  override get recoverable(): boolean {
    return true;
  }
}

/**
 * A CLI command failed.
 */
export class CliError extends DocsError {
  constructor(options: SpecializedErrorOptions & { readonly code?: ErrorCodeType }) {
    super({ ...options, code: options.code ?? ErrorCode.CLI_COMMAND_FAILED });
    this.name = "CliError";
  }
}

/**
 * An internal error occurred in @vetwo/docs.
 */
export class InternalError extends DocsError {
  constructor(options: SpecializedErrorOptions) {
    super({ ...options, code: ErrorCode.INTERNAL_ERROR });
    this.name = "InternalError";
  }
}
