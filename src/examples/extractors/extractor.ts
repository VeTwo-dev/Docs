import type { ExampleProvenanceKind, ExampleType } from "../models/index.js";
import type { ExampleProvenance, ExampleLocation } from "../models/index.js";

/** A raw, unclassified example produced by an extractor. */
export interface RawExample {
  /** Short human-readable title. */
  readonly title: string;
  /** Language of the body. */
  readonly language: string;
  /** The extracted source text. */
  readonly content: string;
  /** Where the example was found. */
  readonly provenance: ExampleProvenance;
  /** Nearby explanation, when available. */
  readonly description?: string;
  /** A type hint the extractor can assert (classifier may override). */
  readonly typeHint?: ExampleType;
  /** Symbol names referenced by the example. */
  readonly referencedSymbols?: readonly string[];
  /** Package names referenced by the example. */
  readonly referencedPackages?: readonly string[];
  /** Configuration references. */
  readonly referencedConfiguration?: readonly string[];
  /** Concept references. */
  readonly referencedConcepts?: readonly string[];
  /** Workflow references. */
  readonly referencedWorkflows?: readonly string[];
  /** Detected framework, when applicable. */
  readonly framework?: string;
  /** Extraction confidence (0..1). */
  readonly confidence?: number;
}

/** Input handed to every {@link ExampleExtractor}. */
export interface ExampleExtractionInput {
  /** Project-relative path of the file being scanned. */
  readonly path: string;
  /** Full file content. */
  readonly content: string;
  /** Known symbol names, used to detect referenced symbols. */
  readonly knownSymbols?: readonly string[];
  /** Known package names, used to detect referenced packages. */
  readonly knownPackages?: readonly string[];
  /** Line offset (1-based) of `content` within the file, for provenance. */
  readonly lineOffset?: number;
}

/**
 * A plugin that extracts {@link RawExample}s from a specific kind of project
 * evidence. Extractors are renderer-independent and never execute project
 * code.
 */
export interface ExampleExtractor {
  /** Unique extractor id. */
  readonly id: string;
  /** Human-readable name. */
  readonly name: string;
  /** The provenance kinds this extractor produces. */
  readonly provenanceKinds: readonly ExampleProvenanceKind[];
  /** Whether this extractor can scan the given path. */
  supports(path: string, content?: string): boolean;
  /** Extract raw examples from a file. */
  extract(input: ExampleExtractionInput): readonly RawExample[];
}

/** Convenience: build an {@link ExampleProvenance} inside an extractor. */
export function provenance(
  kind: ExampleProvenanceKind,
  source: string,
  location?: ExampleLocation,
  context?: string,
): ExampleProvenance {
  return Object.freeze({
    kind,
    source,
    ...(context !== undefined ? { context } : {}),
    ...(location !== undefined ? { location: Object.freeze({ ...location }) } : {}),
  });
}
