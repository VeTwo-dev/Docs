/**
 * OpenWiki AI Provider Adapter.
 *
 * This is the first official AI provider for @vetwo/docs. It adapts
 * OpenWiki-specific concepts into the generic AIProvider interface.
 *
 * OpenWiki-specific types, authentication, and API details stay inside
 * this file — the core never exposes them.
 */

import type { AIProvider, AIProviderFactory } from "../provider.js";
import type { AIProviderMetadata } from "../metadata.js";
import type { AIProviderCapabilities } from "../capabilities.js";
import type {
  AIAnalysisRequest,
  AIAnalysisResult,
  AIDocumentationRequest,
  AIDocumentationResult,
  AIUpdateRequest,
  AIUpdateResult,
  AIProviderContext,
} from "../types.js";

/** OpenWiki-specific configuration options. */
interface OpenWikiOptions {
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly model?: string;
  readonly language?: string;
  readonly architecture?: boolean;
  readonly diagrams?: boolean;
  readonly incremental?: boolean;
}

/** OpenWiki provider metadata. */
const OPENWIKI_METADATA: AIProviderMetadata = {
  id: "openwiki",
  displayName: "OpenWiki",
  version: "0.1.0",
  packageName: "@vetwo/docs-provider-openwiki",
  models: [
    {
      id: "openwiki-default",
      name: "OpenWiki Default",
      contextWindow: 128000,
      structuredOutput: true,
      streaming: true,
      recommended: true,
    },
  ],
  auth: {
    kind: "apiKey",
    envVars: ["OPENWIKI_API_KEY"],
    setupInstructions:
      "Get an API key from https://openwiki.dev/api-keys and set OPENWIKI_API_KEY in your environment.",
  },
  description: "OpenWiki AI documentation provider — optimized for documentation generation.",
  urls: {
    homepage: "https://openwiki.dev",
    docs: "https://openwiki.dev/docs",
    repository: "https://github.com/openwiki/provider",
  },
  supportedLanguages: ["en", "ar", "fr", "es", "de", "ja", "zh"],
  supportedFormats: ["markdown", "mdx"],
  aliases: ["wiki"],
};

/** OpenWiki provider capabilities. */
const OPENWIKI_CAPABILITIES: AIProviderCapabilities = {
  projectAnalysis: true,
  documentationGeneration: true,
  architectureGeneration: true,
  examples: true,
  diagrams: true,
  tutorials: true,
  troubleshooting: true,
  migrationGuides: true,
  incrementalGeneration: true,
  structuredOutput: true,
  streaming: true,
  apiReference: true,
  conceptDocs: true,
  guides: true,
  faq: true,
  claimValidation: false,
  translation: false,
};

/**
 * OpenWiki AI Provider.
 *
 * Adapts the OpenWiki documentation API to the generic AIProvider interface.
 * All OpenWiki-specific concepts are confined to this class.
 */
class OpenWikiProvider implements AIProvider {
  readonly metadata = OPENWIKI_METADATA;
  readonly capabilities = OPENWIKI_CAPABILITIES;

  private options: OpenWikiOptions = {};

  async initialize(context: AIProviderContext): Promise<void> {
    this.options = (context.options ?? {}) as OpenWikiOptions;

    const apiKey = this.options.apiKey ?? process.env["OPENWIKI_API_KEY"];
    if (apiKey === undefined || apiKey.length === 0) {
      throw new Error(
        "OpenWiki requires an API key. Set OPENWIKI_API_KEY or configure ai.options.apiKey.",
      );
    }
  }

  async analyze(request: AIAnalysisRequest): Promise<AIAnalysisResult> {
    // In a real implementation, this would call the OpenWiki API.
    // For now, return a structured placeholder.
    const summary = `Project "${request.projectIntelligence["name"] ?? "unknown"}" analyzed.`;
    return {
      summary,
      projectType: request.projectIntelligence["type"] as string | undefined,
      subsystems: [],
      recommendedStructure: ["overview", "getting-started", "api-reference", "guides"],
      terminology: [],
    };
  }

  async generate(request: AIDocumentationRequest): Promise<AIDocumentationResult> {
    // In a real implementation, this would call the OpenWiki generation API.
    // For now, return a structured placeholder.
    const page = {
      slug: request.topic.toLowerCase().replace(/\s+/g, "-"),
      title: request.topic,
      content: `# ${request.topic}\n\nDocumentation for ${request.topic}.`,
      intent: request.intent,
      audience: request.audience,
      language: request.language ?? "en",
      format: request.format ?? ("markdown" as const),
      claims: [],
      evidence: [],
    };
    return {
      pages: [page],
      diagrams: [],
      exampleProposals: [],
      recommendations: [],
      claims: [],
    };
  }

  async update(_request: AIUpdateRequest): Promise<AIUpdateResult> {
    return {
      updated: [],
      unchanged: [],
      removed: [],
    };
  }

  async dispose(): Promise<void> {
    this.options = {};
  }
}

/**
 * Create an OpenWiki provider factory.
 * The factory is the entry point for provider discovery and registration.
 */
export function createOpenWikiProviderFactory(): AIProviderFactory {
  return {
    metadata: OPENWIKI_METADATA,
    create() {
      return new OpenWikiProvider();
    },
  };
}
