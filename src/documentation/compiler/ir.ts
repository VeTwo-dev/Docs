/**
 * Documentation IR (Intermediate Representation).
 *
 * The compiler's output contract. Renderer-independent — renderers transform
 * IR into Markdown, MDX, HTML, React, or PDF without the compiler knowing.
 * AI participates in producing IR blocks, never final markup.
 *
 * The IR is versioned (`schemaVersion`) to allow future migrations.
 */

import type { DocumentationRelationshipKind } from "./types.js";

/** Current IR schema version. */
export const IR_SCHEMA_VERSION = 1 as const;

/** A block of content inside a page. */
export type IRBlock =
  | { readonly kind: "heading"; readonly level: 1 | 2 | 3; readonly text: string }
  | { readonly kind: "paragraph"; readonly text: string }
  | {
      readonly kind: "code";
      readonly language: string;
      readonly code: string;
      readonly title?: string;
    }
  | { readonly kind: "list"; readonly ordered: boolean; readonly items: readonly string[] }
  | {
      readonly kind: "callout";
      readonly tone: "note" | "warning" | "deprecated" | "tip";
      readonly text: string;
    }
  | {
      readonly kind: "table";
      readonly headers: readonly string[];
      readonly rows: readonly string[][];
    }
  | {
      readonly kind: "image";
      readonly src: string;
      readonly alt: string;
      readonly title?: string;
    }
  | { readonly kind: "horizontal-rule" }
  /** Custom documentation component (MDX). Props are data, never executed
   * during analysis — components resolve only at render time. */
  | {
      readonly kind: "custom";
      readonly component: string;
      readonly props?: Readonly<Record<string, unknown>>;
    };

/** An example attached to a page or block. */
export interface IRExample {
  readonly id: string;
  readonly title: string;
  readonly language: string;
  readonly code: string;
  /** Provenance: extracted from project vs proposed by AI. */
  readonly provenance: "extracted" | "proposed" | "authored";
}

/** A claim requiring evidence grounding. */
export interface IRClaim {
  readonly text: string;
  readonly evidence: readonly { readonly kind: string; readonly value: string }[];
  readonly confidence: number;
  readonly validated: boolean;
}

/** A reference from one page/anchor to another target. */
export interface IRReference {
  readonly sourcePage: string;
  readonly targetSlug?: string;
  readonly anchor?: string;
  readonly relationship?: DocumentationRelationshipKind;
}

/** One page in the IR. */
export interface IRPage {
  readonly slug: string;
  readonly title: string;
  readonly sectionId: string;
  readonly description?: string;
  readonly blocks: readonly IRBlock[];
  readonly examples: readonly IRExample[];
  readonly claims: readonly IRClaim[];
  readonly references: readonly IRReference[];
  /** Content fingerprint for stability/incremental decisions. */
  readonly fingerprint: string;
  /** Who produced this page revision last. */
  readonly provenance: "compiler" | "ai" | "user" | "hybrid";
}

/** A section grouping pages. */
export interface IRSection {
  readonly id: string;
  readonly title: string;
  readonly pageSlugs: readonly string[];
}

/** Navigation metadata in the IR. */
export interface IRNavigation {
  readonly sidebar: readonly {
    readonly label: string;
    readonly slug?: string;
    readonly children?: readonly { label: string; slug: string }[];
  }[];
  /** Deterministic breadcrumb trail per page slug. */
  readonly breadcrumbs: Readonly<
    Record<string, readonly { readonly label: string; readonly slug?: string }[]>
  >;
}

/** The full versioned Documentation IR document. */
export interface DocumentationIR {
  readonly schemaVersion: typeof IR_SCHEMA_VERSION;
  readonly generatedAt: string;
  readonly sections: readonly IRSection[];
  readonly pages: readonly IRPage[];
  readonly navigation: IRNavigation;
}
