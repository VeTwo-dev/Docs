import { DocsError } from "./classes.js";
import { ERROR_DESCRIPTIONS, ErrorCode } from "./codes.js";

/**
 * ANSI escape codes for terminal formatting.
 */
const C = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
} as const;

const SECTION_WIDTH = 60;
const DIVIDER = "\u2500".repeat(SECTION_WIDTH);

function section(title: string, content: string): string {
  const lines = content.split("\n").filter((l) => l.length > 0);
  return `\n${C.bold}${title}${C.reset}\n${C.gray}${DIVIDER}${C.reset}\n${lines.join("\n")}`;
}

function formatLocation(err: DocsError): string {
  const parts: string[] = [];
  if (err.configKey) {
    const configPath = err.file ? err.file : "docs.config.ts";
    parts.push(`  ${configPath}`);
    parts.push(`  ${err.configKey}`);
  } else if (err.file) {
    let loc = err.file;
    if (err.line) loc += `:${err.line}`;
    if (err.column) loc += `:${err.column}`;
    parts.push(`  ${loc}`);
  }
  return parts.join("\n") || "  Unknown location";
}

function formatSuggestions(err: DocsError): string {
  const suggestions: string[] = [];
  if (err.suggestion) {
    suggestions.push(err.suggestion);
  }
  if (err.hint) {
    suggestions.push(err.hint);
  }
  if (suggestions.length === 0) {
    suggestions.push("Run `docs doctor` for diagnostics.");
    suggestions.push("Check your docs.config.ts configuration.");
  }
  return suggestions.map((s) => `\u2022 ${s}`).join("\n");
}

/**
 * Formats a DocsError into a structured, colorized diagnostic message
 * suitable for terminal output.
 *
 * @param err - The error to format.
 * @param verbose - Whether to include stack traces and extra info.
 * @returns The formatted error string.
 */
export function formatError(err: DocsError, verbose = false): string {
  const parts: string[] = [];

  const errorName = err.name !== "DocsError" ? err.name : "Error";
  parts.push(`\n${C.red}\u2716 ${errorName}${C.reset} ${C.red}${err.message}${C.reset}`);

  const description = ERROR_DESCRIPTIONS[err.code as ErrorCode];
  if (description) {
    parts.push(section("Reason", description));
  }

  if (err.cause) {
    const causeMsg = (err.cause instanceof Error ? err.cause.message : null) || String(err.cause);
    parts.push(section("Cause", `  ${causeMsg}`));
  }

  const loc = formatLocation(err);
  if (loc !== "  Unknown location") {
    parts.push(section("Location", loc));
  }

  parts.push(section("Suggestion", formatSuggestions(err)));

  parts.push(section("Error Code", `  ${err.code}`));

  if (err.docsUrl) {
    parts.push(`\n  ${C.cyan}Docs:${C.reset} ${err.docsUrl}`);
  }

  if (verbose && err.stack) {
    const stackLines = err.stack.split("\n").slice(1).join("\n");
    parts.push(section("Stack Trace", stackLines));
  }

  parts.push("");
  return parts.join("\n");
}

/**
 * Formats an unknown caught value into a string.
 * If it's a DocsError, returns the structured format.
 * If it's a regular Error, wraps it in a BuildError format.
 * Otherwise, formats the raw value.
 */
export function formatCaughtError(error: unknown, title: string, verbose = false): string {
  if (error instanceof DocsError) {
    return formatError(error, verbose);
  }

  const err = error instanceof Error ? error : new Error(String(error));
  const wrapped = new DocsError({
    code: ErrorCode.BUILD_FAILED,
    message: `${title}: ${err.message}`,
    cause: err,
    suggestion: "An unexpected error occurred. Enable --verbose for more details.",
  });

  return formatError(wrapped, verbose);
}

/**
 * Formats a generic non-DocsError into a clean, user-friendly diagnostic
 * block (no stack trace unless verbose).
 */
export function formatGenericError(title: string, error: unknown, verbose = false): string {
  const message = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error ? error : undefined;

  const wrapped = new DocsError({
    code: ErrorCode.BUILD_FAILED,
    message: `${title}`,
    cause,
    suggestion: "Run `docs doctor` for diagnostics. Use --verbose for more details.",
  });

  const parts: string[] = [];

  parts.push(`\n${C.red}\u2716 ${title}${C.reset}`);
  parts.push(section("Reason", `  ${message}`));

  if (cause?.stack && verbose) {
    parts.push(section("Stack Trace", cause.stack.split("\n").slice(1).join("\n")));
  }

  parts.push(section("Suggestion", formatSuggestions(wrapped)));
  parts.push(section("Error Code", `  ${wrapped.code}`));
  parts.push("");
  return parts.join("\n");
}
