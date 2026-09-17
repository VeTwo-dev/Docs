/**
 * Centralized secret redaction for logs, errors, and diagnostic output.
 *
 * Prevents accidental exposure of API keys, tokens, credentials, and other
 * sensitive values in terminal output, error messages, and generated artifacts.
 */

/** Default patterns that indicate secret-like values. */
const DEFAULT_SECRET_PATTERNS: readonly RegExp[] = [
  // API keys
  /sk-[a-zA-Z0-9]{20,}/g,
  /pk-[a-zA-Z0-9]{20,}/g,
  // GitHub
  /ghp_[a-zA-Z0-9]{36}/g,
  /gho_[a-zA-Z0-9]{36}/g,
  /github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}/g,
  // AWS
  /AKIA[0-9A-Z]{16}/g,
  // GCP
  /AIza[0-9A-Za-z\-_]{35}/g,
  // Generic bearer / token patterns
  /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/gi,
  // Private keys
  /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE\s+KEY-----/g,
  // Database URLs (contain passwords)
  /(?:postgres|mysql|mongodb|redis):\/\/[^:]+:[^@]+@[^/\s]+/gi,
];

/** Regex matching environment variable names that typically hold secrets. */
const SECRET_ENV_NAMES =
  /(?:API_KEY|API_SECRET|SECRET_KEY|ACCESS_TOKEN|AUTH_TOKEN|PRIVATE_KEY|DATABASE_URL|MONGODB_URI|REDIS_URL|SMTP_PASSWORD)/i;

/** Regex matching config key names that typically hold secrets. */
const SECRET_CONFIG_KEYS =
  /(?:apiKey|apiSecret|secretKey|accessToken|authToken|privateKey|password|databaseUrl|token)/i;

/** Placeholder used for redacted values. */
const REDACTED = "[REDACTED]";

export interface RedactOptions {
  /** Additional regex patterns to redact. */
  readonly extraPatterns?: readonly RegExp[];
  /** Custom replacement string (defaults to `[REDACTED]`). */
  readonly replacement?: string;
}

/**
 * Redacts secret-like values from a string.
 *
 * Matches common secret patterns (API keys, tokens, private keys, database URLs)
 * and replaces them with `[REDACTED]`.
 *
 * @param text - The text to redact.
 * @param options - Optional configuration.
 * @returns The redacted string.
 *
 * @example
 * ```ts
 * redact("Using key sk-abc123def456 for API call")
 * // => "Using key [REDACTED] for API call"
 * ```
 */
export function redact(text: string, options?: RedactOptions): string {
  const replacement = options?.replacement ?? REDACTED;
  const patterns = [...DEFAULT_SECRET_PATTERNS, ...(options?.extraPatterns ?? [])];

  let result = text;
  for (const pattern of patterns) {
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0;
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Checks if an environment variable name looks secret-like.
 *
 * @param name - The environment variable name.
 * @returns `true` if the name suggests the value is sensitive.
 */
export function isSecretEnvName(name: string): boolean {
  return SECRET_ENV_NAMES.test(name);
}

/**
 * Checks if a config key name looks secret-like.
 *
 * @param key - The config key.
 * @returns `true` if the key suggests the value is sensitive.
 */
export function isSecretConfigKey(key: string): boolean {
  return SECRET_CONFIG_KEYS.test(key);
}

/**
 * Sanitizes a configuration value for safe logging.
 * Masks values of keys that look secret-like.
 *
 * @param key - The config key.
 * @param value - The config value.
 * @returns The sanitized value string.
 */
export function sanitizeConfigValue(key: string, value: unknown): string {
  if (isSecretConfigKey(key)) {
    return typeof value === "string" && value.length > 0 ? REDACTED : String(value);
  }
  return String(value);
}
