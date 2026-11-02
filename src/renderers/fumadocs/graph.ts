/**
 * Documentation Graph Data (Phase 23).
 *
 * Derives the site graph strictly from the Documentation IR: page nodes from
 * IR pages, symbol nodes from ApiSignature custom blocks, edges from IR
 * references plus page→symbol ownership. No invented relationships.
 */

import type { DocumentationIR } from "../../documentation/compiler/ir.js";

export interface GraphNode {
  readonly id: string;
  readonly label: string;
  readonly kind: "page" | "symbol";
  readonly url?: string;
  readonly symbolKind?: string;
}

export interface GraphEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: string;
}

export interface GraphData {
  readonly version: 1;
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

/** Build graph data from IR pages, blocks and references. Pure. */
export function buildGraphData(ir: DocumentationIR): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  const addNode = (node: GraphNode): void => {
    if (seen.has(node.id)) return;
    seen.add(node.id);
    nodes.push(node);
  };

  for (const page of ir.pages) {
    addNode({ id: `page:${page.slug}`, label: page.title, kind: "page", url: `/${page.slug}` });
    for (const block of page.blocks) {
      if (block.kind !== "custom" || block.component !== "ApiSignature") continue;
      const props = (block.props ?? {}) as Record<string, unknown>;
      const name = String(props["name"] ?? "");
      if (name.length === 0) continue;
      const symbolId = `symbol:${page.slug}#${name}`;
      addNode({
        id: symbolId,
        label: name,
        kind: "symbol",
        url: `/${page.slug}`,
        symbolKind: String(props["kind"] ?? "unknown"),
      });
      edges.push({ from: `page:${page.slug}`, to: symbolId, kind: "belongs-to" });
    }
    for (const ref of page.references) {
      if (ref.targetSlug === undefined) continue;
      const target = ir.pages.find((p) => p.slug === ref.targetSlug);
      if (target === undefined) continue;
      edges.push({
        from: `page:${page.slug}`,
        to: `page:${ref.targetSlug}`,
        kind: ref.relationship ?? "related",
      });
    }
  }

  return { version: 1, nodes, edges };
}
