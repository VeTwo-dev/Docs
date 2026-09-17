/**
 * AI Provider Metadata.
 *
 * Every provider exposes descriptive metadata about itself, independent of
 * runtime state. Metadata is used for discovery, display, and capability
 * negotiation — never for authentication.
 */

/** A model the provider can use. */
export interface AIProviderModel {
  /** Stable model identifier (e.g. `"gpt-4o"`, `"claude-3-opus"`). */
  readonly id: string;
  /** Human-readable display name. */
  readonly name: string;
  /** Maximum context window in tokens. */
  readonly contextWindow: number;
  /** Whether the model supports structured JSON output. */
  readonly structuredOutput?: boolean;
  /** Whether the model supports streaming. */
  readonly streaming?: boolean;
  /** Recommended for the given task type, if known. */
  readonly recommended?: boolean;
}

/** Authentication requirement kinds a provider may have. */
export type AIAuthKind = "none" | "apiKey" | "oauth" | "token" | "certificate" | "custom";

/** Describes how a provider authenticates. */
export interface AIProviderAuthRequirement {
  /** The authentication mechanism. */
  readonly kind: AIAuthKind;
  /** Environment variable names the provider checks (e.g. `["OPENAI_API_KEY"]`). */
  readonly envVars?: readonly string[];
  /** Human-readable instructions for obtaining credentials. */
  readonly setupInstructions?: string;
}

/**
 * Descriptive, immutable metadata about an AI provider.
 * Available without instantiating or connecting the provider.
 */
export interface AIProviderMetadata {
  /** Unique stable identifier (e.g. `"openwiki"`, `"openai"`, `"ollama"`). */
  readonly id: string;
  /** Human-readable display name (e.g. `"OpenWiki"`). */
  readonly displayName: string;
  /** Semantic version string. */
  readonly version: string;
  /** Package name for npm discovery (e.g. `"@vetwo/docs-provider-openwiki"`). */
  readonly packageName?: string;
  /** Models this provider can access. */
  readonly models: readonly AIProviderModel[];
  /** Authentication requirements. */
  readonly auth: AIProviderAuthRequirement;
  /** Human-readable description. */
  readonly description?: string;
  /** URLs the provider links to (docs, repo, homepage). */
  readonly urls?: {
    readonly homepage?: string;
    readonly docs?: string;
    readonly repository?: string;
  };
  /** Languages the provider supports for prose generation. */
  readonly supportedLanguages?: readonly string[];
  /** Output formats the provider can produce (e.g. `["markdown", "html"]`). */
  readonly supportedFormats?: readonly string[];
  /** Aliases that also resolve to this provider (e.g. `["gpt", "chatgpt"]`). */
  readonly aliases?: readonly string[];
}
