/**
 * Documentation Organizer.
 *
 * Turns a planned architecture into an optimized semantic hierarchy:
 * navigation tree, breadcrumbs, primary/secondary journeys, and
 * related-content wiring. Navigation derives from the architecture,
 * never from filesystem order.
 */

import type {
  DocumentationArchitecture,
  DocumentationLearningPath,
  DocumentationNavigation,
  DocumentationPersona,
  NavigationNode,
} from "./types.js";
import type { DocumentationRelationship } from "./types.js";

/** Maximum sidebar depth before diagnostics flag navigation complexity. */
export const MAX_NAVIGATION_DEPTH = 4;

/**
 * Build the full navigation model for an architecture.
 */
export function organizeNavigation(
  architecture: Pick<DocumentationArchitecture, "sections" | "pages" | "project">,
): DocumentationNavigation {
  const pageBySlug = new Map(architecture.pages.map((p) => [p.slug, p]));

  // Sidebar: sections → pages, split children nested under their parent.
  const sidebar: NavigationNode[] = [];
  for (const section of architecture.sections) {
    const children: NavigationNode[] = [];
    // Pass 1: top-level pages (excluding split children).
    for (const slug of section.pages) {
      const page = pageBySlug.get(slug);
      if (page === undefined || page.splitFrom !== undefined) continue;
      children.push({ label: page.title, slug: page.slug });
    }
    // Pass 2: nest split children under their parent.
    for (const slug of section.pages) {
      const page = pageBySlug.get(slug);
      if (page === undefined || page.splitFrom === undefined) continue;
      const parent = children.find((c) => c.slug === page.splitFrom);
      if (parent !== undefined) {
        (parent.children ??= []).push({ label: page.title, slug: page.slug });
      } else {
        children.push({ label: page.title, slug: page.slug });
      }
    }
    sidebar.push({ label: section.title, children });
  }

  // Primary journey follows the intent graph through existing pages.
  const primaryJourney = buildPrimaryJourney(pageBySlug);

  // Secondary journeys per persona (top persona first).
  const secondaryJourneys: Record<string, readonly string[]> = {};
  for (const { persona } of architecture.project.personas) {
    secondaryJourneys[persona] = journeyForPersona(persona, pageBySlug);
  }

  // Breadcrumbs: Documentation → Section → [Parent] → Page.
  // Adjacent duplicate labels collapse (section "Examples" + page "Examples"
  // must not render twice) and the current page is never self-linked.
  const breadcrumbs: Record<string, readonly { label: string; slug?: string }[]> = {};
  for (const page of architecture.pages) {
    const raw: { label: string; slug?: string }[] = [
      { label: "Documentation" },
      { label: titleOfSection(architecture.sections, page.sectionId), slug: undefined },
    ];
    if (page.splitFrom !== undefined) {
      raw.push({ label: titleOfPage(pageBySlug, page.splitFrom), slug: page.splitFrom });
    }
    raw.push({ label: page.title, slug: page.slug });
    const trail: { label: string; slug?: string }[] = [];
    for (const crumb of raw) {
      const prev = trail[trail.length - 1];
      if (prev !== undefined && prev.label === crumb.label) continue;
      trail.push(crumb);
    }
    const last = trail[trail.length - 1];
    if (last !== undefined) trail[trail.length - 1] = { label: last.label };
    breadcrumbs[page.slug] = trail;
  }

  return { sidebar, primaryJourney, secondaryJourneys, breadcrumbs };
}

/** Wire "related" links onto each page from relationship edges. */
export function wireRelatedContent(
  pageSlugs: readonly string[],
  relationships: readonly DocumentationRelationship[],
): Readonly<Record<string, readonly string[]>> {
  const known = new Set(pageSlugs);
  const related: Record<string, string[]> = {};
  for (const rel of relationships) {
    if (!known.has(rel.from) || !known.has(rel.to)) continue;
    (related[rel.from] ??= []).push(rel.to);
    if (rel.kind !== "prerequisite") {
      // Most relations are bidirectional in the UI; prerequisites are not.
      (related[rel.to] ??= []).push(rel.from);
    }
  }
  for (const key of Object.keys(related)) {
    related[key] = [...new Set(related[key] ?? [])];
  }
  return related;
}

/** Build learning paths from journeys + persona targets. */
export function buildLearningPaths(
  navigation: DocumentationNavigation,
  personas: readonly { persona: DocumentationPersona; priority: number }[],
): readonly DocumentationLearningPath[] {
  const paths: DocumentationLearningPath[] = [
    {
      name: "Primary Journey",
      description: "The main path from first contact to productive use.",
      steps: [...navigation.primaryJourney],
      persona: personas[0]?.persona ?? "developer",
    },
  ];
  for (const { persona } of personas.slice(1, 4)) {
    const steps = navigation.secondaryJourneys[persona];
    if (steps !== undefined && steps.length > 0) {
      paths.push({
        name: `${titleizePersona(persona)} Path`,
        description: `Focused path for ${persona.replace(/-/g, " ")}s.`,
        steps,
        persona,
      });
    }
  }
  return paths;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function buildPrimaryJourney(
  pageBySlug: Map<string, { slug: string; kinds: readonly string[]; sectionId: string }>,
): string[] {
  const INTENT_ORDER = [
    "introduction",
    "overview",
    "getting-started",
    "core-concepts",
    "concepts",
    "guides",
    "common-tasks",
    "configuration",
    "api",
    "api-reference",
    "commands-reference",
    "advanced",
    "migration",
    "troubleshooting",
  ];
  const journey: string[] = [];
  for (const candidate of INTENT_ORDER) {
    if (pageBySlug.has(candidate)) journey.push(candidate);
  }
  return journey;
}

function journeyForPersona(
  persona: DocumentationPersona,
  pageBySlug: Map<string, { slug: string; kinds: readonly string[] }>,
): string[] {
  const wants = (kinds: readonly string[]) => pageBySlug.get(kinds[0] ?? "") !== undefined;
  switch (persona) {
    case "end-user":
      return ["getting-started", "troubleshooting"].filter((s) => pageBySlug.has(s));
    case "api-consumer":
      return ["api", "api-reference", "configuration"].filter((s) => pageBySlug.has(s));
    case "plugin-author":
      return ["core-concepts", "concepts", "api-reference"].filter((s) => pageBySlug.has(s));
    case "operator":
      return ["setup", "configuration", "operations", "troubleshooting"].filter((s) =>
        pageBySlug.has(s),
      );
    case "maintainer":
    case "contributor":
      return ["architecture", "development", "publishing"].filter((s) => pageBySlug.has(s));
    default:
      return ["getting-started", "guides", "common-tasks", "api"].filter((s) => wants([s]));
  }
}

function titleOfSection(sections: readonly { id: string; title: string }[], id: string): string {
  return sections.find((s) => s.id === id)?.title ?? id;
}

function titleOfPage(pageBySlug: Map<string, { title: string }>, slug: string): string {
  return pageBySlug.get(slug)?.title ?? slug;
}

function titleizePersona(persona: string): string {
  return persona
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}
