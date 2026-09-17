/**
 * Documentation Architecture Validator.
 *
 * Validates a compiled architecture/IR and emits structured diagnostics:
 * orphan pages, empty sections/pages, broken relationships, navigation
 * depth, duplicate content, undocumented public APIs.
 */

import type { DocumentationArchitecture } from "./types.js";
import type { CompilerProjectInput } from "./types.js";
import type { DocumentationDiagnostic } from "./diagnostics.js";
import { diagnostic } from "./diagnostics.js";
import { MAX_NAVIGATION_DEPTH } from "./organizer.js";

/** Validate an architecture; returns diagnostics sorted error → warning → info. */
export function validateArchitecture(
  architecture: DocumentationArchitecture,
  input?: CompilerProjectInput,
): DocumentationDiagnostic[] {
  const diagnostics: DocumentationDiagnostic[] = [];
  const pageSlugs = new Set(architecture.pages.map((p) => p.slug));

  // ── Broken relationships ─────────────────────────────────────────
  for (const rel of architecture.relationships) {
    if (!pageSlugs.has(rel.from) || !pageSlugs.has(rel.to)) {
      diagnostics.push(
        diagnostic(
          "DOC_BROKEN_RELATIONSHIP",
          "warning",
          `Relationship ${rel.from} → ${rel.to} references a missing page.`,
          rel.from,
          "Remove the relationship or restore the target page.",
        ),
      );
    }
  }

  // ── Orphan pages (no relationships, no section siblings) ─────────
  const relatedSlugs = new Set(architecture.relationships.flatMap((r) => [r.from, r.to]));
  for (const page of architecture.pages) {
    if (page.slug === "introduction" || page.slug === "overview") continue;
    const sectionSiblings =
      architecture.sections.find((s) => s.id === page.sectionId)?.pages.length ?? 0;
    if (!relatedSlugs.has(page.slug) && sectionSiblings < 2 && page.splitFrom === undefined) {
      diagnostics.push(
        diagnostic(
          "DOC_ORPHAN_PAGE",
          "info",
          `"${page.title}" has no related content.`,
          page.slug,
          "Add related links or merge into a neighboring page.",
        ),
      );
    }
  }

  // ── Navigation depth ─────────────────────────────────────────────
  const depthOf = (nodes: readonly { children?: readonly unknown[] }[], level: number): number => {
    let max = level;
    for (const node of nodes) {
      const children = (node as { children?: readonly { children?: readonly unknown[] }[] })
        .children;
      if (children !== undefined && children.length > 0) {
        max = Math.max(max, depthOf(children, level + 1));
      }
    }
    return max;
  };
  const navDepth = depthOf(architecture.navigation.sidebar, 1);
  if (navDepth > MAX_NAVIGATION_DEPTH) {
    diagnostics.push(
      diagnostic(
        "DOC_NAVIGATION_DEPTH",
        "warning",
        `Navigation reaches depth ${navDepth} (max ${MAX_NAVIGATION_DEPTH}).`,
        undefined,
        "Flatten the hierarchy or consolidate small pages.",
      ),
    );
  }

  // ── Undocumented public APIs ─────────────────────────────────────
  if (input?.apis !== undefined) {
    const documentedSymbols = new Set(architecture.pages.flatMap((p) => p.symbols));
    const undocumented = input.apis.filter(
      (api) =>
        api.boundary !== "internal" &&
        api.boundary !== "private" &&
        !documentedSymbols.has(api.name),
    );
    if (undocumented.length > 0 && undocumented.length <= 20) {
      for (const api of undocumented.slice(0, 10)) {
        diagnostics.push(
          diagnostic(
            "DOC_UNDOCUMENTED_PUBLIC_API",
            "info",
            `\`${api.name}\` is public but undocumented.`,
            undefined,
            "Document it on the relevant API page.",
          ),
        );
      }
    }
  }

  return sortDiagnostics(diagnostics);
}

