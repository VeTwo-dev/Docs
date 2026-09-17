import type { ScannerProvider } from "../providers/types.js";
import { toPosixPath } from "../utils/path.js";

/** A cached entry for a single file. */
export interface CacheEntry {
  readonly size: number;
  readonly mtimeMs: number;
  readonly hash: string;
}

/** Version of the on-disk cache format. */
export const SCANNER_CACHE_VERSION = 1;

/** Default cache file location relative to the project root. */
export const DEFAULT_SCANNER_CACHE_FILE = ".vetwo/docs/scanner/scanner-cache.json";

/** The persisted shape of the scanner cache. */
export interface PersistedScannerCache {
  readonly version: number;
  readonly entries: Readonly<Record<string, CacheEntry>>;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/**
 * The scanner cache stores file fingerprints so unchanged files are not
 * re-hashed between scans. It is used by the incremental scanning path to
 * skip content reads entirely.
 */
export class ScannerCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly createdAt: number;
  private updatedAt: number;

  constructor(initial?: Readonly<Record<string, CacheEntry>>) {
    for (const [key, entry] of Object.entries(initial ?? {})) {
      if (entry && typeof entry.hash === "string") {
        this.entries.set(key, {
          size: entry.size ?? 0,
          mtimeMs: entry.mtimeMs ?? 0,
          hash: entry.hash,
        });
      }
    }
    this.createdAt = Date.now();
    this.updatedAt = this.createdAt;
  }

  /** The number of cached entries. */
  get size(): number {
    return this.entries.size;
  }

  /** Returns the cached entry for a path, or `undefined`. */
  get(path: string): CacheEntry | undefined {
    return this.entries.get(path);
  }

  /** Stores or replaces the entry for a path. */
  set(path: string, entry: CacheEntry): void {
    this.entries.set(path, { size: entry.size, mtimeMs: entry.mtimeMs, hash: entry.hash });
    this.updatedAt = Date.now();
  }

  /** Removes the entry for a path. */
  delete(path: string): void {
    if (this.entries.delete(path)) this.updatedAt = Date.now();
  }

  /** Empties the cache. */
  clear(): void {
    this.entries.clear();
    this.updatedAt = Date.now();
  }

  /** Whether a cached hash is reusable given fresh stat data. */
  isValid(path: string, size: number, mtimeMs: number): boolean {
    const entry = this.entries.get(path);
    return entry !== undefined && entry.size === size && entry.mtimeMs === mtimeMs;
  }

  /** Serialises the cache for persistence. */
  toJSON(): PersistedScannerCache {
    return {
      version: SCANNER_CACHE_VERSION,
      entries: Object.fromEntries(this.entries),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /** Rebuilds a cache from persisted data. */
  static fromJSON(data: PersistedScannerCache): ScannerCache {
    return new ScannerCache(data.entries);
  }

  /**
   * Loads persisted entries from the provider. Corrupt or version-mismatched
   * files are ignored.
   *
   * @param provider - The provider to read through.
   * @param filePath - The absolute cache file path.
   */
  async load(provider: ScannerProvider, filePath: string): Promise<void> {
    try {
      const content = await provider.readFile(filePath);
      const parsed = JSON.parse(content) as PersistedScannerCache;
      if (parsed.version !== SCANNER_CACHE_VERSION) return;
      for (const [key, entry] of Object.entries(parsed.entries ?? {})) {
        if (entry && typeof entry.hash === "string") {
          this.entries.set(key, {
            size: entry.size ?? 0,
            mtimeMs: entry.mtimeMs ?? 0,
            hash: entry.hash,
          });
        }
      }
      this.updatedAt = Date.now();
    } catch {
      // missing or corrupt cache file: start empty
    }
  }

  /**
   * Persists the cache through the provider.
   *
   * @param provider - The provider to write through.
   * @param filePath - The absolute cache file path.
   */
  async save(provider: ScannerProvider, filePath: string): Promise<void> {
    if (provider.ensureDir) {
      const dir = filePath.slice(0, filePath.lastIndexOf("/"));
      await provider.ensureDir(toPosixPath(dir));
    }
    if (provider.writeFile) {
      await provider.writeFile(toPosixPath(filePath), JSON.stringify(this.toJSON(), null, 2));
    }
  }
}
