/** Context used to render Markdown workspace placeholders. */
export interface MarkdownTemplateContext {
  readonly projectName: string;
}

/** Build the `md/README.md` placeholder. */
export function buildMarkdownReadme(ctx: MarkdownTemplateContext): string {
  return [
    `# ${ctx.projectName} — Canonical Documentation`,
    "",
    "This is the canonical Markdown/MDX documentation workspace. Write the",
    "source of truth for documentation here; the renderer consumes it and the",
    "static output under `static/` is generated from it.",
    "",
    "## Conventions",
    "",
    "- One page per file; use kebab-case file names.",
    "- Include a title and description in each page's frontmatter.",
    "- Use relative links between pages.",
    "- Prefer `.mdx` when a page needs components.",
    "",
  ].join("\n");
}
