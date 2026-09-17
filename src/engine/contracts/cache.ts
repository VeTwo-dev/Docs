import type { CacheStore } from "../../cache/index.js";

/**
 * Internal engine contract for the build cache.
 *
 * The existing {@link CacheStore} from `src/cache` already provides the
 * required surface, so the contract aliases it directly.
 */
export type CacheContract = CacheStore;
