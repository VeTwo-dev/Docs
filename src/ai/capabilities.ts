/**
 * AI Provider Capabilities.
 *
 * Providers declare which features they support. The AI Documentation Engine
 * uses capability negotiation to route work only to providers that can handle
 * it, falling back to deterministic paths when no provider supports a feature.
 */

/** Capability categories that an AI provider may support. */
export interface AIProviderCapabilities {
  /** Analyze project structure and produce intelligence summaries. */
  readonly projectAnalysis?: boolean;
  /** Generate prose documentation pages from structured context. */
  readonly documentationGeneration?: boolean;
  /** Generate architecture documentation from knowledge graph data. */
  readonly architectureGeneration?: boolean;
  /** Generate or select code examples. */
  readonly examples?: boolean;
  /** Generate diagram definitions (Mermaid, etc.). */
  readonly diagrams?: boolean;
  /** Generate step-by-step tutorials. */
  readonly tutorials?: boolean;
  /** Generate troubleshooting guides. */
  readonly troubleshooting?: boolean;
  /** Generate migration guides between versions. */
  readonly migrationGuides?: boolean;
  /** Support incremental generation (only regenerate affected content). */
  readonly incrementalGeneration?: boolean;
  /** Return structured JSON output (not just prose). */
  readonly structuredOutput?: boolean;
  /** Stream responses token-by-token. */
  readonly streaming?: boolean;
  /** Generate API reference documentation from symbols + references. */
  readonly apiReference?: boolean;
  /** Generate concept documentation explaining "what it is" / "why it exists". */
  readonly conceptDocs?: boolean;
  /** Generate step-by-step guides. */
  readonly guides?: boolean;
  /** Generate FAQ entries. */
  readonly faq?: boolean;
  /** Validate generated claims against project evidence. */
  readonly claimValidation?: boolean;
  /** Translate prose to other languages (without translating code). */
  readonly translation?: boolean;
}

/**
 * A requested capability the engine wants to execute.
 * Used for capability negotiation before calling a provider.
 */
export type AICapability =
  | "projectAnalysis"
  | "documentationGeneration"
  | "architectureGeneration"
  | "examples"
  | "diagrams"
  | "tutorials"
  | "troubleshooting"
  | "migrationGuides"
  | "incrementalGeneration"
  | "structuredOutput"
  | "streaming"
  | "apiReference"
  | "conceptDocs"
  | "guides"
  | "faq"
  | "claimValidation"
  | "translation";

/**
 * Check whether a capabilities object supports a given capability.
 */
export function hasCapability(
  capabilities: AIProviderCapabilities,
  capability: AICapability,
): boolean {
  return capabilities[capability] === true;
}

/**
 * Return all capabilities a provider supports as an array of capability names.
 */
export function supportedCapabilities(capabilities: AIProviderCapabilities): AICapability[] {
  const result: AICapability[] = [];
  for (const key of Object.keys(capabilities) as AICapability[]) {
    if (capabilities[key] === true) result.push(key);
  }
  return result;
}

/**
 * Return the intersection of two capability sets — the capabilities
 * both providers support.
 */
export function intersectCapabilities(
  a: AIProviderCapabilities,
  b: AIProviderCapabilities,
): AIProviderCapabilities {
  const result: Record<string, boolean> = {};
  for (const key of Object.keys(a) as AICapability[]) {
    if (a[key] === true && b[key] === true) result[key] = true;
  }
  return result;
}
