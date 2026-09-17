export {
  ErrorCode,
  ERROR_DESCRIPTIONS,
  ERROR_RECOVERY_SUGGESTIONS,
  EXIT_CODES,
  exitCodeForError,
} from "./codes.js";
export type { ErrorCode as ErrorCodeType } from "./codes.js";
export {
  DocsError,
  ConfigurationError,
  ValidationError,
  BuildError,
  PluginError,
  ThemeError,
  RendererError,
  MarkdownError,
  SearchError,
  TypeDocError,
  PagefindError,
  CacheError,
  CliError,
  InternalError,
} from "./classes.js";
export type { DocsErrorOptions } from "./classes.js";
export { formatError, formatCaughtError, formatGenericError } from "./format.js";
