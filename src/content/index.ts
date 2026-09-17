/**
 * Content Authoring & Safe Documentation Composition.
 *
 * Combines generated knowledge, AI-generated content and user-authored
 * Markdown/MDX into the final Documentation IR — with ownership,
 * provenance, conflict detection and safe regeneration.
 */

// ─── Types ───────────────────────────────────────────────────────────────
export type {
  DocumentationContentOwnership,
  AIContentReviewStatus,
  ContentProvenance,
  PageFrontmatter,
  AuthoredDocument,
  LockRegion,
  ComponentUsage,
  PageOverride,
  OverrideMap,
  CompositionResult,
  RegenerationAction,
  RegenerationPlanEntry,
  TranslationOwnership,
  SnippetUsageKind,
} from "./types.js";

// ─── Parsers ─────────────────────────────────────────────────────────────
export { parseFrontmatter, extractLocks, parseMarkdown } from "./parser/markdown.js";
export { parseMdx, extractAttributes } from "./parser/mdx.js";
export type { MdxParseResult } from "./parser/mdx.js";

// ─── Components ──────────────────────────────────────────────────────────
export type {
  DocumentationComponentMetadata,
  DocumentationComponentRegistry,
  RegisteredComponent,
} from "./components/registry.js";
export { createComponentRegistry } from "./components/registry.js";

// ─── Fingerprints ────────────────────────────────────────────────────────
export { fingerprintBlock, fingerprintBlocks } from "./fingerprint.js";

// ─── Overrides ───────────────────────────────────────────────────────────
export { applyOverride, hideSections } from "./overrides.js";
export type { OverrideTarget } from "./overrides.js";

// ─── Composition ─────────────────────────────────────────────────────────
export { composePage, threeWayMerge, describeBlock } from "./composition/engine.js";
export type { ContentLayer, ComposePageInput } from "./composition/engine.js";

// ─── Semantic diff ───────────────────────────────────────────────────────
export { semanticDiff } from "./semantic-diff.js";
export type { SemanticChange } from "./semantic-diff.js";

// ─── Snippets ────────────────────────────────────────────────────────────
export { expandSnippets, createFileSnippetResolver } from "./snippets.js";
export type { SnippetExpansion, SnippetReference } from "./snippets.js";

// ─── Links ───────────────────────────────────────────────────────────────
export type { LinkGraph, ContentLink, LinkResolution, RedirectEntry } from "./links.js";
export {
  extractContentLinks,
  resolveContentLinks,
  linkDiagnostics,
  buildRedirects,
} from "./links.js";

// ─── Internationalization ────────────────────────────────────────────────
export type { LocalizedPage } from "./i18n.js";
export {
  isTranslationStale,
  translationDiagnostics,
  localeOfPath,
  DEFAULT_LOCALE,
} from "./i18n.js";

// ─── Ownership manifest & regeneration ───────────────────────────────────
export type {
  OwnedFileEntry,
  ContentOwnershipManifest,
  OwnershipAudit,
  RegenerationCandidate,
  RegenerationPlan,
} from "./manifest.js";
export {
  createOwnershipManifest,
  hashContent,
  auditOwnership,
  planRegeneration,
} from "./manifest.js";

// ─── Linting ─────────────────────────────────────────────────────────────
export { lintContent, KNOWN_CODE_LANGUAGES, slugifyHeading } from "./lint.js";

// ─── Safe regeneration pipeline ──────────────────────────────────────────
export type {
  ContentRegenerationOptions,
  RegenerationResult,
} from "./regenerate.js";
export { runContentRegeneration, serializeComposed } from "./regenerate.js";

// ─── Health summary (dev mode) ───────────────────────────────────────────
export { summarizeContentHealth } from "./health.js";
export type { ContentHealthSummary } from "./health.js";

// ─── CLI ─────────────────────────────────────────────────────────────────
export { registerContentCommands, loadAuthoredDocuments } from "./cli.js";
