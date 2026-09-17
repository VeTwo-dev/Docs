import type { Example, ExampleGap, DuplicateGroup } from "../examples/models/index.js";
import type { ExampleDiagnostics } from "../examples/diagnostics/index.js";
import type { ProjectFile, ExampleEngineOptions } from "../examples/engine/index.js";
import type { PageDescriptor } from "../documentation-relations/resolvers/index.js";
import type {
  RelationshipEngineOptions,
  RelationshipDerivationResult,
} from "../documentation-relations/engine/index.js";
import type {
  DocumentationRelationship,
  LearningPath,
  PageNavigation,
  DocumentationRecommendation,
  RelationshipCycle,
} from "../documentation-relations/models/index.js";
import type { RelationshipDiagnostics } from "../documentation-relations/diagnostics/index.js";
import type { ExampleExtractorRegistry } from "../examples/registry/index.js";
import type { RelationshipResolverRegistry } from "../documentation-relations/registry/index.js";
import { extractExamples } from "../examples/engine/index.js";
import { deriveRelationships } from "../documentation-relations/engine/index.js";
import { createExampleExtractorRegistry } from "../examples/registry/index.js";
import { createRelationshipResolverRegistry } from "../documentation-relations/registry/index.js";
import { createDefaultExtractors } from "../examples/extractors/index.js";
import { createDefaultRelationshipResolvers } from "../documentation-relations/resolvers/index.js";

/** Input for {@link buildDocumentationIntelligence}. */
export interface DocumentationIntelligenceInput {
  /** Files to mine for examples. */
  readonly files?: readonly ProjectFile[];
  /** Pre-extracted examples (skips file extraction when provided). */
  readonly examples?: readonly Example[];
  /** Pages to derive relationships for. */
  readonly pages: readonly PageDescriptor[];
  /** Options forwarded to the example engine. */
  readonly exampleOptions?: ExampleEngineOptions;
  /** Options forwarded to the relationship engine. */
  readonly relationshipOptions?: RelationshipEngineOptions;
}

/** The unified documentation intelligence aggregate. */
export interface DocumentationIntelligence {
  readonly examples: readonly Example[];
  readonly exampleDiagnostics: ExampleDiagnostics;
  readonly relationships: readonly DocumentationRelationship[];
  readonly navigation: ReadonlyMap<string, PageNavigation>;
  readonly learningPaths: readonly LearningPath[];
  readonly cycles: readonly RelationshipCycle[];
  readonly relationshipDiagnostics: RelationshipDiagnostics;
  readonly exampleGaps: readonly ExampleGap[];
  readonly duplicateGroups: readonly DuplicateGroup[];
  readonly recommendations: readonly DocumentationRecommendation[];
  readonly summary: Readonly<{
    readonly filesScanned: number;
    readonly examples: number;
    readonly exampleGaps: number;
    readonly relationships: number;
    readonly learningPaths: number;
    readonly orphans: number;
    readonly cycles: number;
    readonly recommendations: number;
  }>;
}

/**
 * Builds the unified documentation intelligence by running the example
 * engine and the relationship engine over the same evidence, then
 * aggregating their results.
 */
export function buildDocumentationIntelligence(
  input: DocumentationIntelligenceInput,
  registries?: {
    readonly exampleExtractors?: ExampleExtractorRegistry;
    readonly relationshipResolvers?: RelationshipResolverRegistry;
  },
): DocumentationIntelligence {
  const exampleRegistry = registries?.exampleExtractors ?? createExampleExtractorRegistry();
  if (exampleRegistry.size === 0 && input.examples === undefined) {
    for (const extractor of createDefaultExtractors()) exampleRegistry.register(extractor);
  }
  const resolverRegistry =
    registries?.relationshipResolvers ?? createRelationshipResolverRegistry();
  if (resolverRegistry.size === 0) {
    for (const resolver of createDefaultRelationshipResolvers())
      resolverRegistry.register(resolver);
  }

  const exampleResult =
    input.examples !== undefined
      ? null
      : extractExamples(input.files ?? [], exampleRegistry, input.exampleOptions);

  const examples = input.examples ?? exampleResult?.examples ?? [];
  const exampleDiagnostics = exampleResult?.diagnostics;
  const exampleGaps = exampleResult?.gaps ?? [];
  const duplicateGroups = exampleResult?.duplicateGroups ?? [];

  const relationshipOptions: RelationshipEngineOptions = {
    ...input.relationshipOptions,
    evidence: {
      ...input.relationshipOptions?.evidence,
      examples,
    },
  };
  const relationshipResult: RelationshipDerivationResult = deriveRelationships(
    input.pages,
    resolverRegistry,
    relationshipOptions,
  );

  return Object.freeze({
    examples,
    exampleDiagnostics:
      exampleDiagnostics ??
      Object.freeze({
        invalidExamples: Object.freeze([]),
        staleExamples: Object.freeze([]),
        duplicateGroups: Object.freeze([]),
        gaps: Object.freeze([]),
        staleFindings: Object.freeze([]),
        summary: Object.freeze({
          total: examples.length,
          invalid: 0,
          stale: 0,
          duplicateGroups: 0,
          gaps: 0,
        }),
      }),
    relationships: relationshipResult.relationships,
    navigation: relationshipResult.navigation,
    learningPaths: relationshipResult.learningPaths,
    cycles: relationshipResult.cycles,
    relationshipDiagnostics: relationshipResult.diagnostics,
    exampleGaps,
    duplicateGroups,
    recommendations: relationshipResult.recommendations,
    summary: Object.freeze({
      filesScanned: exampleResult?.stats.filesScanned ?? 0,
      examples: examples.length,
      exampleGaps: exampleGaps.length,
      relationships: relationshipResult.relationships.length,
      learningPaths: relationshipResult.learningPaths.length,
      orphans: relationshipResult.diagnostics.orphanCount,
      cycles: relationshipResult.cycles.length,
      recommendations: relationshipResult.recommendations.length,
    }),
  });
}
