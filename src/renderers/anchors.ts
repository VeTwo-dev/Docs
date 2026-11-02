/**
 * Heading anchors for rendered documentation.
 *
 * The Fumadocs target and the legacy Markdown pipeline both derive heading
 * ids with `github-slugger`. The static HTML renderer uses the same algorithm
 * so a `#fragment` link resolves to the same anchor in every target.
 */

import GithubSlugger from "github-slugger";

/**
 * Reduce inline Markdown to its plain text, the way a heading's rendered text
 * reads. Links keep their label, code keeps its content, emphasis markers are
 * dropped.
 */
export function inlinePlainText(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** A per-page slug generator that de-duplicates repeated headings. */
export type HeadingSlugger = (text: string) => string;

/** Create a heading slug generator for a single page. */
export function createHeadingSlugger(): HeadingSlugger {
  const slugger = new GithubSlugger();
  return (text: string) => slugger.slug(inlinePlainText(text));
}
