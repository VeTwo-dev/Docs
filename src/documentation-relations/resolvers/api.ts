import type { RelationshipResolver, PageDescriptor } from "./resolver.js";
import type { DocumentationRelationship } from "../models/index.js";
import { createDocumentationRelationship } from "../models/index.js";

/**
 * Derives API relationships: example pages document how to use the API a
 * reference page describes (`exampleOf` / `referenceFor`), and reference
 * pages explain the symbols concept pages introduce (`explains`).
 */
export function createApiResolver(): RelationshipResolver {
  return {
    id: "api",
    name: "API resolver",
    kinds: ["exampleOf", "referenceFor", "explains"],

    resolve(input): readonly DocumentationRelationship[] {
      const results: DocumentationRelationship[] = [];
      const examples = input.pages.filter((page) => page.kind === "example");
      const references = input.pages.filter((page) => page.kind === "reference");
      const concepts = input.pages.filter((page) => page.kind === "concept");

      for (const example of examples) {
        for (const reference of references) {
          if (!sharesSymbol(example, reference)) continue;
          const evidence = sharedSymbolEvidence(example, reference);
          results.push(
            createDocumentationRelationship({
              from: reference.slug,
              to: example.slug,
              kind: "exampleOf",
              label: `Example of ${reference.title}`,
              evidence,
              confidence: 0.9,
              weight: 0.8,
              source: "api",
            }),
            createDocumentationRelationship({
              from: example.slug,
              to: reference.slug,
              kind: "referenceFor",
              label: `Reference for ${example.title}`,
              evidence,
              confidence: 0.9,
              weight: 0.7,
              source: "api",
            }),
          );
        }
      }

      for (const reference of references) {
        for (const concept of concepts) {
          if (!sharesSymbol(reference, concept)) continue;
          results.push(
            createDocumentationRelationship({
              from: reference.slug,
              to: concept.slug,
              kind: "explains",
              label: `Explains ${concept.title}`,
              evidence: sharedSymbolEvidence(reference, concept),
              confidence: 0.8,
              weight: 0.6,
              source: "api",
            }),
          );
        }
      }

      return results;
    },
  };
}

function sharesSymbol(a: PageDescriptor, b: PageDescriptor): boolean {
  if (a.symbols === undefined || b.symbols === undefined) return false;
  return a.symbols.some((symbol) => b.symbols?.includes(symbol));
}

function sharedSymbolEvidence(a: PageDescriptor, b: PageDescriptor): readonly string[] {
  const shared = (a.symbols ?? []).filter((symbol) => b.symbols?.includes(symbol));
  return shared.map((symbol) => `shared symbol "${symbol}"`);
}
