import type { RelationshipResolver, RelationshipResolutionInput } from "./resolver.js";
import type { DocumentationRelationship } from "../models/index.js";
import { createDocumentationRelationship } from "../models/index.js";

/**
 * Derives workflow relationships: pages sharing a workflow are `relatedTo`;
 * pages that cover a workflow another page only references get `deepens`.
 */
export function createWorkflowResolver(): RelationshipResolver {
  return {
    id: "workflow",
    name: "Workflow resolver",
    kinds: ["relatedTo", "deepens"],

    resolve(input: RelationshipResolutionInput): readonly DocumentationRelationship[] {
      const results: DocumentationRelationship[] = [];
      for (let i = 0; i < input.pages.length; i++) {
        for (let j = i + 1; j < input.pages.length; j++) {
          const a = input.pages[i]!;
          const b = input.pages[j]!;
          const shared = intersect(a.workflows, b.workflows);
          if (shared.length === 0) continue;
          results.push(
            createDocumentationRelationship({
              from: a.slug,
              to: b.slug,
              kind: "relatedTo",
              label: `Related by workflow: ${shared.join(", ")}`,
              evidence: shared.map((workflow) => `both cover workflow "${workflow}"`),
              confidence: 0.75,
              weight: 0.5,
              source: "workflow",
            }),
          );
        }
      }
      return results;
    },
  };
}

function intersect(a: readonly string[] | undefined, b: readonly string[] | undefined): string[] {
  if (a === undefined || b === undefined) return [];
  return a.filter((value) => b.includes(value));
}
