/**
 * AI Provider Health.
 *
 * Health status reported by providers for diagnostics and fallback decisions.
 */

/** Health status of an AI provider. */
export type AIProviderHealthStatus =
  | "available"
  | "configured"
  | "authenticated"
  | "reachable"
  | "compatible"
  | "rateLimited"
  | "degraded"
  | "unavailable"
  | "unconfigured"
  | "unauthenticated"
  | "error";

/** Detailed health information for a provider. */
export interface AIProviderHealth {
  /** Current status. */
  readonly status: AIProviderHealthStatus;
  /** Human-readable health message. */
  readonly message: string;
  /** Timestamp of the last health check. */
  readonly checkedAt: string;
  /** Latency of the last health check in ms, if applicable. */
  readonly latencyMs?: number;
  /** Rate limit remaining, if known. */
  readonly rateLimitRemaining?: number;
  /** Rate limit reset time, if known. */
  readonly rateLimitReset?: string;
  /** Whether the provider is currently usable. */
  readonly healthy: boolean;
}
