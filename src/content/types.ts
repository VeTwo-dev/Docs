/**
 * Content Authoring Types.
 *
 * Ownership, provenance and metadata for documentation content.
 * The core principle: generated content is never disposable output —
 * every artifact carries ownership so regeneration is always safe.
 */

import type { AIEvidenceReference } from "../ai/types.js";
import type { IRBlock } from "../documentation/compiler/ir.js";
import type { DocumentationDiagnostic } from "../documentation/compiler/diagnostics.js";

/** ─── Ownership ─────────────────────────────────────────────────────── */

/** Who owns a piece of documentation content. */
export type DocumentationContentOwnership =
  "generated" | "ai-generated" | "user-authored" | "mixed" | "protected" | "derived";

/** Lifecycle/review status of AI-proposed content. */
export type AIContentReviewStatus = "draft" | "generated" | "validated" | "approved" | "rejected";

/** ─── Provenance ────────────────────────────────────────────────────── */

/** Where a content artifact came from. */
export interface ContentProvenance {
  readonly source: "source-code" | "ai" | "user" | "compiler";
  /** Evidence grounding this content in the project (symbols, files…). */
  readonly sourceReferences: readonly AIEvidenceReference[];
  readonly generatedAt?: string;
  readonly generatorVersion?: string;
  /** AI provider/model when source === "ai". */
  readonly provider?: string;
  readonly model?: string;
  /** Content fingerprint for change detection. */
  readonly fingerprint?: string;
}

/** ─── Frontmatter ───────────────────────────────────────────────────── */

/** Parsed frontmatter of an authored page. */
export interface PageFrontmatter {
  readonly title?: string;
  readonly description?: string;
  readonly sidebar?: {
    readonly order?: number;
    readonly hidden?: boolean;
    readonly label?: string;
  };
  /** This page must never be regenerated automatically. */
  readonly protected?: boolean;
  /** Alternative URLs that should redirect to this page. */
  readonly aliases?: readonly string[];
  /** Locale of this page ("en" default). */
  readonly locale?: string;
  /** Project-specific metadata, kept out of core types. */
  readonly custom?: Readonly<Record<string, unknown>>;
  /** Unknown fields are preserved here (validated separately). */
  readonly unknown?: Readonly<Record<string, unknown>>;
}

/** ─── Authored documents ────────────────────────────────────────────── */

/** An authored Markdown/MDX document parsed into IR-compatible blocks. */
export interface AuthoredDocument {
  /** Path relative to the content directory. */
  readonly path: string;
  /** Slug derived from path or frontmatter. */
  readonly slug: string;
  readonly frontmatter: PageFrontmatter;
  readonly blocks: readonly {
    index: number;
    block: IRBlock;
    ownership: DocumentationContentOwnership;
  }[];
  /** Locked regions that must never be regenerated. */
  readonly locks: readonly LockRegion[];
  readonly provenance: ContentProvenance;
  /** MDX components referenced by this document. */
  readonly componentUsages: readonly ComponentUsage[];
}

/** A locked region inside a document. */
export interface LockRegion {
  /** Byte offsets into the original source. */
  readonly start: number;
  readonly end: number;
  readonly reason?: string;
}

/** One custom-component usage found in MDX. */
export interface ComponentUsage {
  readonly name: string;
  /** Raw string props as written (not evaluated — safe mode). */
  readonly propsText: string;
  readonly hasChildren: boolean;
  readonly line: number;
}

/** ─── Overrides ─────────────────────────────────────────────────────── */

/** User overrides applied to a generated page. */
export interface PageOverride {
  readonly title?: string;
  readonly description?: string;
  /** Generated section headings to hide. */
  readonly hideSections?: readonly string[];
  /** Replace a specific generated block (matched by fingerprint prefix). */
  readonly replaceBlocks?: Readonly<Record<string, IRBlock>>;
  /** Blocks inserted before/after all generated content. */
  readonly before?: readonly IRBlock[];
  readonly after?: readonly IRBlock[];
}

/** Override map keyed by page slug. */
export type OverrideMap = Readonly<Record<string, PageOverride>>;

/** ─── Composition ───────────────────────────────────────────────────── */

/** Result of composing a single page from multiple sources. */
export interface CompositionResult {
  readonly slug: string;
  readonly title: string;
  readonly blocks: readonly {
    index: number;
    block: IRBlock;
    ownership: DocumentationContentOwnership;
  }[];
  readonly conflicts: readonly DocumentationDiagnostic[];
  readonly provenance: ContentProvenance;
}

/** ─── Regeneration planning ─────────────────────────────────────────── */

/** What safe regeneration intends to do with each page. */
export type RegenerationAction =
  "create" | "update" | "delete" | "preserve" | "conflict" | "review";

/** Plan produced by a dry-run regeneration. */
export interface RegenerationPlanEntry {
  readonly slug: string;
  readonly action: RegenerationAction;
  /** Why this action was chosen. */
  readonly reason: string;
}

/** ─── Localization ──────────────────────────────────────────────────── */

/** Ownership of a localized translation. */
export type TranslationOwnership = "user-authored" | "ai-translated" | "generated" | "stale";

/** ─── Snippets ──────────────────────────────────────────────────────── */

/** How a snippet is consumed. */
export type SnippetUsageKind = "include" | "reference" | "parameterized";

// Re-export for convenience of downstream consumers.
export type { DocumentationDiagnostic };