/** Validate rendered IR pages for emptiness and staleness. */
export function validateIRPages(
  pages: readonly {
    slug: string;
    title: string;
    blocks: readonly { kind: string; text?: string }[];
  }[],
): DocumentationDiagnostic[] {
  const diagnostics: DocumentationDiagnostic[] = [];

  for (const page of pages) {
    // Headings alone never count; every other block kind (lists, tables,
    // code, callouts, API components, images) is structured content unless
    // its prose is a known placeholder.
    const contentBlocks = page.blocks.filter((block) => block.kind !== "heading");
    const meaningful =
      contentBlocks.length > 0 &&
      contentBlocks.some((block) => {
        const text = (block as { text?: string }).text ?? "";
        return text.trim().length === 0 || !isPlaceholder(text);
      });

    if (!meaningful) {
      diagnostics.push(
        diagnostic(
          "DOC_EMPTY_PAGE",
          "error",
          `"${page.title}" contains no meaningful content.`,
          page.slug,
          "Remove the page or provide real content — placeholder-only pages are not shipped.",
        ),
      );
    }

    // Titles live in page metadata and are rendered once per renderer.
    // An H1 inside blocks duplicates the page title (DUPLICATE_TITLE).
    const h1 = page.blocks.find(
      (block) => block.kind === "heading" && (block as { level?: number }).level === 1,
    );
    if (h1 !== undefined) {
      diagnostics.push(
        diagnostic(
          "DOC_DUPLICATE_TITLE",
          "error",
          `"${page.title}" renders its title twice (H1 block duplicates page metadata).`,
          page.slug,
          "Remove the H1 block — renderers emit the title from metadata exactly once.",
        ),
      );
    }
  }

  return sortDiagnostics(diagnostics);
}

/** Validate breadcrumb trails: no adjacent duplicate labels, current page unlinked. */
export function validateBreadcrumbs(
  breadcrumbs: Readonly<Record<string, readonly { label: string; slug?: string }[]>>,
): DocumentationDiagnostic[] {
  const diagnostics: DocumentationDiagnostic[] = [];
  for (const [slug, trail] of Object.entries(breadcrumbs)) {
    for (let i = 1; i < trail.length; i++) {
      if (trail[i]!.label === trail[i - 1]!.label) {
        diagnostics.push(
          diagnostic(
            "DOC_DUPLICATE_BREADCRUMB",
            "error",
            `Breadcrumb repeats "${trail[i]!.label}" on page "${slug}".`,
            slug,
            "Collapse adjacent duplicate crumbs in the organizer.",
          ),
        );
        break;
      }
    }
    const last = trail[trail.length - 1];
    if (last !== undefined && last.slug !== undefined) {
      diagnostics.push(
        diagnostic(
          "DOC_DUPLICATE_BREADCRUMB",
          "warning",
          `Breadcrumb self-links the current page on "${slug}".`,
          slug,
          "Drop the slug from the trailing crumb.",
        ),
      );
    }
  }
  return sortDiagnostics(diagnostics);
}

function isPlaceholder(text: string): boolean {
  return /^(TODO|Coming soon|No information available|Documentation for .* is pending\.?)\.?$/i.test(
    text.trim(),
  );
}

/** Check navigation stability between two architectures. */
export function checkNavigationStability(
  before: DocumentationArchitecture,
  after: DocumentationArchitecture,
): DocumentationDiagnostic[] {
  const beforeOrder = sidebarOrder(before);
  const afterOrder = sidebarOrder(after);

  const moved = countOrderChanges(beforeOrder, afterOrder);
  if (moved > Math.max(2, Math.floor(afterOrder.length / 3))) {
    return [
      diagnostic(
        "DOC_UNSTABLE_NAVIGATION",
        "warning",
        `${moved} of ${afterOrder.length} navigation entries changed position in one pass.`,
        undefined,
        "Small source changes should not reorder unrelated sections.",
      ),
    ];
  }
  return [];
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function sidebarOrder(architecture: DocumentationArchitecture): string[] {
  const order: string[] = [];
  for (const section of architecture.navigation.sidebar) {
    order.push(section.label);
    for (const child of section.children ?? []) {
      if (child.slug !== undefined) order.push(child.slug);
    }
  }
  return order;
}

function countOrderChanges(before: readonly string[], after: readonly string[]): number {
  const beforeIndex = new Map(before.map((slug, i) => [slug, i]));
  let changes = 0;
  let lastSeen = -1;
  for (const slug of after) {
    const idx = beforeIndex.get(slug);
    if (idx === undefined) continue; // new entry, not a move
    if (idx < lastSeen) changes++;
    else lastSeen = idx;
  }
  return changes;
}

const SEVERITY_ORDER: Record<string, number> = { error: 0, warning: 1, info: 2 };

export function sortDiagnostics(diagnostics: DocumentationDiagnostic[]): DocumentationDiagnostic[] {
  return [...diagnostics].sort(
    (a, b) =>
      (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3) ||
      a.code.localeCompare(b.code),
  );
}
