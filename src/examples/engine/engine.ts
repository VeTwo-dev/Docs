import type { ExampleExtractorRegistry } from "../registry/registry.js";
import type { ExampleExtractionInput } from "../extractors/index.js";
import type { Example, ExampleGap, DuplicateGroup } from "../models/index.js";
import type { ExampleCache } from "../cache/index.js";
import type { EvidenceSource } from "../evidence/index.js";
import type { ExampleDiagnostics } from "../diagnostics/index.js";
import type { CurrentState, GapCandidate } from "../diagnostics/index.js";
import { createExample } from "../models/index.js";
import { createExampleCache, contentHash } from "../cache/index.js";
import { collectExampleEvidence } from "../evidence/index.js";
import { classifyRawExample } from "../classifiers/index.js";
import { validateExampleContent } from "../validators/index.js";
import { scoreExample } from "../scoring/index.js";
import { groupDuplicates } from "../models/index.js";
import {
  detectStaleExamples,
  detectExampleGaps,
  buildExampleDiagnostics,
} from "../diagnostics/index.js";

/** A project file handed to the example engine. */
export interface ProjectFile {
  /** Project-relative path. */
  readonly path: string;
  /** Full file content. */
  readonly content: string;
}

/** Options for {@link extractExamples}. */
export interface ExampleEngineOptions {
  /** Evidence sources for linking examples (symbols, packages, graph). */
  readonly evidence?: EvidenceSource;
  /** Current project state for stale detection. */
  readonly currentState?: CurrentState;
  /** User-facing nodes that may need examples (gap detection). */
  readonly gapCandidates?: readonly GapCandidate[];
  /** Whether to run duplicate/gap/stale diagnostics. Default true. */
  readonly diagnostics?: boolean;
  /** An external cache; a fresh one is created when omitted. */
  readonly cache?: ExampleCache;
}

/** The result of an example extraction run. */
export interface ExampleExtractionResult {
  /** All extracted, classified, validated and scored examples. */
  readonly examples: readonly Example[];
  /** Documentation gaps (recommendations only). */
  readonly gaps: readonly ExampleGap[];
  /** Duplicate groups (never deleted, only reported). */
  readonly duplicateGroups: readonly DuplicateGroup[];
  /** Diagnostics report. */
  readonly diagnostics: ExampleDiagnostics;
  /** Extraction statistics. */
  readonly stats: Readonly<{
    readonly filesScanned: number;
    readonly filesExtractedFromCache: number;
    readonly rawExtracted: number;
    readonly examples: number;
    readonly invalid: number;
  }>;
}

/**
 * The universal example extraction engine.
 *
 * Pipeline: extract (via the extractor registry, cached) → classify →
 * enrich with evidence → validate (static checks only) → score →
 * diagnostics (stale / duplicates / gaps).
 *
 * The engine never executes project code and never writes files.
 */
export function extractExamples(
  files: readonly ProjectFile[],
  registry: ExampleExtractorRegistry,
  options: ExampleEngineOptions = {},
): ExampleExtractionResult {
  const cache = options.cache ?? createExampleCache();
  const evidence = options.evidence ?? {};

  const examples: Example[] = [];
  let filesScanned = 0;
  let filesExtractedFromCache = 0;
  let rawExtracted = 0;

  for (const file of files) {
    filesScanned += 1;
    const hash = contentHash(file.content);
    let rawExamples = cache.get(file.path, hash);
    if (rawExamples === undefined) {
      const input: ExampleExtractionInput = {
        path: file.path,
        content: file.content,
        knownSymbols: evidence.knownSymbols,
        knownPackages: evidence.knownPackages,
      };
      rawExamples = registry.extract(input);
      cache.set(file.path, hash, rawExamples);
    } else {
      filesExtractedFromCache += 1;
    }

    for (const raw of rawExamples) {
      rawExtracted += 1;
      const classification = classifyRawExample(raw);
      const collected = collectExampleEvidence(raw, evidence);
      const validation = validateExampleContent(raw.content, raw.language);
      const example = createExample({
        title: raw.title,
        type: classification.type,
        language: raw.language,
        framework: classification.framework,
        provenance: raw.provenance,
        content: raw.content,
        description: raw.description,
        referencedSymbols: collected.referencedSymbols,
        referencedPackages: collected.referencedPackages,
        referencedConfiguration: collected.referencedConfiguration,
        referencedConcepts: collected.referencedConcepts,
        referencedWorkflows: collected.referencedWorkflows,
        confidence: raw.confidence ?? 0.7,
        validation: validation.status,
        classification: classification.flags,
        linkedNodes: collected.linkedNodes,
        linkedPages: collected.linkedPages,
      });
      const scored = scoreExample(example);
      examples.push(
        createExample({
          ...example,
          importance: scored.importance,
          confidence: scored.confidence,
        }),
      );
    }
  }

  const staleFindings = options.currentState
    ? detectStaleExamples(examples, options.currentState)
    : [];

  // Apply stale status without removing examples.
  for (const finding of staleFindings) {
    const index = examples.findIndex((example) => example.id === finding.exampleId);
    if (index === -1) continue;
    const example = examples[index]!;
    examples[index] = createExample({
      ...example,
      validation: "stale",
    });
  }

  let duplicateGroups: readonly DuplicateGroup[] = [];
  let gaps: readonly ExampleGap[] = [];
  if (options.diagnostics !== false) {
    duplicateGroups = groupDuplicates(examples, (example) => scoreExample(example).importance);
    if (options.gapCandidates !== undefined) {
      gaps = detectExampleGaps(examples, options.gapCandidates);
    }
  }

  const diagnostics = buildExampleDiagnostics({
    examples,
    duplicateGroups,
    gaps,
    staleFindings,
  });

  return Object.freeze({
    examples: Object.freeze(examples),
    gaps,
    duplicateGroups,
    diagnostics,
    stats: Object.freeze({
      filesScanned,
      filesExtractedFromCache,
      rawExtracted,
      examples: examples.length,
      invalid: examples.filter((example) => example.validation === "invalid").length,
    }),
  });
}
