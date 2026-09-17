import type { RelationshipResolver, RelationshipResolutionInput } from "../resolvers/resolver.js";
import type { DocumentationRelationship } from "../models/index.js";

/**
 * The relationship resolver registry — a plugin system for deriving
 * documentation relationships.
 */
export interface RelationshipResolverRegistry {
  register(resolver: RelationshipResolver): { readonly resolverId: string };
  unregister(id: string): boolean;
  get(id: string): RelationshipResolver | undefined;
  list(): readonly RelationshipResolver[];
  /** Run every registered resolver and concatenate the relationships. */
  resolve(input: RelationshipResolutionInput): readonly DocumentationRelationship[];
  readonly size: number;
}

/** Creates a new empty {@link RelationshipResolverRegistry}. */
export function createRelationshipResolverRegistry(): RelationshipResolverRegistry {
  const byId = new Map<string, RelationshipResolver>();

  return {
    get size(): number {
      return byId.size;
    },

    register(resolver: RelationshipResolver): { readonly resolverId: string } {
      byId.set(resolver.id, resolver);
      return { resolverId: resolver.id };
    },

    unregister(id: string): boolean {
      return byId.delete(id);
    },

    get(id: string): RelationshipResolver | undefined {
      return byId.get(id);
    },

    list(): readonly RelationshipResolver[] {
      return Object.freeze([...byId.values()]);
    },

    resolve(input: RelationshipResolutionInput): readonly DocumentationRelationship[] {
      const results: DocumentationRelationship[] = [];
      for (const resolver of byId.values()) {
        results.push(...resolver.resolve(input));
      }
      return Object.freeze(results);
    },
  };
}
