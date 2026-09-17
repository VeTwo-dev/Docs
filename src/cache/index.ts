import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, renameSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { hashString } from "../utils/hash.js";
import { CACHE_MANIFEST } from "../constants/defaults.js";
import { ensureStateNamespace } from "../state/manager.js";

/** Schema version for cache manifest format changes. */
const CACHE_SCHEMA_VERSION = "2.0.0";

/** Default TTL in milliseconds (24 hours). */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/** Default maximum number of cache entries. */
const DEFAULT_MAX_ENTRIES = 1000;

interface CacheEntry {
  readonly hash: string;
  readonly filePath: string;
  readonly timestamp: number;
  /** SHA-256 checksum of the cached content for integrity verification. */
  readonly checksum?: string;
}

interface CacheManifest {
  version: string;
  entries: Record<string, CacheEntry>;
  /** Configuration fingerprint used for cache invalidation on config changes. */
  configFingerprint?: string;
}

export interface CacheStoreOptions {
  /** Time-to-live in milliseconds. Entries older than this are evicted. Default: 24h. */
  readonly ttlMs?: number;
  /** Maximum number of entries. LRU eviction when exceeded. Default: 1000. */
  readonly maxEntries?: number;
  /** Configuration fingerprint. Cache is invalidated when this changes. */
  readonly configFingerprint?: string;
  /** Whether to verify content integrity via SHA-256 checksums. Default: true. */
  readonly verifyIntegrity?: boolean;
}

/** A disk-backed cache store with in-memory lookup for build artefacts. */
export interface CacheStore {
  /** Retrieves a cached value by key. Returns `undefined` if not found, expired, or corrupted. */
  get(key: string): string | undefined;
  /** Stores a value by key, persisting it to disk atomically. */
  set(key: string, value: string): void;
  /** Checks whether a key exists in the cache and is valid. */
  has(key: string): boolean;
  /** Removes a single entry from the cache by key. */
  invalidate(key: string): void;
  /** Clears the entire cache including the manifest and all cached files. */
  invalidateAll(): void;
  /** Persists the manifest to disk atomically. */
  save(): void;
  /** Loads the manifest from disk. */
  load(): void;
  /** Returns statistics about cache usage. */
  getStats(): { size: number; hits: number; misses: number; evictions: number };
}

function ensureCacheDir(cacheDir: string): void {
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }
}

/**
 * Atomically write content to a file (write to temp, then rename).
 * Prevents corrupted files on crash.
 */
