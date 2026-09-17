import type { CacheStore } from "../../cache/index.js";
import { createCacheStore } from "../../cache/index.js";
import type { ServiceFactory } from "../container.js";

/**
 * Cache service — owns the build cache lifecycle.
 *
 * Wraps the existing `createCacheStore` implementation. The cache is only
 * created when configuration enables it; callers must check `isEnabled`
 * before interacting with the store.
 */
export interface CacheService {
  /** Whether a cache store is available (config.cache === true). */
  readonly isEnabled: boolean;
  /** The underlying cache store, or `undefined` when caching is disabled. */
  readonly store: CacheStore | undefined;
  /** Enables the cache service for the given root directory. */
  enable: (rootDir: string) => void;
  readonly load: () => void;
  readonly save: () => void;
}

export const CACHE_SERVICE = "cache";

export const cacheServiceFactory: ServiceFactory<CacheService> = () => {
  let store: CacheStore | undefined;

  const service: CacheService = {
    get isEnabled(): boolean {
      return store !== undefined;
    },
    get store() {
      return store;
    },
    enable(rootDir: string): void {
      if (store) {
        return;
      }
      store = createCacheStore(rootDir);
    },
    load(): void {
      store?.load();
    },
    save(): void {
      store?.save();
    },
  };

  return service;
};
