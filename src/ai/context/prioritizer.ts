/**
 * AI Context Prioritizer.
 *
 * Orders and trims context elements by relevance to the current generation
 * task. Respects a token budget and prioritizes evidence-backed information
 * over speculative content.
 */

import type { AIContextBundle } from "../types.js";
import type { AIDocumentationIntent, AIAudience } from "../types.js";

/** A scored context element. */
export interface PrioritizedElement {
  /** The element data. */
  readonly data: unknown;
  /** Relevance score (0 = irrelevant, 1 = critical). */
  readonly score: number;
  /** Reason for the score. */
  readonly reason: string;
}

/** Prioritization configuration. */
export interface PrioritizationConfig {
  /** The documentation intent. */
  readonly intent: AIDocumentationIntent;
  /** The target audience. */
  readonly audience: AIAudience;
  /** Maximum tokens to allocate. */
  readonly maxTokens: number;
  /** Additional relevance hints (symbol names, file paths, etc.). */
  readonly hints?: readonly string[];
}

/**
 * Prioritize API symbols by relevance to the intent and audience.
 */
export function prioritizeAPIs(
  apis: AIContextBundle["api"],
  config: PrioritizationConfig,
): PrioritizedElement[] {
  if (apis?.publicSymbols === undefined) return [];

  return apis.publicSymbols
    .map((symbol) => {
      let score = 0.5;

      // Intent-based scoring
      if (config.intent === "api-reference") score += 0.3;
      if (config.intent === "overview" && symbol.kind === "function") score += 0.1;
      if (config.intent === "getting-started" && symbol.kind === "function") score += 0.15;
      if (config.intent === "concept" && (symbol.kind === "interface" || symbol.kind === "type"))
        score += 0.15;

      // Audience-based scoring
      if (config.audience === "api-consumer" && symbol.kind === "function") score += 0.1;
      if (config.audience === "beginner" && symbol.description !== undefined) score += 0.05;

      // Hint-based scoring
      if (config.hints !== undefined) {
        for (const hint of config.hints) {
          if (symbol.name.includes(hint) || symbol.sourceFile?.includes(hint)) {
            score += 0.2;
            break;
          }
        }
      }

      return {
        data: symbol,
        score: Math.min(score, 1),
        reason: `intent=${config.intent}, kind=${symbol.kind}`,
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Prioritize examples by relevance.
 */
export function prioritizeExamples(
  examples: AIContextBundle["examples"],
  config: PrioritizationConfig,
): PrioritizedElement[] {
  if (examples === undefined) return [];

  return examples
    .map((example) => {
      let score = example.confidence;

      // Intent-based
      if (config.intent === "example") score += 0.2;
      if (
        config.intent === "getting-started" &&
        (example.source === "project" || example.source === "test")
      )
        score += 0.15;
      if (config.intent === "tutorial" && example.source !== "generated") score += 0.1;
      if (config.intent === "guide") score += 0.05;

      // Source-based
      if (example.source === "project") score += 0.15;
      if (example.source === "test") score += 0.05;

      // Hint-based
      if (config.hints !== undefined && example.apis !== undefined) {
        for (const hint of config.hints) {
          if (example.apis.some((api) => api.includes(hint))) {
            score += 0.2;
            break;
          }
        }
      }

      return {
        data: example,
        score: Math.min(score, 1),
        reason: `source=${example.source}, confidence=${example.confidence}`,
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Prioritize concepts by relevance.
 */
export function prioritizeConcepts(
  concepts: AIContextBundle["concepts"],
  config: PrioritizationConfig,
): PrioritizedElement[] {
  if (concepts === undefined) return [];

  return concepts
    .map((concept) => {
      let score = 0.5;

      if (config.intent === "concept") score += 0.3;
      if (config.intent === "overview") score += 0.1;
      if (
        config.intent === "getting-started" &&
        concept.relatedApis !== undefined &&
        concept.relatedApis.length > 0
      ) {
        score += 0.1;
      }

      if (config.hints !== undefined) {
        for (const hint of config.hints) {
          if (concept.name.includes(hint)) {
            score += 0.25;
            break;
          }
        }
      }

      return {
        data: concept,
        score: Math.min(score, 1),
        reason: `intent=${config.intent}`,
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Trim a prioritized list to fit within a token budget.
 * Each element is serialized to estimate its token cost.
 */
export function trimToBudget<T>(
  elements: PrioritizedElement[],
  maxTokens: number,
  serialize: (item: T) => string,
): PrioritizedElement[] {
  const result: PrioritizedElement[] = [];
  let usedTokens = 0;

  for (const element of elements) {
    const itemTokens = Math.ceil(serialize(element.data as T).length / 4);
    if (usedTokens + itemTokens <= maxTokens) {
      result.push(element);
      usedTokens += itemTokens;
    }
  }

  return result;
}
