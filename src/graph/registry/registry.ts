import type { GraphContributor } from "../contracts/index.js";

/** The maximum number of registered graph contributors. */
export const MAX_GRAPH_CONTRIBUTORS = 32;

/**
 * Tracks registered graph contributors.
 *
 * Contributors are universal (not per-language): every registered contributor
 * contributes to every graph build, in registration order.
 */
export interface GraphContributorRegistry {
  register(contributor: GraphContributor): void;
  unregister(id: string): boolean;
  resolve(id: string): GraphContributor | undefined;
  list(): readonly GraphContributor[];
  clear(): void;
  readonly size: number;
}

/** Builds a {@link GraphContributorRegistry}. */
export function createGraphContributorRegistry(): GraphContributorRegistry {
  const contributors = new Map<string, GraphContributor>();

  return {
    get size(): number {
      return contributors.size;
    },

    register(contributor: GraphContributor): void {
      if (contributors.has(contributor.id)) {
        throw new Error(`Graph contributor already registered: ${contributor.id}`);
      }
      if (contributors.size >= MAX_GRAPH_CONTRIBUTORS) {
        throw new Error(`Too many graph contributors (max ${MAX_GRAPH_CONTRIBUTORS})`);
      }
      contributors.set(contributor.id, contributor);
    },

    unregister(id: string): boolean {
      return contributors.delete(id);
    },

    resolve(id: string): GraphContributor | undefined {
      return contributors.get(id);
    },

    list(): readonly GraphContributor[] {
      return [...contributors.values()];
    },

    clear(): void {
      contributors.clear();
    },
  };
}
