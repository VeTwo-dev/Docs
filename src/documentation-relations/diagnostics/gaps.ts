import type { PageDescriptor } from "../resolvers/index.js";
import type { DocumentationRelationship } from "../models/index.js";
import { createRelationshipGraph } from "../graph/index.js";

/** A gap finding: a page that is orphaned or under-connected. */
export interface RelationshipGapFinding {
  readonly page: string;
  readonly kind: "orphan" | "underconnected" | "dead-end";
  readonly incoming: number;
  readonly outgoing: number;
  readonly evidence: readonly string[];
}

/**
 * Reports documentation gaps: pages with no relationships (orphans),
 * pages with only one direction of connection (dead-ends), and pages with
 * very few links (under-connected).
 */
export function detectRelationshipGaps(
  pages: readonly PageDescriptor[],
  relationships: readonly DocumentationRelationship[],
  minConnections = 2,
): readonly RelationshipGapFinding[] {
  const graph = createRelationshipGraph(relationships);
  const findings: RelationshipGapFinding[] = [];

  for (const page of pages) {
    const incoming = graph.incoming(page.slug).length;
    const outgoing = graph.outgoing(page.slug).length;
    const total = incoming + outgoing;

    if (total === 0) {
      findings.push({
        page: page.slug,
        kind: "orphan",
        incoming: 0,
        outgoing: 0,
        evidence: [`page "${page.slug}" has no incoming or outgoing relationships`],
      });
      continue;
    }
    if (incoming === 0 || outgoing === 0) {
      findings.push({
        page: page.slug,
        kind: "dead-end",
        incoming,
        outgoing,
        evidence: [
          `page "${page.slug}" has ${incoming} incoming but ${outgoing} outgoing relationships`,
        ],
      });
      continue;
    }
    if (total < minConnections) {
      findings.push({
        page: page.slug,
        kind: "underconnected",
        incoming,
        outgoing,
        evidence: [`page "${page.slug}" has only ${total} relationships`],
      });
    }
  }

  return Object.freeze(findings);
}
