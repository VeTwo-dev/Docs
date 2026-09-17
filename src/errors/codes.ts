/**
 * Canonical error codes for @vetwo/docs.
 *
 * Every error produced by the framework maps to one of these codes,
 * making it easy for users to look up documentation or file issues.
 */
export const ErrorCode = {
  CONFIG_INVALID: "DOCS_CONFIG_INVALID",
  SOURCE_NOT_FOUND: "DOCS_SOURCE_NOT_FOUND",
  BUILD_FAILED: "DOCS_BUILD_FAILED",
  TYPESCRIPT_ERROR: "DOCS_TYPESCRIPT_ERROR",
  MARKDOWN_ERROR: "DOCS_MARKDOWN_ERROR",
  MARKDOWN_PARSE_ERROR: "DOCS_MARKDOWN_PARSE_ERROR",
  PLUGIN_ERROR: "DOCS_PLUGIN_ERROR",
  PLUGIN_NOT_FOUND: "DOCS_PLUGIN_NOT_FOUND",
  THEME_ERROR: "DOCS_THEME_ERROR",
  THEME_NOT_FOUND: "DOCS_THEME_NOT_FOUND",
  RENDER_ERROR: "DOCS_RENDER_ERROR",
  SEARCH_ERROR: "DOCS_SEARCH_ERROR",
  SEARCH_INDEX_FAILED: "DOCS_SEARCH_INDEX_FAILED",
  PAGEFIND_FAILED: "DOCS_PAGEFIND_FAILED",
  CACHE_ERROR: "DOCS_CACHE_ERROR",
  CACHE_READ_FAILED: "DOCS_CACHE_READ_FAILED",
  CACHE_WRITE_FAILED: "DOCS_CACHE_WRITE_FAILED",
  CACHE_CORRUPTED: "DOCS_CACHE_CORRUPTED",
  OUTPUT_ERROR: "DOCS_OUTPUT_ERROR",
  OUTPUT_WRITE_FAILED: "DOCS_OUTPUT_WRITE_FAILED",
  SITEMAP_FAILED: "DOCS_SITEMAP_FAILED",
  RSS_FAILED: "DOCS_RSS_FAILED",
  OG_IMAGE_FAILED: "DOCS_OG_IMAGE_FAILED",
  TYPESDOC_FAILED: "DOCS_TYPEDOC_FAILED",
  TYPESDOC_CONFIG_ERROR: "DOCS_TYPEDOC_CONFIG_ERROR",
  DEVSERVER_ERROR: "DOCS_DEVSERVER_ERROR",
  CLI_INVALID_ARGS: "DOCS_CLI_INVALID_ARGS",
  CLI_COMMAND_FAILED: "DOCS_CLI_COMMAND_FAILED",
  INTERNAL_ERROR: "DOCS_INTERNAL_ERROR",
  INIT_FAILED: "DOCS_INIT_FAILED",
  NETWORK_ERROR: "DOCS_NETWORK_ERROR",
  CONFLICT: "DOCS_CONFLICT",
  VALIDATION_FAILED: "DOCS_VALIDATION_FAILED",
  STATE_CORRUPTED: "DOCS_STATE_CORRUPTED",
  INTERRUPTED: "DOCS_INTERRUPTED",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Human-readable descriptions for each error code.
 * Used in diagnostic output and documentation links.
 */
export const ERROR_DESCRIPTIONS: Record<ErrorCode, string> = {
  [ErrorCode.CONFIG_INVALID]: "The documentation configuration file is invalid or contains errors",
  [ErrorCode.SOURCE_NOT_FOUND]: "The configured source directory does not exist",
  [ErrorCode.BUILD_FAILED]: "The documentation build failed unexpectedly",
  [ErrorCode.TYPESCRIPT_ERROR]: "A TypeScript compilation error was encountered",
  [ErrorCode.MARKDOWN_ERROR]: "A Markdown processing error was encountered",
  [ErrorCode.MARKDOWN_PARSE_ERROR]: "Failed to parse a Markdown file",
  [ErrorCode.PLUGIN_ERROR]: "A plugin encountered an error during execution",
  [ErrorCode.PLUGIN_NOT_FOUND]: "A required plugin could not be found",
  [ErrorCode.THEME_ERROR]: "A theme encountered an error during processing",
  [ErrorCode.THEME_NOT_FOUND]: "A required theme could not be found",
  [ErrorCode.RENDER_ERROR]: "A rendering error was encountered",
  [ErrorCode.SEARCH_ERROR]: "A search indexing error was encountered",
  [ErrorCode.SEARCH_INDEX_FAILED]: "Failed to generate the search index",
  [ErrorCode.PAGEFIND_FAILED]: "Pagefind indexing failed",
  [ErrorCode.CACHE_ERROR]: "A cache operation failed",
  [ErrorCode.CACHE_READ_FAILED]: "Failed to read from the cache",
  [ErrorCode.CACHE_WRITE_FAILED]: "Failed to write to the cache",
  [ErrorCode.CACHE_CORRUPTED]: "The cache is corrupted and must be rebuilt",
  [ErrorCode.OUTPUT_ERROR]: "An output generation error was encountered",
  [ErrorCode.OUTPUT_WRITE_FAILED]: "Failed to write an output file",
  [ErrorCode.SITEMAP_FAILED]: "Failed to generate the sitemap",
  [ErrorCode.RSS_FAILED]: "Failed to generate the RSS feed",
  [ErrorCode.OG_IMAGE_FAILED]: "Failed to generate OpenGraph images",
  [ErrorCode.TYPESDOC_FAILED]: "TypeDoc documentation extraction failed",
  [ErrorCode.TYPESDOC_CONFIG_ERROR]: "TypeDoc configuration is invalid",
  [ErrorCode.DEVSERVER_ERROR]: "The development server encountered an error",
  [ErrorCode.CLI_INVALID_ARGS]: "Invalid command-line arguments",
  [ErrorCode.CLI_COMMAND_FAILED]: "A CLI command failed to execute",
  [ErrorCode.INTERNAL_ERROR]: "An internal error occurred in @vetwo/docs",
  [ErrorCode.INIT_FAILED]: "Documentation workspace initialization failed",
  [ErrorCode.NETWORK_ERROR]: "A network request failed",
  [ErrorCode.CONFLICT]: "A file conflict was detected during generation",
  [ErrorCode.VALIDATION_FAILED]: "A validation check failed",
  [ErrorCode.STATE_CORRUPTED]: "The persistent state is corrupted and must be rebuilt",
  [ErrorCode.INTERRUPTED]: "The operation was interrupted",
};

/**
 * Recovery suggestions for each error code.
 * Maps error codes to actionable steps the user can take.
 */
export const ERROR_RECOVERY_SUGGESTIONS: Record<ErrorCode, readonly string[]> = {
  [ErrorCode.CONFIG_INVALID]: ["Fix the configuration file and retry", "Run `docs doctor` for diagnostics"],
  [ErrorCode.SOURCE_NOT_FOUND]: ["Check the `source` field in your config", "Ensure the source directory exists"],
  [ErrorCode.BUILD_FAILED]: ["Check the error details above", "Run `docs doctor` to diagnose"],
  [ErrorCode.TYPESCRIPT_ERROR]: ["Fix the TypeScript error in your source code", "Check tsconfig.json"],
  [ErrorCode.MARKDOWN_ERROR]: ["Check the Markdown file for syntax errors"],
  [ErrorCode.MARKDOWN_PARSE_ERROR]: ["Check the Markdown file for syntax errors", "Verify frontmatter format"],
  [ErrorCode.PLUGIN_ERROR]: ["Check plugin configuration", "Try disabling the plugin"],
  [ErrorCode.PLUGIN_NOT_FOUND]: ["Install the required plugin", "Check the plugin name in your config"],
  [ErrorCode.THEME_ERROR]: ["Check theme configuration", "Try the default theme"],
  [ErrorCode.THEME_NOT_FOUND]: ["Install the required theme", "Check the theme name in your config"],
  [ErrorCode.RENDER_ERROR]: ["Check the renderer output", "Run `docs doctor`"],
  [ErrorCode.SEARCH_ERROR]: ["Search indexing will be skipped", "Check that the output directory is writable"],
  [ErrorCode.SEARCH_INDEX_FAILED]: ["Search will fall back to MiniSearch", "Check disk space and permissions"],
  [ErrorCode.PAGEFIND_FAILED]: ["Pagefind will be skipped", "Install pagefind: `npm install -D pagefind`"],
  [ErrorCode.CACHE_ERROR]: ["Run `docs clean --cache` to rebuild the cache"],
  [ErrorCode.CACHE_READ_FAILED]: ["Run `docs clean --cache` to rebuild the cache"],
  [ErrorCode.CACHE_WRITE_FAILED]: ["Check disk space and permissions", "Run `docs clean --cache`"],
  [ErrorCode.CACHE_CORRUPTED]: ["Run `docs clean --cache` to rebuild the cache"],
  [ErrorCode.OUTPUT_ERROR]: ["Check the output directory permissions", "Run `docs clean` and retry"],
  [ErrorCode.OUTPUT_WRITE_FAILED]: ["Check disk space and permissions", "Ensure the output directory is writable"],
  [ErrorCode.SITEMAP_FAILED]: ["Sitemap generation will be skipped", "Check base URL configuration"],
  [ErrorCode.RSS_FAILED]: ["RSS generation will be skipped", "Check RSS configuration"],
  [ErrorCode.OG_IMAGE_FAILED]: ["OG image generation will be skipped", "Ensure satori and resvg are installed"],
  [ErrorCode.TYPESDOC_FAILED]: ["API documentation will be skipped", "Check TypeDoc configuration"],
  [ErrorCode.TYPESDOC_CONFIG_ERROR]: ["Fix the TypeDoc configuration", "Check api.source in your config"],
  [ErrorCode.DEVSERVER_ERROR]: ["Check the error details", "Restart the dev server"],
  [ErrorCode.CLI_INVALID_ARGS]: ["Check the command arguments", "Run `docs --help` for usage"],
  [ErrorCode.CLI_COMMAND_FAILED]: ["Check the error details", "Run `docs doctor`"],
  [ErrorCode.INTERNAL_ERROR]: ["This is a bug — please report it at https://github.com/vetwo/docs/issues"],
  [ErrorCode.INIT_FAILED]: ["Check file permissions", "Run `docs doctor` for diagnostics"],
  [ErrorCode.NETWORK_ERROR]: ["Check your internet connection", "Retry the operation"],
  [ErrorCode.CONFLICT]: ["Resolve the file conflicts", "Run `docs content conflicts` to inspect"],
  [ErrorCode.VALIDATION_FAILED]: ["Check the validation errors above", "Fix the reported issues"],
  [ErrorCode.STATE_CORRUPTED]: ["Run `docs clean --state` to rebuild state", "Run `docs doctor` for diagnostics"],
  [ErrorCode.INTERRUPTED]: ["Retry the operation", "Check if another process is using the state directory"],
};

/**
 * Numeric process exit codes mapped from error categories.
 * Used by the CLI to communicate error types to calling processes.
 */
export const EXIT_CODES = {
  success: 0,
  general: 1,
  configuration: 2,
  build: 3,
  internal: 4,
  conflict: 5,
  validation: 6,
  interrupted: 130,
} as const;

/** Maps an ErrorCode to its corresponding numeric exit code. */
export function exitCodeForError(code: ErrorCode): number {
  switch (code) {
    case ErrorCode.CONFIG_INVALID:
    case ErrorCode.SOURCE_NOT_FOUND:
    case ErrorCode.TYPESDOC_CONFIG_ERROR:
    case ErrorCode.CLI_INVALID_ARGS:
      return EXIT_CODES.configuration;
    case ErrorCode.BUILD_FAILED:
    case ErrorCode.TYPESCRIPT_ERROR:
    case ErrorCode.MARKDOWN_ERROR:
    case ErrorCode.MARKDOWN_PARSE_ERROR:
    case ErrorCode.PLUGIN_ERROR:
    case ErrorCode.PLUGIN_NOT_FOUND:
    case ErrorCode.THEME_ERROR:
    case ErrorCode.THEME_NOT_FOUND:
    case ErrorCode.RENDER_ERROR:
    case ErrorCode.OUTPUT_ERROR:
    case ErrorCode.OUTPUT_WRITE_FAILED:
      return EXIT_CODES.build;
    case ErrorCode.CONFLICT:
      return EXIT_CODES.conflict;
    case ErrorCode.VALIDATION_FAILED:
      return EXIT_CODES.validation;
    case ErrorCode.INTERRUPTED:
      return EXIT_CODES.interrupted;
    default:
      return EXIT_CODES.general;
  }
}