function atomicWrite(filePath: string, content: string): void {
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now().toString(36)}`;
  writeFileSync(tmpPath, content, "utf-8");
  renameSync(tmpPath, filePath);
}

/**
 * Compute SHA-256 checksum of a string.
 */
function computeChecksum(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

/**
 * Creates a new {@link CacheStore} backed by the filesystem.
 *
 * Entries are stored in the `compiler` state namespace, provisioned lazily
 * through the central state manager (`.vetwo/docs/compiler/`).
 *
 * @param rootDir - The project root directory.
 * @param options - Cache configuration options.
 * @returns A new CacheStore instance.
 *
 * @example
 * ```ts
 * const cache = createCacheStore("/path/to/project", { ttlMs: 3600000 });
 * cache.set("key", JSON.stringify(data));
 * const value = cache.get("key");
 * ```
 */
export function createCacheStore(rootDir: string, options?: CacheStoreOptions): CacheStore {
  const cacheDir = ensureStateNamespace(rootDir, "compiler");
  const manifestPath = join(cacheDir, CACHE_MANIFEST);
  const memoryCache = new Map<string, string>();
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const maxEntries = options?.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const verifyIntegrity = options?.verifyIntegrity ?? true;
  let hits = 0;
  let misses = 0;
  let evictions = 0;
  let manifest: CacheManifest = { version: CACHE_SCHEMA_VERSION, entries: {} };

  // Invalidate all entries if config fingerprint changed
  if (options?.configFingerprint && manifest.configFingerprint !== options.configFingerprint) {
    manifest = { version: CACHE_SCHEMA_VERSION, entries: {}, configFingerprint: options.configFingerprint };
    memoryCache.clear();
  }

  function isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > ttlMs;
  }

  function evictOldest(): void {
    const entries = Object.entries(manifest.entries);
    if (entries.length === 0) return;
    // Find oldest entry by timestamp
    let oldestKey = entries[0]![0];
    let oldestTimestamp = entries[0]![1].timestamp;
    for (const [key, entry] of entries) {
      if (entry.timestamp < oldestTimestamp) {
        oldestKey = key;
        oldestTimestamp = entry.timestamp;
      }
    }
    const oldestEntry = manifest.entries[oldestKey];
    if (oldestEntry) {
      const fullPath = join(cacheDir, oldestEntry.filePath);
      if (existsSync(fullPath)) {
        rmSync(fullPath);
      }
      delete manifest.entries[oldestKey];
      memoryCache.delete(oldestKey);
      evictions++;
    }
  }

  return {
    get(key: string): string | undefined {
      const hash = hashString(key);
      const entry = manifest.entries[hash];
      if (!entry) {
        misses++;
        return undefined;
      }

      // Check TTL
      if (isExpired(entry)) {
        delete manifest.entries[hash];
        memoryCache.delete(hash);
        misses++;
        return undefined;
      }

      const fullPath = join(cacheDir, entry.filePath);
      if (!existsSync(fullPath)) {
        delete manifest.entries[hash];
        memoryCache.delete(hash);
        misses++;
        return undefined;
      }

      const content = memoryCache.get(hash) ?? readFileSync(fullPath, "utf-8");
      memoryCache.set(hash, content);

      // Verify integrity if checksum is available
      if (verifyIntegrity && entry.checksum) {
        const actualChecksum = computeChecksum(content);
        if (actualChecksum !== entry.checksum) {
          console.warn("[vetwo/docs] cache entry integrity check failed, removing corrupted entry");
          delete manifest.entries[hash];
          memoryCache.delete(hash);
          rmSync(fullPath);
          misses++;
          return undefined;
        }
      }

      hits++;
      return content;
    },

    set(key: string, value: string): void {
      const hash = hashString(key);
      const filePath = `${hash}.json`;
      ensureCacheDir(cacheDir);

      // Evict if at capacity
      while (Object.keys(manifest.entries).length >= maxEntries) {
        evictOldest();
      }

      // Atomic write
      atomicWrite(join(cacheDir, filePath), value);

      memoryCache.set(hash, value);
      manifest.entries[hash] = {
        hash,
        filePath,
        timestamp: Date.now(),
        checksum: verifyIntegrity ? computeChecksum(value) : undefined,
      };
    },

    has(key: string): boolean {
      const hash = hashString(key);
      const entry = manifest.entries[hash];
      if (!entry) return false;
      if (isExpired(entry)) return false;
      return existsSync(join(cacheDir, entry.filePath));
    },

    invalidate(key: string): void {
      const hash = hashString(key);
      const entry = manifest.entries[hash];
      if (entry) {
        const fullPath = join(cacheDir, entry.filePath);
        if (existsSync(fullPath)) {
          rmSync(fullPath);
        }
        delete manifest.entries[hash];
        memoryCache.delete(hash);
      }
    },

    invalidateAll(): void {
      if (existsSync(cacheDir)) {
        rmSync(cacheDir, { recursive: true });
      }
      manifest = { version: CACHE_SCHEMA_VERSION, entries: {}, configFingerprint: options?.configFingerprint };
      memoryCache.clear();
    },

    save(): void {
      ensureCacheDir(cacheDir);
      atomicWrite(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    },

    load(): void {
      if (existsSync(manifestPath)) {
        try {
          const raw = JSON.parse(readFileSync(manifestPath, "utf-8")) as CacheManifest;
          // Version migration: if old version, invalidate and rebuild
          if (raw.version !== CACHE_SCHEMA_VERSION) {
            console.warn(
              `[vetwo/docs] cache manifest version mismatch (got ${raw.version}, expected ${CACHE_SCHEMA_VERSION}), rebuilding`,
            );
            manifest = { version: CACHE_SCHEMA_VERSION, entries: {}, configFingerprint: options?.configFingerprint };
            return;
          }
          manifest = raw;
        } catch {
          console.warn("[vetwo/docs] cache manifest corrupted, rebuilding cache");
          manifest = { version: CACHE_SCHEMA_VERSION, entries: {}, configFingerprint: options?.configFingerprint };
        }
      }
    },

    getStats(): { size: number; hits: number; misses: number; evictions: number } {
      return { size: Object.keys(manifest.entries).length, hits, misses, evictions };
    },
  };
}
