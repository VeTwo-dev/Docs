import type { RelationshipKind } from "./kind.js";

/** Where a page appears in the documentation navigation. */
export type NavigationPosition =
  "sidebar" | "breadcrumbs" | "previous" | "next" | "related" | "seeAlso" | "contextualLinks";

/** The navigation positions supported by the engine. */
export const NAVIGATION_POSITIONS: readonly NavigationPosition[] = [
  "sidebar",
  "breadcrumbs",
  "previous",
  "next",
  "related",
  "seeAlso",
  "contextualLinks",
] as const;

/** A single navigation entry pointing from one page to another. */
export interface NavigationEntry {
  /** The page that hosts the entry. */
  readonly from: string;
  /** The page the entry points to. */
  readonly to: string;
  /** Where the entry appears. */
  readonly position: NavigationPosition;
  /** Display label. */
  readonly label: string;
  /** The relationship kind backing the entry. */
  readonly kind: RelationshipKind;
  /** Ranking weight (0..1). */
  readonly weight: number;
}

/** The complete navigation model for one page. */
export interface PageNavigation {
  /** The page slug this navigation belongs to. */
  readonly page: string;
  /** The previous page (linear reading order). */
  readonly previous?: string;
  /** The next page (linear reading order). */
  readonly next?: string;
  /** Breadcrumb ancestors, outermost first. */
  readonly breadcrumbs: readonly string[];
  /** Related pages, most relevant first. */
  readonly related: readonly NavigationEntry[];
  /** See-also entries. */
  readonly seeAlso: readonly NavigationEntry[];
  /** Sidebar sibling entries. */
  readonly sidebar: readonly NavigationEntry[];
}

/** Whether a string is a valid navigation position. */
export function isNavigationPosition(value: string): value is NavigationPosition {
  return (NAVIGATION_POSITIONS as readonly string[]).includes(value);
}
