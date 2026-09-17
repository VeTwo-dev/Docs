import type { RelationshipResolver, PageDescriptor } from "./resolver.js";
import type { DocumentationRelationship } from "../models/index.js";
import { createDocumentationRelationship } from "../models/index.js";

/**
 * Derives relationships between pages that share documented entities
 * (symbols or packages). Shared symbols produce `relatedTo`; pages with the
 * same primary symbol produce `complements` when they focus on different
 * aspects.
 */
export function createSharedEntityResolver(): RelationshipResolver {
  return {
    id: "shared-entity",
    name: "Shared entity resolver",
    kinds: ["relatedTo", "complements"],

    resolve(input): readonly DocumentationRelationship[] {
      const results: DocumentationRelationship[] = [];
      const pages = input.pages;

      for (let i = 0; i < pages.length; i++) {
        for (let j = i + 1; j < pages.length; j++) {
          const a = pages[i]!;
          const b = pages[j]!;
          const shared = sharedEntities(a, b);
          if (shared.length === 0) continue;

          const kind = sameSymbol(a, b) ? "complements" : "relatedTo";
          results.push(
            createDocumentationRelationship({
              from: a.slug,
              to: b.slug,
              kind,
              label: kind === "complements" ? `Complements ${b.title}` : `Related to ${b.title}`,
              evidence: shared.map((entity) => `both pages cover "${entity}"`),
              confidence: Math.min(1, 0.6 + shared.length * 0.1),
              weight: Math.min(1, shared.length * 0.25),
              source: "shared-entity",
            }),
          );
        }
      }
      return results;
    },
  };
}

function sharedEntities(a: PageDescriptor, b: PageDescriptor): readonly string[] {
  const symbols = intersect(a.symbols, b.symbols);
  const packages = intersect(a.packages, b.packages);
  return [...symbols, ...packages.map((pkg) => `package:${pkg}`)];
}

function sameSymbol(a: PageDescriptor, b: PageDescriptor): boolean {
  return intersect(a.symbols, b.symbols).length > 0;
}

function intersect(a: readonly string[] | undefined, b: readonly string[] | undefined): string[] {
  if (a === undefined || b === undefined) return [];
  return a.filter((value) => b.includes(value));
}
