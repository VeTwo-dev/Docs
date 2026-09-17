/**
 * AI Cache.
 *
 * Content-addressed, versioned, provider-aware cache for AI-generated
 * documentation. Prevents regenerating content when the relevant context
 * has not changed.
 */

import type { SafeFileSystem } from "../../init/filesystem/interface.js";
import { posixJoin } from "../../init/filesystem/interface.js";
import { atomicWriteJson } from "../../state/atomic.js";
import { hashString } from "../../utils/hash.js";

/** A cached AI generation entry. */
export interface AICacheEntry {
  /** Cache key (content hash of the input context). */
  readonly key: string;
  /** Provider ID used. */
  readonly provider: string;
  /** Model used. */
  readonly model: string;
  /** When the entry was created. */
  readonly createdAt: string;
  /** The cached output (serialized). */
  readonly output: string;
  /** Configuration hash (detects config changes). */
  readonly configHash: string;
}

/** AI Cache interface. */
export interface AICache {
  /** Get a cached entry by key. Returns undefined if miss. */
  get(key: string): AICacheEntry | undefined;
  /** Set a cache entry. */
  set(entry: AICacheEntry): void;
  /** Check if a key exists. */
  has(key: string): boolean;
  /** Invalidate a specific key. */
  invalidate(key: string): boolean;
  /** Invalidate all entries for a provider. */
  invalidateProvider(provider: string): number;
  /** Invalidate all entries. */
  invalidateAll(): void;
  /** List all cache keys. */
  keys(): readonly string[];
  /** Persist cache to disk. */
  persist(fs: SafeFileSystem, stateRoot: string): void;
  /** Load cache from disk. */
  load(fs: SafeFileSystem, stateRoot: string): void;
}

/**
 * Build a cache key from input context.
 * The key is a content hash of the relevant context + intent + audience.
 */
export function buildCacheKey(input: {
  readonly intent: string;
  readonly audience: string;
  readonly topic: string;
  readonly contextFingerprint: string;
  readonly provider: string;
  readonly model: string;
}): string {
  const payload = JSON.stringify({
    intent: input.intent,
    audience: input.audience,
    topic: input.topic,
    context: input.contextFingerprint,
    provider: input.provider,
    model: input.model,
  });
  return hashString(payload);
}

class AICacheImpl implements AICache {
  private readonly entries = new Map<string, AICacheEntry>();

  get(key: string): AICacheEntry | undefined {
    return this.entries.get(key);
  }

  set(entry: AICacheEntry): void {
    this.entries.set(entry.key, entry);
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  invalidate(key: string): boolean {
    return this.entries.delete(key);
  }

  invalidateProvider(provider: string): number {
    let count = 0;
    for (const [key, entry] of this.entries) {
      if (entry.provider === provider) {
        this.entries.delete(key);
        count++;
      }
    }
    return count;
  }

  invalidateAll(): void {
    this.entries.clear();
  }

  keys(): readonly string[] {
    return [...this.entries.keys()];
  }

  persist(fs: SafeFileSystem, stateRoot: string): void {
    const cacheDir = posixJoin(stateRoot, "ai", "cache");
    fs.mkdir(cacheDir);
    const cacheFile = posixJoin(cacheDir, "cache.json");
    const data = [...this.entries.values()];
    atomicWriteJson(fs, cacheFile, data);
  }

  load(fs: SafeFileSystem, stateRoot: string): void {
    const cacheFile = posixJoin(stateRoot, "ai", "cache", "cache.json");
    if (!fs.isFile(cacheFile)) return;
    try {
      const data = JSON.parse(fs.readFile(cacheFile)) as AICacheEntry[];
      for (const entry of data) {
        this.entries.set(entry.key, entry);
      }
    } catch {
      // Corrupted cache — start fresh
    }
  }
}

/** Create a new AI cache. */
export function createAICache(): AICache {
  return new AICacheImpl();
}
