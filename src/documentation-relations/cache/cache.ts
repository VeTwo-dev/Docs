import { hashString } from "../../examples/shared/index.js";
import type { DocumentationRelationship } from "../models/index.js";

/** A cached relationship derivation for one page. */
export interface CachedPageRelationships {
  readonly contentHash: string;
  readonly relationships: readonly DocumentationRelationship[];
}

/**
 * Incremental relationship cache keyed by `(pageSlug, contentHash)`.
 * Unchanged pages skip re-resolution on subsequent runs.
 */
export interface RelationshipCache {
  get(slug: string, contentHashValue: string): readonly DocumentationRelationship[] | undefined;
  set(
    slug: string,
    contentHashValue: string,
    relationships: readonly DocumentationRelationship[],
  ): void;
  isFresh(slug: string, contentHashValue: string): boolean;
  clear(): void;
  readonly size: number;
}

/** Content hash for a page descriptor. */
export function pageContentHash(content: string): string {
  return hashString(content);
}

/** Creates a new in-memory {@link RelationshipCache}. */
export function createRelationshipCache(): RelationshipCache {
  const store = new Map<string, CachedPageRelationships>();

  return {
    get size(): number {
      return store.size;
    },

    get(slug: string, contentHashValue: string): readonly DocumentationRelationship[] | undefined {
      const entry = store.get(slug);
      if (entry === undefined || entry.contentHash !== contentHashValue) return undefined;
      return entry.relationships;
    },

    set(
      slug: string,
      contentHashValue: string,
      relationships: readonly DocumentationRelationship[],
    ): void {
      store.set(slug, {
        contentHash: contentHashValue,
        relationships: Object.freeze([...relationships]),
      });
    },

    isFresh(slug: string, contentHashValue: string): boolean {
      const entry = store.get(slug);
      return entry !== undefined && entry.contentHash === contentHashValue;
    },

    clear(): void {
      store.clear();
    },
  };
}
