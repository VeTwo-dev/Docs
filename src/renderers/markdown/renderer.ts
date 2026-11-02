/**
 * Markdown/MDX Renderer (Phase 22.2).
 *
 * Owns `md/` exclusively. Emits one deterministic `.md` (plain Markdown) or
 * `.mdx` file per planned page with frontmatter, using the output plan for
 * identity and relative links. Never emits Next.js or static files.
 *
 * `.md` mode degrades custom IR API blocks (`ApiSignature`,
 * `ParameterTable`, …) to portable Markdown (headings, code, tables, lists)
 * so the output contains no JSX. `.mdx` mode preserves the historical JSX
 * custom-component serialization.
 */

import type { DocumentationIR, IRBlock } from "../../documentation/compiler/ir.js";
import type { RenderedFile, RenderedSite, SiteRenderer, SiteRendererOptions } from "../types.js";
import { serializeBlocks } from "../mdx.js";
import { renderCustomMarkdown } from "../api-markdown.js";
import {
  buildOutputPlan,
  relatedPageTargets,
  resolveDocumentationLink,
  rewriteBlockLinks,
} from "../output-plan.js";

export interface MarkdownRendererOptions extends SiteRendererOptions {
  /**
   * File extension (and content flavor) for `md/` pages. Defaults to
   * `".mdx"` (historical). Use `".md"` for plain-Markdown output.
   */
  readonly markdownExtension?: ".md" | ".mdx";
}

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
 * Serialize blocks to portable plain Markdown, routing custom IR API blocks
 * through the shared API transform (headings, code, tables, lists — no JSX).
 */
export function toPlainMarkdown(blocks: readonly IRBlock[]): string {
  return blocks
    .map((block) => {
      if (block.kind === "custom") {
        return renderCustomMarkdown(
          block.component,
          (block.props ?? {}) as Record<string, unknown>,
        );
      }
      return serializeBlocks([block]);
    })
    .filter((s) => s.trim().length > 0)
    .join("\n\n");
}

/**
 * Renders the Documentation IR to Markdown/MDX files (one per planned page).
 *
 * @param ir - Compiled Documentation IR (sole content input).
 * @param options - Site name, description, docs base path and md extension.
 * @returns Rendered site with md-relative file paths.
 */
export function renderMarkdownSite(
  ir: DocumentationIR,
  options: MarkdownRendererOptions = {},
): RenderedSite {
  const ext = options.markdownExtension ?? ".mdx";
  const plain = ext === ".md";
  const plan = buildOutputPlan(ir, {
    workspaceRoot: "",
    docsBasePath: options.docsBasePath,
    markdownExtension: ext,
  });

  const files: RenderedFile[] = plan.pages.map((planned) => {
    const page = planned.page;
    // Rewrite internal symbol cross-links is out of scope; resolve related-page links.
    const related = relatedPageTargets(plan, page).flatMap((target) => {
      const href = resolveDocumentationLink(plan, page.slug, target.slug, "markdown");
      return href !== undefined ? [`- [${target.slug}](${href})`] : [];
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
    // Resolve authored relative links to their planned `md/` counterparts
    // (e.g. `../troubleshooting/index.md` → `../troubleshooting.md`).
    const linked = rewriteBlockLinks(blocks, plan, page.slug, "markdown");
    const body = plain ? toPlainMarkdown(linked) : serializeBlocks(linked);
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
      plan.homeSlug !== undefined
        ? plan.pagesBySlug.get(plan.homeSlug)!.mdPath
        : ext === ".md"
          ? "index.md"
          : "index.mdx",
  };
}
