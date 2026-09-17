/**
 * Incremental API Analysis Cache.
 *
 * Persists `fileHashes` from `ApiAnalysisResult` and reuses cached `ApiSymbol[]`
 * for files whose hash hasn't changed. Hash comparison is O(files); re-analysis
 * only touches changed/added files.
 */

import type { ApiSymbol } from "./models.js";

export interface IncrementalApiCache {
  readonly fileHashes: ReadonlyMap<string, string>;
  readonly symbolsByFile: ReadonlyMap<string, readonly ApiSymbol[]>;
}

export function createIncrementalCache(): {
  get(key: string): IncrementalApiCache | undefined;
  set(key: string, value: IncrementalApiCache): void;
  clear(): void;
} {
  const store = new Map<string, IncrementalApiCache>();
  return {
    get: (k) => store.get(k),
    set: (k, v) => { store.set(k, v); },
    clear: () => store.clear(),
  };
}

export interface IncrementalPlan {
  /** Files that must be re-analyzed. */
  readonly changedFiles: readonly string[];
  /** Files whose symbols can be reused from cache. */
  readonly reusableFiles: readonly string[];
  /** Whether the cache can be used at all. */
  readonly canReuse: boolean;
}

export function planIncremental(
  currentHashes: ReadonlyMap<string, string>,
  cached: IncrementalApiCache | undefined,
): IncrementalPlan {
  if (cached === undefined) {
    return { changedFiles: [...currentHashes.keys()], reusableFiles: [], canReuse: false };
  }
  const changed: string[] = [];
  const reusable: string[] = [];
  for (const [file, hash] of currentHashes) {
    const prev = cached.fileHashes.get(file);
    if (prev === hash && cached.symbolsByFile.has(file)) reusable.push(file);
    else changed.push(file);
  }
  // Removed files are ignored — diff will report removals.
  return { changedFiles: changed, reusableFiles: reusable, canReuse: true };
}

export function mergeIncremental(
  plan: IncrementalPlan,
  cached: IncrementalApiCache | undefined,
  freshSymbols: readonly ApiSymbol[],
  currentHashes: ReadonlyMap<string, string>,
): { symbols: ApiSymbol[]; cache: IncrementalApiCache } {
  if (!plan.canReuse || cached === undefined) {
    const byFile = groupByFile(freshSymbols);
    return { symbols: [...freshSymbols], cache: { fileHashes: new Map(currentHashes), symbolsByFile: byFile } };
  }
  const reused = plan.reusableFiles.flatMap((f) => [...(cached.symbolsByFile.get(f) ?? [])]);
  const all = [...reused, ...freshSymbols];
  const byFile = groupByFile(all);
  return { symbols: all, cache: { fileHashes: new Map(currentHashes), symbolsByFile: byFile } };
}

function groupByFile(symbols: readonly ApiSymbol[]): Map<string, ApiSymbol[]> {
  const m = new Map<string, ApiSymbol[]>();
  for (const s of symbols) {
    const arr = m.get(s.sourceFile);
    if (arr === undefined) m.set(s.sourceFile, [s]);
    else arr.push(s);
  }
  return m;
}
