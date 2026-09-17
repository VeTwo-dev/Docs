import type { ReferenceFileBindings } from "../models/index.js";

/** A serializable snapshot of one file's bindings, keyed by content hash. */
interface CachedBindingEntry {
  readonly hash: string;
  readonly bindings: ReferenceFileBindings;
}

/**
 * An in-memory per-file binding cache.
 *
 * Entries are keyed by the owning module symbol's hash (which already
 * incorporates the compilation-unit hash). When a file's hash matches, its
 * bindings are reused without re-walking the syntax tree.
 */
export class ReferenceCache {
  private readonly entries = new Map<string, CachedBindingEntry>();

  /** Whether `file` has a cached entry matching `hash`. */
  has(file: string, hash: string): boolean {
    const entry = this.entries.get(file);
    return entry !== undefined && entry.hash === hash;
  }

  /** Returns the cached bindings for `file`, or undefined on a hash mismatch. */
  get(file: string, hash: string): ReferenceFileBindings | undefined {
    const entry = this.entries.get(file);
    if (entry === undefined || entry.hash !== hash) return undefined;
    return entry.bindings;
  }

  /** Returns the cached bindings for `file` regardless of its hash. */
  peek(file: string): ReferenceFileBindings | undefined {
    return this.entries.get(file)?.bindings;
  }

  /** Stores the bindings of `file` under `hash`. */
  put(file: string, hash: string, bindings: ReferenceFileBindings): void {
    this.entries.set(file, { hash, bindings });
  }

  /** Drops a file from the cache. */
  delete(file: string): boolean {
    return this.entries.delete(file);
  }

  /** The cached files. */
  files(): readonly string[] {
    return [...this.entries.keys()];
  }

  /** The number of cached files. */
  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }
}
