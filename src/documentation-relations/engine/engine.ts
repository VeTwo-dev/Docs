import type { RelationshipResolverRegistry } from "../registry/index.js";
import type { RelationshipCache } from "../cache/index.js";
import type { PageDescriptor, RelationshipEvidence } from "../resolvers/index.js";
import type {
  DocumentationRelationship,
  LearningAudience,
  LearningPath,
  PageNavigation,
  DocumentationRecommendation,
  RelationshipCycle,
} from "../models/index.js";
import type { RelationshipDiagnostics } from "../diagnostics/index.js";
import { createDocumentationRelationship, inverseRelationshipKind } from "../models/index.js";
import { createRelationshipCache, pageContentHash } from "../cache/index.js";
import { createRelationshipGraph } from "../graph/index.js";
import { buildNavigation } from "../navigation/index.js";
import { planLearningPaths } from "../planners/index.js";
import {
  detectRelationshipCycles,
  detectRelationshipGaps,
  recommendDocumentationActions,
  buildRelationshipDiagnostics,
} from "../diagnostics/index.js";

/** Options for {@link deriveRelationships}. */
export interface RelationshipEngineOptions {
  readonly evidence?: RelationshipEvidence;
  /** Explicit reading order for previous/next navigation. */
  readonly readingOrder?: readonly string[];
  /** Learning audiences to plan paths for. */
  readonly audiences?: readonly LearningAudience[];
  /** Whether to mirror inverse directional edges. Default true. */
  readonly mirrorInverses?: boolean;
  /** An external cache; a fresh one is created when omitted. */
  readonly cache?: RelationshipCache;
  /** Run diagnostics (cycles, gaps, recommendations). Default true. */
  readonly diagnostics?: boolean;
}

/** The result of a relationship derivation run. */
export interface RelationshipDerivationResult {
  readonly relationships: readonly DocumentationRelationship[];
  readonly graph: ReturnType<typeof createRelationshipGraph>;
  readonly navigation: ReadonlyMap<string, PageNavigation>;
  readonly learningPaths: readonly LearningPath[];
  readonly cycles: readonly RelationshipCycle[];
  readonly recommendations: readonly DocumentationRecommendation[];
  readonly diagnostics: RelationshipDiagnostics;
  readonly stats: Readonly<{
    readonly pages: number;
    readonly relationships: number;
    readonly mirrored: number;
    readonly learningPaths: number;
    readonly cacheHit: boolean;
  }>;
}

/**
 * The documentation relationship intelligence engine.
 *
 * Pipeline: resolve relationships (via the resolver registry, cached) →
 * mirror inverse directional edges → build the relationship graph →
 * build navigation → plan learning paths → detect cycles and gaps →
 * recommend actions → diagnostics report.
 *
 * The engine never writes files and never invents relationships without
 * evidence. The cache is keyed on the combined page signature: relationships
 * depend on the whole page set, so a single content change invalidates the
 * entry.
 */
export function deriveRelationships(
  pages: readonly PageDescriptor[],
  registry: RelationshipResolverRegistry,
  options: RelationshipEngineOptions = {},
): RelationshipDerivationResult {
  const cache = options.cache ?? createRelationshipCache();
  const signature = combinedSignature(pages);
  let relationships = cache.get("__all__", signature);
  let cacheHit = false;

  if (relationships !== undefined) {
    cacheHit = true;
  } else {
    relationships = registry.resolve({ pages, evidence: options.evidence });
    cache.set("__all__", signature, relationships);
  }

  const mirrorInverses = options.mirrorInverses ?? true;
  let mirrored: readonly DocumentationRelationship[] = [];
  if (mirrorInverses) {
    mirrored = mirrorInverseEdges(relationships);
  }

  const all = dedupe([...relationships, ...mirrored]);
  const graph = createRelationshipGraph(all);
  const navigation = buildNavigation(pages, all, { readingOrder: options.readingOrder });
  const learningPaths = planLearningPaths(pages, { audiences: options.audiences });

  let cycles: readonly RelationshipCycle[] = [];
  let recommendations: readonly DocumentationRecommendation[] = [];
  let diagnostics: RelationshipDiagnostics;

  if (options.diagnostics !== false) {
    cycles = detectRelationshipCycles(all);
    const gaps = detectRelationshipGaps(pages, all);
    recommendations = recommendDocumentationActions(pages, all, gaps);
    diagnostics = buildRelationshipDiagnostics({ relationships: all, cycles, gaps });
  } else {
    diagnostics = buildRelationshipDiagnostics({ relationships: all });
  }

  return Object.freeze({
    relationships: all,
    graph,
    navigation,
    learningPaths,
    cycles,
    recommendations,
    diagnostics,
    stats: Object.freeze({
      pages: pages.length,
      relationships: all.length,
      mirrored: mirrored.length,
      learningPaths: learningPaths.length,
      cacheHit,
    }),
  });
}

function combinedSignature(pages: readonly PageDescriptor[]): string {
  return pageContentHash(
    pages
      .map((page) => `${page.slug}\u0000${page.content ?? ""}\u0000${page.path}`)
      .sort()
      .join("\u0001"),
  );
}

function mirrorInverseEdges(
  relationships: readonly DocumentationRelationship[],
): readonly DocumentationRelationship[] {
  const mirrored: DocumentationRelationship[] = [];
  for (const relationship of relationships) {
    const inverseKind = inverseRelationshipKind(relationship.kind);
    if (inverseKind === undefined) continue;
    const already = relationships.some(
      (candidate) =>
        candidate.from === relationship.to &&
        candidate.kind === inverseKind &&
        candidate.to === relationship.from,
    );
    if (already) continue;
    mirrored.push(
      createDocumentationRelationship({
        from: relationship.to,
        to: relationship.from,
        kind: inverseKind,
        label: `Inverse: ${relationship.label}`,
        evidence: relationship.evidence.map(
          (item) =>
            `mirrored from "${relationship.from} ${relationship.kind} ${relationship.to}": ${item}`,
        ),
        confidence: relationship.confidence,
        weight: relationship.weight * 0.9,
        source: `${relationship.source} (mirror)`,
      }),
    );
  }
  return Object.freeze(mirrored);
}

function dedupe(relationships: readonly DocumentationRelationship[]): DocumentationRelationship[] {
  const seen = new Set<string>();
  const unique: DocumentationRelationship[] = [];
  for (const relationship of relationships) {
    if (seen.has(relationship.id)) continue;
    seen.add(relationship.id);
    unique.push(relationship);
  }
  return unique;
}
