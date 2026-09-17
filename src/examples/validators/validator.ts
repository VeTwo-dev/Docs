import type { Example, ExampleValidationStatus } from "../models/index.js";
import { EXAMPLE_VALIDATION_STATUSES } from "../models/index.js";

/** Severity of a validation issue. */
export type ValidationSeverity = "error" | "warning" | "info";

/** A single validation finding on an example body. */
export interface ValidationIssue {
  readonly code: string;
  readonly severity: ValidationSeverity;
  readonly message: string;
}

/** The result of statically validating an example body. */
export interface ValidationResult {
  readonly status: ExampleValidationStatus;
  readonly issues: readonly ValidationIssue[];
}

/**
 * Statically validates an example body. Validation NEVER executes project
 * code — only lexical and structural checks are performed.
 */
export function validateExampleContent(content: string, language: string): ValidationResult {
  const issues: ValidationIssue[] = [];
  const trimmed = content.trim();

  if (trimmed.length === 0) {
    issues.push({
      code: "EMPTY",
      severity: "error",
      message: "Example body is empty",
    });
  }

  const placeholders = content.match(/\b(TODO|FIXME|XXX)\b|<your[-_ ]?\w*/gi) ?? [];
  if (placeholders.length > 0) {
    issues.push({
      code: "PLACEHOLDER",
      severity: "warning",
      message: `Example contains placeholder markers: ${placeholders.slice(0, 3).join(", ")}`,
    });
  }

  const secrets =
    content.match(
      /(sk-|pk-|ghp_|AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/g,
    ) ?? [];
  if (secrets.length > 0) {
    issues.push({
      code: "SECRET_LIKE",
      severity: "warning",
      message: "Example contains content resembling a secret or private key",
    });
  }

  if (!hasBalancedBraces(content, language)) {
    issues.push({
      code: "UNBALANCED_BRACES",
      severity: "error",
      message: "Example body has unbalanced braces",
    });
  }

  if (language === "json") {
    validateJson(trimmed, issues);
  }

  const truncated = content.match(/(\.{3,}|…)\s*$/);
  if (truncated !== null) {
    issues.push({
      code: "TRUNCATED",
      severity: "info",
      message: "Example appears truncated (ellipsis at end)",
    });
  }

  return finalize(issues);
}

/** Re-validate a full example, producing the same shape as `validateExampleContent`. */
export function validateExample(example: Example): ValidationResult {
  return validateExampleContent(example.content, example.language);
}

/** Validate a language identifier against known language ids. */
export function validateLanguage(language: string): boolean {
  return KNOWN_LANGUAGES.includes(language.toLowerCase());
}

/** Whether a JSON body parses (safe — no execution). */
function validateJson(content: string, issues: ValidationIssue[]): void {
  try {
    JSON.parse(content);
  } catch {
    issues.push({
      code: "INVALID_JSON",
      severity: "error",
      message: "Example body is not valid JSON",
    });
  }
}

/** Check brace/paren/bracket balance, honoring string literals. */
function hasBalancedBraces(content: string, language: string): boolean {
  if (language === "markdown" || language === "text" || language === "html") {
    return true;
  }
  const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  const stack: string[] = [];
  let inString: "'" | '"' | "`" | undefined;
  let escaped = false;
  let inLineComment = false;
  for (let i = 0; i < content.length; i++) {
    const char = content[i]!;
    if (inLineComment) {
      if (char === "\n") inLineComment = false;
      continue;
    }
    if (inString !== undefined) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === inString) inString = undefined;
      continue;
    }
    if (char === "/" && content[i + 1] === "/") {
      inLineComment = true;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      inString = char;
      continue;
    }
    if (char === "(" || char === "[" || char === "{") stack.push(char);
    if (char === ")" || char === "]" || char === "}") {
      const open = stack.pop();
      if (open === undefined || pairs[open] !== char) return false;
    }
  }
  return stack.length === 0;
}

/** Build the final status + frozen result from the collected issues. */
function finalize(issues: ValidationIssue[]): ValidationResult {
  const hasError = issues.some((issue) => issue.severity === "error");
  const status: ExampleValidationStatus = hasError ? "invalid" : "valid";
  return Object.freeze({
    status,
    issues: Object.freeze([...issues]),
  });
}

/** Known language ids accepted by the validator. */
export const KNOWN_LANGUAGES: readonly string[] = Object.freeze([
  "text",
  "markdown",
  "mdx",
  "json",
  "yaml",
  "yml",
  "toml",
  "bash",
  "sh",
  "shell",
  "zsh",
  "fish",
  "console",
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "mts",
  "cts",
  "python",
  "py",
  "ruby",
  "go",
  "rust",
  "java",
  "c",
  "cpp",
  "h",
  "hpp",
  "csharp",
  "kotlin",
  "swift",
  "php",
  "html",
  "css",
  "scss",
  "less",
  "sql",
  "graphql",
  "dockerfile",
  "docker",
  "makefile",
  "vue",
  "svelte",
  "solidity",
  "lua",
  "r",
  "dart",
]);

/** Whether a string is a valid validation status. */
export function isValidationStatus(value: string): value is ExampleValidationStatus {
  return (EXAMPLE_VALIDATION_STATUSES as readonly string[]).includes(value);
}
