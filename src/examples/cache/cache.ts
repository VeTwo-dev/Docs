import { hashString } from "../shared/hash.js";
import type { RawExample } from "../extractors/index.js";

/** A cached extraction result for one file. */
export interface CachedFileExtraction {
  /** Hash of the file content that produced this result. */
  readonly contentHash: string;
  readonly examples: readonly RawExample[];
}

/**
 * Incremental extraction cache keyed by `(path, contentHash)`.
 *
 * Unchanged files skip re-extraction on subsequent runs, keeping
 * regeneration incremental without sacrificing correctness: any content
 * change invalidates the entry.
 */
export interface ExampleCache {
  get(path: string, contentHash: string): readonly RawExample[] | undefined;
  set(path: string, contentHash: string, examples: readonly RawExample[]): void;
  has(path: string): boolean;
  /** Whether a cached entry matches the given content hash. */
  isFresh(path: string, contentHash: string): boolean;
  clear(): void;
  readonly size: number;
  readonly keys: readonly string[];
}

/** Content hash for a file. */
export function contentHash(content: string): string {
  return hashString(content);
}

/** Creates a new in-memory {@link ExampleCache}. */
export function createExampleCache(): ExampleCache {
  const store = new Map<string, CachedFileExtraction>();

  return {
    get size(): number {
      return store.size;
    },

    get keys(): readonly string[] {
      return Object.freeze([...store.keys()]);
    },

    get(path: string, contentHashValue: string): readonly RawExample[] | undefined {
      const entry = store.get(path);
      if (entry === undefined || entry.contentHash !== contentHashValue) return undefined;
      return entry.examples;
    },

    set(path: string, contentHashValue: string, examples: readonly RawExample[]): void {
      store.set(path, {
        contentHash: contentHashValue,
        examples: Object.freeze([...examples]),
      });
    },

    has(path: string): boolean {
      return store.has(path);
    },

    isFresh(path: string, contentHashValue: string): boolean {
      const entry = store.get(path);
      return entry !== undefined && entry.contentHash === contentHashValue;
    },

    clear(): void {
      store.clear();
    },
  };
}
