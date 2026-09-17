import type { CompilationResult, CompilationUnit } from "../results/index.js";

/**
 * The compiler cache.
 *
 * Stores compilation artifacts (units, syntax trees, diagnostics), content
 * hashes and syntactic dependency information keyed per compiler + file, plus
 * whole-request results. Memory-bounded: when the unit count exceeds
 * `maxEntries`, the oldest entries are evicted.
 */
export interface CompilerCacheOptions {
  /** Maximum cached units before eviction. Defaults to 10_000. */
  readonly maxEntries?: number;
}

interface CachedUnit {
  readonly hash: string;
  readonly unit: CompilationUnit;
  readonly dependencies: readonly string[];
}

export class CompilerCache {
  private readonly units = new Map<string, CachedUnit>();
  private readonly results = new Map<string, CompilationResult>();
  private readonly artifacts = new Map<string, unknown>();
  private readonly maxEntries: number;

  constructor(options: CompilerCacheOptions = {}) {
    this.maxEntries = options.maxEntries ?? 10_000;
  }

  private fileKey(compilerId: string, file: string): string {
    return `${compilerId}\u0000${file}`;
  }

  private resultKey(compilerId: string, fingerprint: string): string {
    return `${compilerId}\u0000${fingerprint}`;
  }

  /** The cached unit for a file, if present. */
  getUnit(compilerId: string, file: string): CompilationUnit | undefined {
    return this.units.get(this.fileKey(compilerId, file))?.unit;
  }

  /** The cached syntactic dependencies for a file, if present. */
  getDependencies(compilerId: string, file: string): readonly string[] | undefined {
    return this.units.get(this.fileKey(compilerId, file))?.dependencies;
  }

  /** The cached content hash for a file, if present. */
  getHash(compilerId: string, file: string): string | undefined {
    return this.units.get(this.fileKey(compilerId, file))?.hash;
  }

  /** Whether the file's content hash differs from the cached hash. */
  hasChanged(compilerId: string, file: string, hash: string): boolean {
    const cached = this.units.get(this.fileKey(compilerId, file));
    return cached === undefined || cached.hash !== hash;
  }

  /** Stores a compiled unit and its syntactic dependencies. */
  putUnit(
    compilerId: string,
    file: string,
    unit: CompilationUnit,
    dependencies: readonly string[] = [],
  ): void {
    this.units.set(this.fileKey(compilerId, file), {
      hash: unit.hash,
      unit,
      dependencies: [...dependencies],
    });
    this.evictUnits();
  }

  /** Removes a file's cached unit. */
  removeUnit(compilerId: string, file: string): void {
    this.units.delete(this.fileKey(compilerId, file));
  }

  /** The cached whole-request result, if present. */
  getResult(compilerId: string, fingerprint: string): CompilationResult | undefined {
    return this.results.get(this.resultKey(compilerId, fingerprint));
  }

  /** Stores a whole-request result. */
  putResult(compilerId: string, fingerprint: string, result: CompilationResult): void {
    this.results.set(this.resultKey(compilerId, fingerprint), result);
    if (this.results.size > this.maxEntries) {
      this.results.delete(this.results.keys().next().value as string);
    }
  }

  /** Stores an opaque compilation artifact (e.g. a source map). */
  putArtifact(compilerId: string, file: string, kind: string, data: unknown): void {
    this.artifacts.set(`${this.fileKey(compilerId, file)}\u0000${kind}`, data);
  }

  /** Reads an opaque compilation artifact. */
  getArtifact(compilerId: string, file: string, kind: string): unknown {
    return this.artifacts.get(`${this.fileKey(compilerId, file)}\u0000${kind}`);
  }

  /** Removes an opaque compilation artifact. */
  removeArtifact(compilerId: string, file: string, kind: string): void {
    this.artifacts.delete(`${this.fileKey(compilerId, file)}\u0000${kind}`);
  }

  /**
   * Invalidates cached entries. With no arguments everything is cleared; with
   * a compiler id only that compiler's entries are cleared; with a file the
   * file's entries (for all compilers) are cleared.
   */
  invalidate(compilerId?: string, file?: string): void {
    if (compilerId === undefined && file === undefined) {
      this.clear();
      return;
    }
    const prefix = compilerId !== undefined ? `${compilerId}\u0000` : "";
    for (const key of [...this.units.keys()]) {
      if (compilerId !== undefined && !key.startsWith(prefix)) continue;
      const filePart = compilerId !== undefined ? key.slice(prefix.length) : key.split("\u0000")[1];
      if (file !== undefined && filePart !== file) continue;
      this.units.delete(key);
    }
    if (compilerId === undefined || file === undefined) {
      this.results.clear();
      this.artifacts.clear();
    }
  }

  /** Removes every cached entry. */
  clear(): void {
    this.units.clear();
    this.results.clear();
    this.artifacts.clear();
  }

  /** The number of cached units. */
  size(): number {
    return this.units.size;
  }

  private evictUnits(): void {
    while (this.units.size > this.maxEntries) {
      const oldest = this.units.keys().next().value;
      if (oldest === undefined) break;
      this.units.delete(oldest);
    }
  }
}

/** Creates a new {@link CompilerCache}. */
export function createCompilerCache(options: CompilerCacheOptions = {}): CompilerCache {
  return new CompilerCache(options);
}
