import type { Symbol } from "../../symbols/index.js";
import type { GraphBuildContext, GraphContribution, GraphContributor } from "../contracts/index.js";
import { createKnowledgeEdge, type KnowledgeEdge } from "../models/edge.js";
import { createKnowledgeNode, type KnowledgeNode, type KnowledgeNodeKind } from "../models/node.js";

/**
 * The built-in structural contributor.
 *
 * Adds one node per symbol (project/package/module collapsed onto their real
 * kinds, everything else a `symbol` node) plus the `owns` hierarchy edges and
 * `declared-in` file edges. Ids are the symbol ids, so the graph and the
 * symbol store address the same things.
 */
export const structuralContributor: GraphContributor = {
  id: "structural",
  metadata: {
    name: "Structural contributor",
    description: "Symbol hierarchy, ownership and declared-in file edges.",
  },
  capabilities: {
    nodeKinds: ["project", "package", "module", "symbol"],
    edgeKinds: ["owns", "declared-in"],
  },
  contributes(context: GraphBuildContext): GraphContribution {
    const nodes: KnowledgeNode[] = [];
    const edges: KnowledgeEdge[] = [];
    const modulesByFile = new Map<string, string>();

    for (const symbol of context.symbols.values()) {
      if (symbol.kind === "module") {
        const file = symbol.metadata.location.file;
        if (file.length > 0) modulesByFile.set(file, symbol.id);
      }
    }

    for (const symbol of context.symbols.values()) {
      nodes.push(toNode(symbol));
    }

    for (const symbol of context.symbols.values()) {
      if (symbol.parentId !== undefined) {
        const parent = context.symbols.get(symbol.parentId);
        if (parent !== undefined) {
          edges.push(createKnowledgeEdge({ from: parent.id, to: symbol.id, kind: "owns" }));
        }
      }
      const file = symbol.metadata.location.file;
      const moduleId = file.length > 0 ? modulesByFile.get(file) : undefined;
      if (moduleId !== undefined && moduleId !== symbol.id) {
        edges.push(createKnowledgeEdge({ from: symbol.id, to: moduleId, kind: "declared-in" }));
      }
    }

    return { nodes, edges };
  },
};

function toNode(symbol: Symbol): KnowledgeNode {
  const kind = toNodeKind(symbol.kind);
  return createKnowledgeNode({
    id: symbol.id,
    kind,
    label: symbol.name,
    ...(symbol.metadata.location.file.length > 0 ? { file: symbol.metadata.location.file } : {}),
    ...(symbol.metadata.qualifiedName.length > 0 ? { detail: symbol.metadata.qualifiedName } : {}),
    ...(kind === "symbol" ? { symbolKind: symbol.kind } : {}),
  });
}

function toNodeKind(symbolKind: Symbol["kind"]): KnowledgeNodeKind {
  if (symbolKind === "project") return "project";
  if (symbolKind === "package") return "package";
  if (symbolKind === "module") return "module";
  return "symbol";
}
