import type { RelationshipResolver } from "./resolver.js";
import type { DocumentationRelationship } from "../models/index.js";
import { createDocumentationRelationship } from "../models/index.js";

/**
 * Derives example relationships: pages that document a symbol link to the
 * examples that demonstrate that symbol. Example pages link back to the
 * documented page (`referenceFor`).
 */
export function createExampleResolver(): RelationshipResolver {
  return {
    id: "example",
    name: "Example resolver",
    kinds: ["exampleOf", "referenceFor"],

    resolve(input): readonly DocumentationRelationship[] {
      const results: DocumentationRelationship[] = [];
      const examples = input.evidence?.examples ?? [];
      const pagesBySymbol = new Map<string, PageDescriptorLike[]>();

      for (const page of input.pages) {
        for (const symbol of page.symbols ?? []) {
          pagesBySymbol.set(symbol, [...(pagesBySymbol.get(symbol) ?? []), page]);
        }
      }

      for (const example of examples) {
        for (const symbol of example.referencedSymbols) {
          const pages = pagesBySymbol.get(symbol) ?? [];
          for (const page of pages) {
            results.push(
              createDocumentationRelationship({
                from: page.slug,
                to: examplePageId(example.id),
                kind: "exampleOf",
                label: `Example of ${page.title}`,
                evidence: [`example references symbol "${symbol}" documented by ${page.slug}`],
                confidence: example.confidence,
                weight: 0.8,
                source: "example",
              }),
              createDocumentationRelationship({
                from: examplePageId(example.id),
                to: page.slug,
                kind: "referenceFor",
                label: `Reference for ${example.title}`,
                evidence: [`example references symbol "${symbol}"`],
                confidence: example.confidence,
                weight: 0.6,
                source: "example",
              }),
            );
          }
        }
      }
      return results;
    },
  };
}

type PageDescriptorLike = {
  readonly slug: string;
  readonly title: string;
  readonly symbols?: readonly string[];
};

/** Example relationships target synthetic pages named after the example id. */
export function examplePageId(exampleId: string): string {
  return `example:${exampleId}`;
}
