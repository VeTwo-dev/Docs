import type { RawExample } from "../extractors/index.js";
import type { KnowledgeGraph } from "../../graph/models/index.js";
import { detectSymbols, detectPackages } from "../normalizers/index.js";

/** Evidence sources available to enrich examples. */
export interface EvidenceSource {
  /** Symbol names that exist in the project. */
  readonly knownSymbols?: readonly string[];
  /** Package names that are project dependencies. */
  readonly knownPackages?: readonly string[];
  /** The project knowledge graph, when available. */
  readonly graph?: KnowledgeGraph;
}

/** Collected evidence attached to an example. */
export interface ExampleEvidence {
  readonly referencedSymbols: readonly string[];
  readonly referencedPackages: readonly string[];
  readonly referencedConfiguration: readonly string[];
  readonly referencedConcepts: readonly string[];
  readonly referencedWorkflows: readonly string[];
  readonly linkedNodes: readonly string[];
  readonly linkedPages: readonly string[];
}

/**
 * Collects evidence for a raw example by linking its body to the existing
 * scanner / symbols / references / knowledge-graph layers.
 *
 * The evidence collector is a thin adapter: it never re-scans source; it
 * only matches extracted bodies against evidence already provided by the
 * rest of the pipeline.
 */
export function collectExampleEvidence(raw: RawExample, source: EvidenceSource): ExampleEvidence {
  const symbols = detectSymbols(raw.content, source.knownSymbols);
  const packages = detectPackages(raw.content, source.knownPackages);
  const linkedNodes = source.graph ? linkGraphNodes(raw, source.graph) : [];
  const combinedSymbols = mergeUnique(symbols, raw.referencedSymbols);
  const combinedPackages = mergeUnique(packages, raw.referencedPackages);

  return Object.freeze({
    referencedSymbols: combinedSymbols,
    referencedPackages: combinedPackages,
    referencedConfiguration: Object.freeze([...(raw.referencedConfiguration ?? [])]),
    referencedConcepts: Object.freeze([...(raw.referencedConcepts ?? [])]),
    referencedWorkflows: Object.freeze([...(raw.referencedWorkflows ?? [])]),
    linkedNodes,
    linkedPages: Object.freeze([]),
  });
}

/** Find knowledge-graph nodes matching symbols/packages in an example body. */
function linkGraphNodes(raw: RawExample, graph: KnowledgeGraph): readonly string[] {
  const linked: string[] = [];
  for (const node of graph.nodes.values()) {
    if (node.label === undefined) continue;
    const escaped = node.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`).test(raw.content)) {
      linked.push(node.id);
    }
  }
  return Object.freeze(linked);
}

function mergeUnique(a: readonly string[], b: readonly string[] | undefined): readonly string[] {
  const set = new Set(a);
  for (const item of b ?? []) set.add(item);
  return Object.freeze([...set].sort());
}
