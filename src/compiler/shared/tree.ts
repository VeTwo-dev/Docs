import type { CompilerRequestOptions } from "../contracts/request.js";

/** Bounds for normalized syntax tree construction. */
export interface TreeLimits {
  /** Maximum depth of the normalized tree. */
  readonly maxDepth: number;
  /** Maximum number of normalized nodes. */
  readonly maxNodes: number;
}

export const DEFAULT_TREE_LIMITS: TreeLimits = Object.freeze({
  maxDepth: 8,
  maxNodes: 5_000,
});

/** Derives tree limits from a compile request's options. */
export function limitsFromOptions(options?: CompilerRequestOptions): TreeLimits {
  return {
    maxDepth: options?.maxDepth ?? DEFAULT_TREE_LIMITS.maxDepth,
    maxNodes: options?.maxNodes ?? DEFAULT_TREE_LIMITS.maxNodes,
  };
}
