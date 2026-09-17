/**
 * AI Provider Interface.
 *
 * The core contract every AI provider must implement. The AI Documentation
 * Engine communicates exclusively through this interface — it never imports
 * provider-specific code.
 *
 * Providers are stateful: they must be initialized before use and disposed
 * when no longer needed. The lifecycle is:
 *
 *   construct → initialize() → [analyze | generate | update]* → dispose()
 */

import type { AIProviderMetadata } from "./metadata.js";
import type { AIProviderCapabilities } from "./capabilities.js";
import type {
  AIAnalysisRequest,
  AIAnalysisResult,
  AIDocumentationRequest,
  AIDocumentationResult,
  AIUpdateRequest,
  AIUpdateResult,
  AIProviderContext,
} from "./types.js";

/**
 * The core AI provider contract.
 *
 * @example
 * ```ts
 * class MyProvider implements AIProvider {
 *   metadata = { id: "my-provider", displayName: "My Provider", ... };
 *   capabilities = { documentationGeneration: true, ... };
 *
 *   async initialize(context: AIProviderContext): Promise<void> { ... }
 *   async analyze(request: AIAnalysisRequest): Promise<AIAnalysisResult> { ... }
 *   async generate(request: AIDocumentationRequest): Promise<AIDocumentationResult> { ... }
 *   async update(request: AIUpdateRequest): Promise<AIUpdateResult> { ... }
 *   async dispose(): Promise<void> { ... }
 * }
 * ```
 */
export interface AIProvider {
  /** Descriptive metadata (available without initialization). */
  readonly metadata: AIProviderMetadata;

  /** Capabilities this provider supports. */
  readonly capabilities: AIProviderCapabilities;

  /**
   * Initialize the provider. Called once before any other method.
   * Authenticate, establish connections, validate configuration.
   */
  initialize(context: AIProviderContext): Promise<void>;

  /**
   * Analyze project intelligence and return a structured summary.
   * The provider should reason over the provided context, not rescan.
   */
  analyze(request: AIAnalysisRequest): Promise<AIAnalysisResult>;

  /**
   * Generate documentation content from a structured request.
   * The provider must return structured data, not rendered HTML.
   */
  generate(request: AIDocumentationRequest): Promise<AIDocumentationResult>;

  /**
   * Update existing documentation based on detected changes.
   * The provider should only regenerate affected content.
   */
  update(request: AIUpdateRequest): Promise<AIUpdateResult>;

  /**
   * Dispose of resources (connections, caches, etc.).
   * Called when the provider is no longer needed.
   */
  dispose(): Promise<void>;
}

/**
 * A factory that creates AI provider instances.
 * Used by the discovery system for lazy loading.
 */
export interface AIProviderFactory {
  /** The metadata of the provider this factory creates. */
  readonly metadata: AIProviderMetadata;
  /** Create a new provider instance. */
  create(): AIProvider;
}
