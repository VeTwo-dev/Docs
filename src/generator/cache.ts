import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { hashString } from "../utils/hash.js";
import { ensureStateNamespace } from "../state/manager.js";

const GENERATOR_CACHE_FILE = "generator-manifest.json";

interface GeneratorCacheEntry {
  readonly hash: string;
  readonly timestamp: number;
}

interface GeneratorManifest {
  readonly version: string;
  readonly entries: Record<string, GeneratorCacheEntry>;
}

/**
 * Manages incremental generation by tracking file hashes.
 * Only files whose content has changed are regenerated.
 */
export class GeneratorCache {
  private manifest: GeneratorManifest;
  private readonly cacheDir: string;
  private hits = 0;
  private misses = 0;

  constructor(rootDir: string) {
    this.cacheDir = ensureStateNamespace(rootDir, "generator");
    const manifestPath = join(this.cacheDir, GENERATOR_CACHE_FILE);
    if (existsSync(manifestPath)) {
      try {
        const parsed = JSON.parse(readFileSync(manifestPath, "utf-8")) as Record<string, unknown>;
        if (
          parsed &&
          typeof parsed === "object" &&
          typeof parsed["version"] === "string" &&
          parsed["entries"] &&
          typeof parsed["entries"] === "object"
        ) {
          this.manifest = {
            version: parsed["version"] as string,
            entries: parsed["entries"] as Record<string, GeneratorCacheEntry>,
          };
        } else {
          this.manifest = { version: "1.0.0", entries: {} };
        }
      } catch {
        this.manifest = { version: "1.0.0", entries: {} };
      }
    } else {
      this.manifest = { version: "1.0.0", entries: {} };
    }
  }

  /**
   * Returns true if the file content hash has not changed since last generation.
   */
  isUpToDate(key: string, content: string): boolean {
    const currentHash = hashString(content);
    const cached = this.manifest.entries[key];
    if (cached && cached.hash === currentHash) {
      this.hits++;
      return true;
    }
    this.misses++;
    return false;
  }

  /**
   * Records the hash for a generated file.
   */
  record(key: string, content: string): void {
    this.manifest = {
      ...this.manifest,
      entries: {
        ...this.manifest.entries,
        [key]: { hash: hashString(content), timestamp: Date.now() },
      },
    };
  }

  /**
   * Persists the manifest to disk.
   */
  save(): void {
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
    writeFileSync(
      join(this.cacheDir, GENERATOR_CACHE_FILE),
      JSON.stringify(this.manifest, null, 2),
      "utf-8",
    );
  }

  getStats(): { hits: number; misses: number } {
    return { hits: this.hits, misses: this.misses };
  }

  clear(): void {
    this.manifest = { version: "1.0.0", entries: {} };
  }
}
