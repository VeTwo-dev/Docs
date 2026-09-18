/**
 * Markdown/MDX Renderer (Phase 22.2).
 *
 * Owns `md/` exclusively. Emits one deterministic `.mdx` file per planned
 * page with frontmatter, using the output plan for identity and relative
 * links. Never emits Next.js or static implementation files.
 */

import type { DocumentationIR } from "../../documentation/compiler/ir.js";
import type { RenderedFile, RenderedSite, SiteRenderer, SiteRendererOptions } from "../types.js";
import { serializeBlocks } from "../mdx.js";
import { buildOutputPlan, resolveDocumentationLink } from "../output-plan.js";

export type MarkdownRendererOptions = SiteRendererOptions;

/**
 * Creates the Markdown/MDX site renderer (owns the md/ output root).
 *
 * @returns Site renderer for the markdown target.
 */
export function createMarkdownRenderer(): SiteRenderer<MarkdownRendererOptions> {
  return {
    target: "markdown",
    render(ir, options = {}) {
      return renderMarkdownSite(ir, options);
    },
  };
}

/**
 * Renders the Documentation IR to Markdown/MDX files (one per planned page).
 *
 * @param ir - Compiled Documentation IR (sole content input).
 * @param options - Site name, description and docs base path.
 * @returns Rendered site with md-relative file paths.
 */
export function renderMarkdownSite(
  ir: DocumentationIR,
  options: MarkdownRendererOptions = {},
): RenderedSite {
  const plan = buildOutputPlan(ir, { workspaceRoot: "", docsBasePath: options.docsBasePath });

  const files: RenderedFile[] = plan.pages.map((planned) => {
    const page = planned.page;
    // Rewrite internal symbol cross-links is out of scope; resolve related-page links.
    const related = page.references
      .filter((ref) => ref.targetSlug !== undefined)
      .flatMap((ref) => {
        const href = resolveDocumentationLink(plan, page.slug, ref.targetSlug!, "markdown");
        return href !== undefined ? [`- [${ref.targetSlug}](${href})`] : [];
      });

    const frontmatter =
      `---\n` +
      `title: ${JSON.stringify(page.title)}\n` +
      (page.description !== undefined && page.description.length > 0
        ? `description: ${JSON.stringify(page.description)}\n`
        : "") +
      `section: ${JSON.stringify(planned.sectionTitle)}\n` +
      `slug: ${JSON.stringify(page.slug)}\n` +
      `generator: "@vetwo/docs"\n` +
      `---\n\n`;

    // The IR conventionally starts pages with an H1 title + summary paragraph;
    // the template already emits those, so drop the duplicates (no double H1).
    let blocks = page.blocks;
    if (blocks[0]?.kind === "heading" && blocks[0].level === 1 && blocks[0].text === page.title) {
      blocks = blocks.slice(1);
      if (
        page.description !== undefined &&
        blocks[0]?.kind === "paragraph" &&
        blocks[0].text === page.description
      ) {
        blocks = blocks.slice(1);
      }
    }
    const body = serializeBlocks(blocks);
    const relatedSection = related.length > 0 ? `\n\n## Related\n\n${related.join("\n")}\n` : "";
    return {
      path: planned.mdPath,
      contents: `${frontmatter}# ${page.title}\n\n${page.description !== undefined && page.description.length > 0 ? `${page.description}\n\n` : ""}${body}${relatedSection}`,
    };
  });

  return {
    target: "markdown",
    files,
    routes: plan.pages.map((p) => ({
      slug: p.slug,
      route: p.route,
      title: p.title,
      sectionId: p.sectionId,
      sectionTitle: p.sectionTitle,
    })),
    entrypoint:
      plan.homeSlug !== undefined ? plan.pagesBySlug.get(plan.homeSlug)!.mdPath : "index.mdx",
  };
}
