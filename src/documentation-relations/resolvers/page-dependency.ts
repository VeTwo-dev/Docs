import type { RelationshipResolver, PageDescriptor } from "./resolver.js";
import type { DocumentationRelationship } from "../models/index.js";
import { createDocumentationRelationship } from "../models/index.js";

/**
 * Derives relationships from in-page links: when one page's content
 * references another page's slug or title, they are linked (`uses` for
 * action-oriented pages, `relatedTo` otherwise).
 */
export function createPageDependencyResolver(): RelationshipResolver {
  return {
    id: "page-dependency",
    name: "Page dependency resolver",
    kinds: ["uses", "relatedTo"],

    resolve(input): readonly DocumentationRelationship[] {
      const results: DocumentationRelationship[] = [];
      const bySlug = new Map(input.pages.map((page) => [page.slug.toLowerCase(), page]));

      for (const page of input.pages) {
        const targets = findLinkedTargets(page, input.pages, bySlug);
        for (const target of targets) {
          if (target.slug === page.slug) continue;
          const kind = page.kind === "guide" ? "uses" : "relatedTo";
          results.push(
            createDocumentationRelationship({
              from: page.slug,
              to: target.slug,
              kind,
              label: kind === "uses" ? `Uses ${target.title}` : `Related to ${target.title}`,
              evidence: [`${page.title} links to ${target.title}`],
              confidence: 0.85,
              weight: 0.7,
              source: "page-dependency",
            }),
          );
        }
      }
      return results;
    },
  };
}

function findLinkedTargets(
  page: PageDescriptor,
  all: readonly PageDescriptor[],
  bySlug: Map<string, PageDescriptor>,
): readonly PageDescriptor[] {
  const content = page.content ?? "";
  if (content.trim().length === 0) return [];
  const found = new Set<PageDescriptor>();

  // Markdown/wiki links: [label](../path/to/slug.md)
  const linkRe = /\[[^\]]*\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = linkRe.exec(content)) !== null) {
    const href = match[1]!;
    const slug = href
      .replace(/^\.{0,2}\//, "")
      .replace(/\.mdx?$/, "")
      .replace(/^\/+/, "");
    const target = bySlug.get(slug.toLowerCase());
    if (target !== undefined && target.slug !== page.slug) found.add(target);
  }

  // Title references in prose.
  for (const other of all) {
    if (other.slug === page.slug) continue;
    const title = other.title.toLowerCase();
    if (title.length < 4) continue;
    if (new RegExp(`\\b${escapeRegExp(title)}\\b`, "i").test(content)) found.add(other);
  }

  return Object.freeze([...found]);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
