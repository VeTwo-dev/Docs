import type { PageDescriptor } from "../resolvers/index.js";
import type { DocumentationRelationship } from "../models/index.js";
import type { PageNavigation, NavigationEntry } from "../models/index.js";
import { rankRelationships } from "../ranking/index.js";

/** Options for the navigation builder. */
export interface NavigationBuilderOptions {
  /** A fixed reading order of slugs (previous/next). Falls back to stage order. */
  readonly readingOrder?: readonly string[];
}

/**
 * Builds the navigation model for every page from the derived relationships.
 *
 * Deterministic rules:
 * - `previous` / `next` come from the linear reading order.
 * - `related` are ranked relationships (highest weight first).
 * - `seeAlso` are `relatedTo` entries.
 * - `breadcrumbs` come from the page path hierarchy.
 * - `sidebar` entries are siblings under the same parent directory.
 */
export function buildNavigation(
  pages: readonly PageDescriptor[],
  relationships: readonly DocumentationRelationship[],
  options: NavigationBuilderOptions = {},
): ReadonlyMap<string, PageNavigation> {
  const bySlug = new Map(pages.map((page) => [page.slug, page]));
  const order = resolveReadingOrder(pages, options.readingOrder);
  const position = new Map(order.map((slug, index) => [slug, index]));

  const navigation = new Map<string, PageNavigation>();
  for (const page of pages) {
    const index = position.get(page.slug);
    const previous = index !== undefined && index > 0 ? order[index - 1] : undefined;
    const next = index !== undefined && index + 1 < order.length ? order[index + 1] : undefined;

    const outgoing = relationships.filter((relationship) => relationship.from === page.slug);
    const ranked = rankRelationships(outgoing);

    navigation.set(
      page.slug,
      Object.freeze({
        page: page.slug,
        ...(previous !== undefined ? { previous } : {}),
        ...(next !== undefined ? { next } : {}),
        breadcrumbs: Object.freeze(breadcrumbsFor(page, bySlug)),
        related: Object.freeze(
          ranked
            .filter(
              (relationship) =>
                relationship.kind !== "nextStep" && relationship.kind !== "previousStep",
            )
            .map((relationship) => toEntry(relationship, "related")),
        ),
        seeAlso: Object.freeze(
          ranked
            .filter((relationship) => relationship.kind === "relatedTo")
            .map((relationship) => toEntry(relationship, "seeAlso")),
        ),
        sidebar: Object.freeze(sidebarFor(page, pages)),
      }),
    );
  }
  return navigation;
}

function resolveReadingOrder(
  pages: readonly PageDescriptor[],
  readingOrder: readonly string[] | undefined,
): readonly string[] {
  if (readingOrder !== undefined && readingOrder.length > 0) {
    return Object.freeze([...readingOrder]);
  }
  const stageOrder = [
    "discover",
    "understand",
    "install",
    "start",
    "learn",
    "apply",
    "reference",
    "troubleshoot",
    "extend",
    "maintain",
  ];
  return Object.freeze(
    [...pages]
      .sort((a, b) => {
        const stageDiff =
          (stageOrder.indexOf(a.stage ?? "reference") ?? 5) -
          (stageOrder.indexOf(b.stage ?? "reference") ?? 5);
        if (stageDiff !== 0) return stageDiff;
        return a.slug.localeCompare(b.slug);
      })
      .map((page) => page.slug),
  );
}

/** Breadcrumb slugs from the page's directory path. */
function breadcrumbsFor(
  page: PageDescriptor,
  bySlug: Map<string, PageDescriptor>,
): readonly string[] {
  const segments = page.path.split("/");
  segments.pop();
  const crumbs: string[] = [];
  let current = "";
  for (const segment of segments) {
    current = current.length > 0 ? `${current}/${segment}` : segment;
    const candidate = bySlug.get(current);
    if (candidate !== undefined) crumbs.push(candidate.slug);
  }
  return crumbs;
}

/** Sidebar entries: sibling pages under the same parent directory. */
function sidebarFor(
  page: PageDescriptor,
  pages: readonly PageDescriptor[],
): readonly NavigationEntry[] {
  const parent = parentDirectory(page.path);
  if (parent === undefined) return [];
  const siblings = pages.filter(
    (candidate) => candidate.slug !== page.slug && parentDirectory(candidate.path) === parent,
  );
  return Object.freeze(
    siblings.map((sibling) => ({
      from: page.slug,
      to: sibling.slug,
      position: "sidebar" as const,
      label: sibling.title,
      kind: "relatedTo" as const,
      weight: 0.5,
    })),
  );
}

function parentDirectory(path: string): string | undefined {
  const segments = path.split("/");
  segments.pop();
  return segments.length > 0 ? segments.join("/") : undefined;
}

function toEntry(
  relationship: DocumentationRelationship,
  position: NavigationEntry["position"],
): NavigationEntry {
  return Object.freeze({
    from: relationship.from,
    to: relationship.to,
    position,
    label: relationship.label,
    kind: relationship.kind,
    weight: relationship.weight,
  });
}
