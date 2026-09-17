import type { RelationshipKind } from "../models/index.js";
import type { DocumentationRelationship } from "../models/index.js";
import type { LearningAudience, ReaderStage } from "../models/index.js";
import type { KnowledgeGraph } from "../../graph/models/index.js";
import type { Example } from "../../examples/models/index.js";

/** A documentation page descriptor consumed by resolvers. */
export interface PageDescriptor {
  /** Unique page slug. */
  readonly slug: string;
  /** Page title. */
  readonly title: string;
  /** Project-relative source path. */
  readonly path: string;
  /** Raw page content (for link detection). */
  readonly content?: string;
  /** Symbols documented or referenced by the page. */
  readonly symbols?: readonly string[];
  /** Packages documented or referenced by the page. */
  readonly packages?: readonly string[];
  /** Concepts the page covers. */
  readonly concepts?: readonly string[];
  /** Workflows the page covers. */
  readonly workflows?: readonly string[];
  /** Configuration files or keys the page covers. */
  readonly configuration?: readonly string[];
  /** Reader progression stage the page serves. */
  readonly stage?: ReaderStage;
  /** Learning audience the page targets. */
  readonly audience?: LearningAudience;
  /** Page purpose. */
  readonly kind?:
    | "guide"
    | "reference"
    | "example"
    | "concept"
    | "troubleshooting"
    | "faq"
    | "overview"
    | "cli"
    | "configuration";
}

/** Evidence available to relationship resolvers. */
export interface RelationshipEvidence {
  /** The project knowledge graph, when available. */
  readonly graph?: KnowledgeGraph;
  /** Extracted examples, when available. */
  readonly examples?: readonly Example[];
}

/** Input handed to every {@link RelationshipResolver}. */
export interface RelationshipResolutionInput {
  readonly pages: readonly PageDescriptor[];
  readonly evidence?: RelationshipEvidence;
}

/**
 * A plugin that derives documentation relationships of specific kinds from
 * project evidence. Resolvers never invent relationships: every result must
 * carry evidence and a confidence score.
 */
export interface RelationshipResolver {
  /** Unique resolver id. */
  readonly id: string;
  /** Human-readable name. */
  readonly name: string;
  /** The relationship kinds this resolver produces. */
  readonly kinds: readonly RelationshipKind[];
  resolve(input: RelationshipResolutionInput): readonly DocumentationRelationship[];
}
