import type { RelationshipResolver } from "./resolver.js";
import type { DocumentationRelationship } from "../models/index.js";
import { createDocumentationRelationship } from "../models/index.js";

/**
 * Derives configuration relationships: pages covering configuration link to
 * configuration pages that reference the same config files/keys.
 */
export function createConfigurationResolver(): RelationshipResolver {
  return {
    id: "configuration",
    name: "Configuration resolver",
    kinds: ["configuredBy", "uses"],

    resolve(input): readonly DocumentationRelationship[] {
      const results: DocumentationRelationship[] = [];
      const configPages = input.pages.filter(
        (page) => page.kind === "configuration" || (page.configuration?.length ?? 0) > 0,
      );
      const otherPages = input.pages.filter(
        (page) =>
          page.kind !== "configuration" && page !== configPages.find((c) => c.slug === page.slug),
      );

      for (const page of otherPages) {
        for (const config of configPages) {
          if (page.slug === config.slug) continue;
          const shared = intersect(page.configuration, config.configuration);
          if (shared.length === 0) continue;
          results.push(
            createDocumentationRelationship({
              from: page.slug,
              to: config.slug,
              kind: "configuredBy",
              label: `Configured by ${config.title}`,
              evidence: shared.map((key) => `both cover configuration "${key}"`),
              confidence: 0.8,
              weight: 0.6,
              source: "configuration",
            }),
            createDocumentationRelationship({
              from: config.slug,
              to: page.slug,
              kind: "uses",
              label: `Used by ${page.title}`,
              evidence: shared.map((key) => `configuration "${key}" used by ${page.title}`),
              confidence: 0.8,
              weight: 0.5,
              source: "configuration",
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
