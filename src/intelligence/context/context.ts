import type { Example, ExampleGap } from "../../examples/models/index.js";
import type { PageDescriptor } from "../../documentation-relations/resolvers/index.js";
import type {
  DocumentationRelationship,
  LearningPath,
  PageNavigation,
} from "../../documentation-relations/models/index.js";
import type { DocumentationIntelligence } from "../aggregate.js";

/**
 * AI-context preparation contracts.
 *
 * Every function returns structured, evidence-backed context — never
 * prompts. Downstream consumers (AI providers, doc generators) build their
 * own instructions from this context.
 */

/** Context for a single example. */
export interface ExampleContext {
  readonly kind: "example";
  readonly id: string;
  readonly title: string;
  readonly type: string;
  readonly language: string;
  readonly framework?: string;
  readonly content: string;
  readonly description?: string;
  readonly provenance: Readonly<{
    readonly kind: string;
    readonly source: string;
    readonly context?: string;
  }>;
  readonly referencedSymbols: readonly string[];
  readonly referencedPackages: readonly string[];
  readonly confidence: number;
  readonly importance: number;
  readonly validation: string;
}

/** Context for a documentation gap. */
export interface ExampleGapContext {
  readonly kind: "gap";
  readonly id: string;
  readonly relatedNodeId: string;
  readonly importance: number;
  readonly missingExampleType: string;
  readonly recommendedComplexity: string;
  readonly evidence: readonly string[];
}

/** Context for a page and its relationships. */
export interface PageRelationshipContext {
  readonly kind: "page-relationships";
  readonly page: string;
  readonly title: string;
  readonly path: string;
  readonly previous?: string;
  readonly next?: string;
  readonly breadcrumbs: readonly string[];
  readonly related: readonly Readonly<{
    readonly to: string;
    readonly kind: string;
    readonly label: string;
    readonly weight: number;
  }>[];
  readonly seeAlso: readonly string[];
  readonly evidence: readonly string[];
}

/** Context for a learning path. */
export interface LearningPathContext {
  readonly kind: "learning-path";
  readonly id: string;
  readonly title: string;
  readonly audience: string;
  readonly steps: readonly Readonly<{
    readonly page: string;
    readonly stage: string;
    readonly label: string;
    readonly position: number;
  }>[];
  readonly confidence: number;
}

/** Context for documentation planning (aggregate evidence). */
export interface DocumentationPlanningContext {
  readonly kind: "planning";
  readonly summary: DocumentationIntelligence["summary"];
  readonly topExamples: readonly ExampleContext[];
  readonly gaps: readonly ExampleGapContext[];
  readonly cycles: readonly string[];
  readonly recommendations: readonly Readonly<{
    readonly page: string;
    readonly action: string;
    readonly severity: string;
  }>[];
  readonly learningPaths: readonly LearningPathContext[];
}

/** Builds {@link ExampleContext} from a resolved example. */
export function createExampleContext(example: Example): ExampleContext {
  return Object.freeze({
    kind: "example",
    id: example.id,
    title: example.title,
    type: example.type,
    language: example.language,
    ...(example.framework !== undefined ? { framework: example.framework } : {}),
    content: example.content,
    ...(example.description !== undefined ? { description: example.description } : {}),
    provenance: Object.freeze({
      kind: example.provenance.kind,
      source: example.provenance.source,
      ...(example.provenance.context !== undefined ? { context: example.provenance.context } : {}),
    }),
    referencedSymbols: Object.freeze([...example.referencedSymbols]),
    referencedPackages: Object.freeze([...example.referencedPackages]),
    confidence: example.confidence,
    importance: example.importance,
    validation: example.validation,
  });
}

/** Builds {@link ExampleGapContext} from a resolved gap. */
export function createExampleGapContext(gap: ExampleGap): ExampleGapContext {
  return Object.freeze({
    kind: "gap",
    id: gap.id,
    relatedNodeId: gap.relatedNodeId,
    importance: gap.importance,
    missingExampleType: gap.missingExampleType,
    recommendedComplexity: gap.recommendedComplexity,
    evidence: Object.freeze([...gap.evidence]),
  });
}

/** Builds {@link PageRelationshipContext} for a page. */
export function createPageRelationshipContext(
  page: PageDescriptor,
  navigation: PageNavigation | undefined,
  relationships: readonly DocumentationRelationship[],
): PageRelationshipContext {
  const outgoing = relationships.filter((relationship) => relationship.from === page.slug);
  return Object.freeze({
    kind: "page-relationships",
    page: page.slug,
    title: page.title,
    path: page.path,
    ...(navigation?.previous !== undefined ? { previous: navigation.previous } : {}),
    ...(navigation?.next !== undefined ? { next: navigation.next } : {}),
    breadcrumbs: Object.freeze([...(navigation?.breadcrumbs ?? [])]),
    related: Object.freeze(
      [...outgoing]
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 8)
        .map((relationship) =>
          Object.freeze({
            to: relationship.to,
            kind: relationship.kind,
            label: relationship.label,
            weight: relationship.weight,
          }),
        ),
    ),
    seeAlso: Object.freeze(outgoing.filter((r) => r.kind === "relatedTo").map((r) => r.to)),
    evidence: Object.freeze(outgoing.flatMap((relationship) => relationship.evidence)),
  });
}

/** Builds {@link LearningPathContext} from a path. */
export function createLearningPathContext(path: LearningPath): LearningPathContext {
  return Object.freeze({
    kind: "learning-path",
    id: path.id,
    title: path.title,
    audience: path.audience,
    steps: Object.freeze(
      path.steps.map((step) =>
        Object.freeze({
          page: step.page,
          stage: step.stage,
          label: step.label,
          position: step.position,
        }),
      ),
    ),
    confidence: path.confidence,
  });
}

/** Builds {@link DocumentationPlanningContext} from the aggregate. */
export function createDocumentationPlanningContext(
  intelligence: DocumentationIntelligence,
): DocumentationPlanningContext {
  const topExamples = [...intelligence.examples]
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 10)
    .map(createExampleContext);

  return Object.freeze({
    kind: "planning",
    summary: intelligence.summary,
    topExamples,
    gaps: Object.freeze(intelligence.exampleGaps.map(createExampleGapContext)),
    cycles: Object.freeze(
      intelligence.cycles.map((cycle) => `${cycle.kind}: ${cycle.pages.join(" → ")}`),
    ),
    recommendations: Object.freeze(
      intelligence.recommendations.map((recommendation) =>
        Object.freeze({
          page: recommendation.page,
          action: recommendation.action,
          severity: recommendation.severity,
        }),
      ),
    ),
    learningPaths: Object.freeze(intelligence.learningPaths.map(createLearningPathContext)),
  });
}
