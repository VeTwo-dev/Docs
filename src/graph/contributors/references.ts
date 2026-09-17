import type { Reference } from "../../references/index.js";
import type { GraphBuildContext, GraphContribution, GraphContributor } from "../contracts/index.js";
import { createKnowledgeEdge, type KnowledgeEdge, type KnowledgeEdgeKind } from "../models/edge.js";

/**
 * The built-in reference contributor.
 *
 * Turns the resolved references recovered by the reference layer into
 * knowledge edges. Unresolved references carry no target node and are
 * therefore excluded from the edge set — the engine still counts them in the
 * statistics. Repeated references between the same pair collapse into one
 * edge via the deterministic edge id.
 */
export const referencesContributor: GraphContributor = {
  id: "references",
  metadata: {
    name: "Reference contributor",
    description: "Resolved import/export/heritage edges from the reference layer.",
  },
  capabilities: {
    nodeKinds: [],
    edgeKinds: ["imports", "imports-name", "exports", "re-exports", "references"],
  },
  contributes(context: GraphBuildContext): GraphContribution {
    const edges: KnowledgeEdge[] = [];
    const seen = new Set<string>();

    for (const reference of context.references) {
      if (reference.toId === undefined) continue;
      const from = context.symbols.get(reference.fromId);
      const to = context.symbols.get(reference.toId);
      if (from === undefined || to === undefined) continue;
      const kind = edgeKindFor(reference);
      if (kind === undefined) continue;
      const edge = createKnowledgeEdge({
        from: from.id,
        to: to.id,
        kind,
        ...(reference.specifier !== undefined ? { label: reference.specifier } : {}),
        ...(reference.name !== undefined ? { label: reference.name } : {}),
        referenceId: reference.id,
      });
      if (seen.has(edge.id)) continue;
      seen.add(edge.id);
      edges.push(edge);
    }

    return { nodes: [], edges };
  },
};

function edgeKindFor(reference: Reference): KnowledgeEdgeKind | undefined {
  switch (reference.kind) {
    case "import":
      return "imports";
    case "import-name":
      return "imports-name";
    case "export":
      return "exports";
    case "re-export":
      return "re-exports";
    case "heritage":
    case "type-use":
      return "references";
    default:
      return undefined;
  }
}
