import type { RawExample } from "../extractors/index.js";
import type { ExampleType, ExampleClassificationFlags } from "../models/index.js";
import { isExampleType } from "../models/index.js";

/** The result of classifying a raw example. */
export interface ExampleClassification {
  readonly type: ExampleType;
  readonly flags: ExampleClassificationFlags;
  readonly framework?: string;
  /** Reason for the classification, for explainability. */
  readonly reasons: readonly string[];
}

/** Classify a {@link RawExample} into a typed, flagged {@link Example}. */
export function classifyRawExample(raw: RawExample): ExampleClassification {
  const reasons: string[] = [];
  const type = resolveType(raw, reasons);
  const flags = resolveFlags(raw, reasons);
  const framework = resolveFramework(raw, reasons);

  const result: ExampleClassification = {
    type,
    flags,
    reasons: Object.freeze(reasons),
  };
  if (framework !== undefined) return Object.freeze({ ...result, framework });
  return Object.freeze(result);
}

/** Resolve the example type from a hint and/or provenance evidence. */
function resolveType(raw: RawExample, reasons: string[]): ExampleType {
  if (raw.typeHint !== undefined && isExampleType(raw.typeHint)) {
    reasons.push(`extractor hint: ${raw.typeHint}`);
    return raw.typeHint;
  }
  if (raw.provenance.kind === "tests") {
    reasons.push("provenance kind is tests");
    return "test";
  }
  if (raw.provenance.kind === "storybook" || raw.provenance.kind === "playground") {
    reasons.push(`provenance kind is ${raw.provenance.kind}`);
    return "demo";
  }
  if (raw.provenance.kind === "fixtures") {
    reasons.push("provenance kind is fixtures");
    return "fixture";
  }
  if (raw.provenance.kind === "configuration") {
    reasons.push("provenance kind is configuration");
    return "configuration";
  }
  if (raw.provenance.kind === "examples") {
    reasons.push("provenance kind is examples directory");
    return "demo";
  }
  reasons.push("defaulting to snippet");
  return "snippet";
}

/** Derive user-facing / production-like / internal-only flags. */
function resolveFlags(raw: RawExample, reasons: string[]): ExampleClassificationFlags {
  const internalOnly = raw.provenance.kind === "tests" || raw.provenance.kind === "fixtures";
  const productionLike = raw.provenance.kind === "examples" || raw.provenance.kind === "source";
  const userFacing = raw.provenance.kind === "readme" || raw.provenance.kind === "docs";
  if (internalOnly) reasons.push("internal-only provenance (tests/fixtures)");
  if (productionLike) reasons.push("production-like provenance");
  if (userFacing) reasons.push("user-facing provenance");
  return Object.freeze({ userFacing, productionLike, internalOnly });
}

/** Detect a framework from explicit hints and package references. */
function resolveFramework(raw: RawExample, reasons: string[]): string | undefined {
  if (raw.framework !== undefined) {
    reasons.push(`explicit framework: ${raw.framework}`);
    return raw.framework;
  }
  const packages = raw.referencedPackages ?? [];
  const matches = packages.filter((pkg) =>
    KNOWN_FRAMEWORKS.some((fw) => pkg === fw || pkg.startsWith(`${fw}/`)),
  );
  if (matches.length > 0) {
    reasons.push(`framework packages: ${matches.join(", ")}`);
    return matches[0]!;
  }
  return undefined;
}

/** Package prefixes that identify a framework. */
const KNOWN_FRAMEWORKS: readonly string[] = [
  "react",
  "react-dom",
  "vue",
  "@angular",
  "svelte",
  "@sveltejs",
  "next",
  "nuxt",
  "astro",
  "@astrojs",
  "ember",
  "backbone",
];
