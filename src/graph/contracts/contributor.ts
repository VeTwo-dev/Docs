import type { Symbol, ModuleSymbol } from "../../symbols/index.js";
import type { Reference } from "../../references/index.js";
import type { KnowledgeNode, KnowledgeNodeKind } from "../models/node.js";
import type { KnowledgeEdge, KnowledgeEdgeKind } from "../models/edge.js";

/** The node/edge kinds a {@link GraphContributor} may emit. */
export interface GraphContributorCapabilities {
  readonly nodeKinds: readonly KnowledgeNodeKind[];
  readonly edgeKinds: readonly KnowledgeEdgeKind[];
}

/** The input handed to every contributor during a build. */
export interface GraphBuildContext {
  readonly rootDir: string;
  /** The caller-supplied request id, when given. */
  readonly requestId?: string;
  /** Every symbol by id (project, packages, modules and declarations). */
  readonly symbols: ReadonlyMap<string, Symbol>;
  /** Module symbols keyed by file. */
  readonly modules: ReadonlyMap<string, ModuleSymbol>;
  /** The resolved references recovered by the reference layer. */
  readonly references: readonly Reference[];
}

/** What a contributor adds to the graph. */
export interface GraphContribution {
  readonly nodes: readonly KnowledgeNode[];
  readonly edges: readonly KnowledgeEdge[];
}

/** Metadata describing a {@link GraphContributor}. */
export interface GraphContributorMetadata {
  readonly name?: string;
  readonly description?: string;
}

/**
 * The universal knowledge-graph contributor contract.
 *
 * A contributor derives a slice of the knowledge graph from the symbol and
 * reference layers. Contributors never own state: they receive the build
 * context and return frozen nodes and edges.
 */
export interface GraphContributor {
  /** The unique contributor id (e.g. `structural`, `references`). */
  readonly id: string;
  readonly metadata: GraphContributorMetadata;
  readonly capabilities: GraphContributorCapabilities;
  readonly contributes: (context: GraphBuildContext) => GraphContribution;
}

/** Configuration for {@link createGraphContributor}. */
export interface GraphContributorConfig {
  readonly id: string;
  readonly metadata?: GraphContributorMetadata;
  readonly capabilities: GraphContributorCapabilities;
  readonly contributes: (context: GraphBuildContext) => GraphContribution;
}

/** Builds a frozen {@link GraphContributor}. */
export function createGraphContributor(config: GraphContributorConfig): GraphContributor {
  return Object.freeze({
    id: config.id,
    metadata: Object.freeze({ ...config.metadata }),
    capabilities: Object.freeze({
      nodeKinds: Object.freeze([...config.capabilities.nodeKinds]),
      edgeKinds: Object.freeze([...config.capabilities.edgeKinds]),
    }),
    contributes: config.contributes,
  });
}
