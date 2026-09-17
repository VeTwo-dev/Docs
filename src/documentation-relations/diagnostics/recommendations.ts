import type { PageDescriptor } from "../resolvers/index.js";
import type { DocumentationRelationship } from "../models/index.js";
import type { DocumentationRecommendation } from "../models/index.js";
import type { RelationshipGapFinding } from "./gaps.js";
import { createDocumentationRecommendation } from "../models/index.js";
import { createRelationshipGraph } from "../graph/index.js";

/**
 * Produces documentation recommendations from the derived relationship graph
 * and gap findings. Recommendations are suggestions only — nothing is
 * written.
 */
export function recommendDocumentationActions(
  pages: readonly PageDescriptor[],
  relationships: readonly DocumentationRelationship[],
  gapFindings: readonly RelationshipGapFinding[],
): readonly DocumentationRecommendation[] {
  const recommendations: DocumentationRecommendation[] = [];
  const graph = createRelationshipGraph(relationships);

  for (const finding of gapFindings) {
    const page = pages.find((candidate) => candidate.slug === finding.page);
    if (page === undefined) continue;

    if (finding.kind === "orphan") {
      recommendations.push(
        createDocumentationRecommendation({
          page: page.slug,
          action: `Link "${page.title}" into the documentation set — it has no relationships.`,
          evidence: finding.evidence,
          suggestionKind: "relatedTo",
          severity: "high",
          confidence: 0.9,
        }),
      );
    } else if (finding.kind === "dead-end") {
      const kind = finding.outgoing === 0 ? "nextStep" : "prerequisite";
      recommendations.push(
        createDocumentationRecommendation({
          page: page.slug,
          action:
            finding.outgoing === 0
              ? `Add a "${kind}" from "${page.title}" to continue the reading flow.`
              : `Add a "${kind}" leading into "${page.title}".`,
          evidence: finding.evidence,
          suggestionKind: kind,
          severity: "medium",
          confidence: 0.7,
        }),
      );
    }
  }

  // Overview pages should summarize their children.
  for (const page of pages) {
    if (page.kind !== "overview") continue;
    const children = pages.filter((candidate) =>
      candidate.path.startsWith(`${page.path.replace(/\.(mdx?)$/, "")}/`),
    );
    if (children.length === 0) continue;
    const summarizes = children.some(
      (child) => graph.find(page.slug, "summarizes", child.slug) !== undefined,
    );
    if (!summarizes) {
      recommendations.push(
        createDocumentationRecommendation({
          page: page.slug,
          action: `Add "summarizes" relationships from "${page.title}" to its child pages.`,
          evidence: [`overview "${page.slug}" has ${children.length} child pages`],
          suggestionKind: "summarizes",
          severity: "low",
          confidence: 0.6,
        }),
      );
    }
  }

  return Object.freeze(recommendations);
}
