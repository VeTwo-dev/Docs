/**
 * AI Provider Configuration.
 *
 * Configuration types for the AI provider system, integrated with the
 * docs.config.ts configuration format.
 */

/** Configuration for a single AI provider. */
export interface AIProviderConfig {
  /** Provider ID (e.g. `"openwiki"`, `"openai"`, `"ollama"`). */
  readonly name: string;
  /** Whether this provider is enabled. */
  readonly enabled?: boolean;
  /** Priority (lower = higher). Used for fallback ordering. */
  readonly priority?: number;
  /** Provider-specific options (passed directly to the provider). */
  readonly options?: Record<string, unknown>;
}

/** Top-level AI configuration. */
export interface AIConfig {
  /** Whether AI documentation generation is enabled. */
  readonly enabled: boolean;
  /** The primary provider to use. */
  readonly provider?: string;
  /** Provider-specific options (shorthand for single-provider setup). */
  readonly options?: Record<string, unknown>;
  /** Multiple provider configuration. */
  readonly providers?: readonly AIProviderConfig[];
  /** Named provider profiles. */
  readonly profiles?: Readonly<Record<string, AIProviderProfile>>;
  /** Active profile name. */
  readonly activeProfile?: string;
  /** Fallback chain configuration. */
  readonly fallback?: {
    /** Ordered list of provider IDs to try on failure. */
    readonly providers?: readonly string[];
    /** Whether to fall back to deterministic generation. */
    readonly deterministicFallback?: boolean;
  };
  /** Default voice / style for AI generation. */
  readonly voice?: {
    readonly language?: string;
    readonly tone?: string;
    readonly depth?: string;
    readonly verbosity?: string;
  };
  /** Which capabilities to enable. */
  readonly capabilities?: {
    readonly projectAnalysis?: boolean;
    readonly documentationGeneration?: boolean;
    readonly architectureGeneration?: boolean;
    readonly examples?: boolean;
    readonly diagrams?: boolean;
    readonly tutorials?: boolean;
    readonly troubleshooting?: boolean;
    readonly migrationGuides?: boolean;
    readonly incrementalGeneration?: boolean;
  };
}

/** A named provider profile for switching between configurations. */
export interface AIProviderProfile {
  /** Profile display name. */
  readonly name: string;
  /** Provider to use for this profile. */
  readonly provider: string;
  /** Model to use. */
  readonly model?: string;
  /** Provider-specific options. */
  readonly options?: Record<string, unknown>;
  /** Voice override for this profile. */
  readonly voice?: {
    readonly language?: string;
    readonly tone?: string;
    readonly depth?: string;
    readonly verbosity?: string;
  };
}

/** Default AI configuration applied when none is specified. */
export const DEFAULT_AI_CONFIG: AIConfig = {
  enabled: false,
  fallback: {
    deterministicFallback: true,
  },
  capabilities: {
    projectAnalysis: true,
    documentationGeneration: true,
    architectureGeneration: true,
    examples: true,
    diagrams: true,
    tutorials: false,
    troubleshooting: true,
    migrationGuides: false,
    incrementalGeneration: true,
  },
};

/**
 * Resolve the effective AI configuration by merging user config with defaults.
 */
export function resolveAIConfig(input?: Partial<AIConfig>): AIConfig {
  if (input === undefined) return DEFAULT_AI_CONFIG;
  return {
    enabled: input.enabled ?? DEFAULT_AI_CONFIG.enabled,
    provider: input.provider,
    options: input.options,
    providers: input.providers,
    profiles: input.profiles,
    activeProfile: input.activeProfile,
    fallback: {
      deterministicFallback:
        input.fallback?.deterministicFallback ?? DEFAULT_AI_CONFIG.fallback?.deterministicFallback,
      providers: input.fallback?.providers,
    },
    voice: input.voice,
    capabilities: {
      projectAnalysis:
        input.capabilities?.projectAnalysis ?? DEFAULT_AI_CONFIG.capabilities?.projectAnalysis,
      documentationGeneration:
        input.capabilities?.documentationGeneration ??
        DEFAULT_AI_CONFIG.capabilities?.documentationGeneration,
      architectureGeneration:
        input.capabilities?.architectureGeneration ??
        DEFAULT_AI_CONFIG.capabilities?.architectureGeneration,
      examples: input.capabilities?.examples ?? DEFAULT_AI_CONFIG.capabilities?.examples,
      diagrams: input.capabilities?.diagrams ?? DEFAULT_AI_CONFIG.capabilities?.diagrams,
      tutorials: input.capabilities?.tutorials ?? DEFAULT_AI_CONFIG.capabilities?.tutorials,
      troubleshooting:
        input.capabilities?.troubleshooting ?? DEFAULT_AI_CONFIG.capabilities?.troubleshooting,
      migrationGuides:
        input.capabilities?.migrationGuides ?? DEFAULT_AI_CONFIG.capabilities?.migrationGuides,
      incrementalGeneration:
        input.capabilities?.incrementalGeneration ??
        DEFAULT_AI_CONFIG.capabilities?.incrementalGeneration,
    },
  };
}
