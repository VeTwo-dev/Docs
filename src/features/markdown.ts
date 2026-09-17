import type { DocPage, Heading, PageLink } from "../types/public.js";
import type { BuildContextMutable } from "../types/internal.js";
import type { DocsConfig } from "../config/types.js";
import { readFile, isMarkdown, generateId } from "../filesystem/index.js";
import matter from "gray-matter";
import { unified, type Processor, type Plugin, type Transformer } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import remarkDirective from "remark-directive";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import GithubSlugger from "github-slugger";
import readingTime from "reading-time";
import { relative, dirname } from "node:path";

const slugger = new GithubSlugger();

/**
 * Creates a unified markdown-to-HTML processor with the full plugin chain:
 * remark-parse → remark-gfm → remark-frontmatter → remark-directive →
 * remark-rehype → rehype-slug → rehype-autolink-headings → rehype-stringify
 *
 * Custom rehype/remark plugins from config are injected at the appropriate stages.
 * Shiki syntax highlighting is added via rehype-pretty-code when enabled.
 *
 * @param config - The documentation config for plugin resolution.
 * @returns A configured unified processor pipeline.
 */
export function createMarkdownProcessor(config?: DocsConfig): Processor {
  const mdConfig = config?.markdown;
  const syntaxHighlighting = mdConfig?.syntaxHighlighting ?? true;
  const headerIds = mdConfig?.headerIds ?? true;

  // Build the pipeline incrementally — each .use() changes the unified
  // generic params so we use unknown casts between steps.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let p: any = unified()
    .use(remarkParse)
    .use(remarkGfm, {
      ...(mdConfig?.gfm === false ? { singleTilde: true } : {}),
    })
    .use(remarkFrontmatter)
    .use(remarkDirective);

  if (mdConfig?.mdx) {
    const remarkMdx = requireSafe("remark-mdx") as Plugin | undefined;
    if (remarkMdx) {
      p = p.use(remarkMdx);
    }
  }

  if (mdConfig?.breaks) {
    const remarkBreaks = requireSafe("remark-breaks") as Plugin | undefined;
    if (remarkBreaks) {
      p = p.use(remarkBreaks);
    }
  }

  if (mdConfig?.smartypants) {
    const remarkSmartypants = requireSafe("remark-smartypants") as Plugin | undefined;
    if (remarkSmartypants) {
      p = p.use(remarkSmartypants);
    }
  }

  if (syntaxHighlighting) {
    const rehypePrettyCode = requireSafe("rehype-pretty-code") as
      ((options: { theme: string; keepBackground: boolean }) => Transformer) | undefined;
    if (rehypePrettyCode) {
      const prettyCodeOptions: Record<string, unknown> = {
        theme: "github-dark",
        keepBackground: false,
      };

      const transformers: unknown[] = [];
      if (mdConfig?.lineHighlighting || mdConfig?.diffHighlighting || mdConfig?.focusRegions) {
        const shikiTransformers = requireSafe("@shikijs/transformers") as
          | {
              transformerLineHighlighting?: () => Transformer;
              transformerDiffHighlight?: () => Transformer;
              transformerFocusHighlight?: () => Transformer;
            }
          | undefined;
        if (shikiTransformers) {
          if (mdConfig.lineHighlighting && shikiTransformers.transformerLineHighlighting) {
            transformers.push(shikiTransformers.transformerLineHighlighting());
          }
          if (mdConfig.diffHighlighting && shikiTransformers.transformerDiffHighlight) {
            transformers.push(shikiTransformers.transformerDiffHighlight());
          }
          if (mdConfig.focusRegions && shikiTransformers.transformerFocusHighlight) {
            transformers.push(shikiTransformers.transformerFocusHighlight());
          }
        }
      }

      if (transformers.length > 0) {
        prettyCodeOptions["transformers"] = transformers;
      }

      p = p.use(rehypePrettyCode, prettyCodeOptions);
    }
  }

  p = p.use(remarkRehype);

  if (mdConfig?.raw) {
    const rehypeRaw = requireSafe("rehype-raw") as Plugin | undefined;
    if (rehypeRaw) {
      p = p.use(rehypeRaw);
    }
  }

  if (headerIds) {
    p = p.use(rehypeSlug);
    const rehypeAutolink = requireSafe("rehype-autolink-headings") as
      ((options: { behavior: string }) => Transformer) | undefined;
    if (rehypeAutolink) {
      p = p.use(rehypeAutolink, {
        behavior: "wrap",
      });
    }
  }

  if (mdConfig?.document) {
    const rehypeDocument = requireSafe("rehype-document") as Plugin | undefined;
    if (rehypeDocument) {
      p = p.use(rehypeDocument);
    }
  }

  p = p.use(rehypeStringify);

  return p;
}

function requireSafe(name: string): unknown {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(name);
    // ESM modules transpiled to CJS may export as { default: fn }
    return mod?.default ?? mod;
  } catch {
    return undefined;
  }
}

/**
 * Generates a table of contents HTML string from headings.
 *
 * @param headings - The extracted headings array.
 * @param maxDepth - Maximum heading depth to include (default: 3).
 * @returns HTML string for a table of contents.
 */
export function generateToc(headings: readonly Heading[], maxDepth: number = 3): string {
  const filtered = headings.filter((h) => h.level >= 2 && h.level <= maxDepth);
  if (filtered.length === 0) return "";

  let html = '<nav class="toc" aria-label="Table of Contents">\n<h2>On This Page</h2>\n<ul>\n';
  let prevLevel = 2;

  for (const heading of filtered) {
    if (heading.level > prevLevel) {
      for (let i = prevLevel; i < heading.level; i++) {
        html += "<ul>\n";
      }
    } else if (heading.level < prevLevel) {
      for (let i = heading.level; i < prevLevel; i++) {
        html += "</ul>\n";
      }
    }
    html += `<li><a href="#${heading.id}">${escapeToc(heading.text)}</a></li>\n`;
    prevLevel = heading.level;
  }

  for (let i = 2; i < prevLevel; i++) {
    html += "</ul>\n";
  }
  html += "</ul>\n</nav>";
  return html;
}

function escapeToc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Processes a raw markdown directive container (:::callout, :::tabs, etc.)
 * into HTML component markup that the output renderer can handle.
 */
function processDirectives(html: string): string {
  return html.replace(
    /<div class="callout" data-type="([^"]*)"(?: data-title="([^"]*)")?>([\s\S]*?)<\/div>/g,
    (_match, type: string, title: string | undefined, content: string) => {
      const titleHtml = title ? `<div class="callout-title"><strong>${title}</strong></div>` : "";
      return `<div class="callout callout-${type}">${titleHtml}<div class="callout-content">${content}</div></div>`;
    },
  );
}

function extractHeadings(html: string): readonly Heading[] {
  const headings: Heading[] = [];
  const regex = /<h([1-6])\s+(?:id="([^"]*)")?[^>]*>([\s\S]*?)<\/h[1-6]>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const text = (match[3] ?? "").replace(/<[^>]+>/g, "").trim();
    headings.push({
      level: Number(match[1]) as 1 | 2 | 3 | 4 | 5 | 6,
      id: match[2] ?? slugger.slug(text),
      text,
    });
  }
  return headings;
}

function extractLinks(html: string): readonly PageLink[] {
  const links: PageLink[] = [];
  const regex = /<a\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    links.push({
      url: match[1] ?? "",
      text: (match[2] ?? "").replace(/<[^>]+>/g, "").trim(),
      isExternal: /^(https?|mailto):/.test(match[1] ?? ""),
    });
  }
  return links;
}

function generateSlug(filePath: string, sourceDir: string): string {
  const rel = relative(sourceDir, filePath);
  const name = rel.replace(/\.(md|mdx)$/, "").replace(/\/index$/, "");
  return `/${name}`;
}

function generatePageId(filePath: string, rootDir: string): string {
  return generateId(filePath, rootDir);
}

function extractTitleFromContent(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1] ?? "Untitled";
}

function extractDescriptionFromContent(content: string): string {
  const withoutTitle = content.replace(/^#\s+.+$/m, "").trim();
  const firstParagraph = withoutTitle.split("\n\n")[0] ?? "";
  const text = firstParagraph
    .replace(/<[^>]+>/g, "")
    .replace(/[#*_`~[\]()>]/g, "")
    .trim();
  return text.slice(0, 160);
}

/**
 * Processes all markdown source files in the build context, parsing frontmatter,
 * rendering HTML via the unified/remark/rehype pipeline with syntax highlighting,
 * extracting headings and links, computing reading time, generating TOC,
 * and populating `ctx.pages`.
 *
 * @param ctx - The mutable build context containing source files and configuration.
 */
export async function processMarkdownFiles(ctx: BuildContextMutable): Promise<void> {
  const pages: DocPage[] = [];
  const sourceDir = ctx.config.source;
  const rootDir = ctx.rootDir;
  const processor = createMarkdownProcessor(ctx.config);
  const tocEnabled = ctx.config.markdown.toc;
  const tocDepth = ctx.config.markdown.tocDepth;

  slugger.reset();

  for (const sourceFile of ctx.sourceFiles) {
    if (!isMarkdown(sourceFile.path)) continue;

    try {
      const rawContent = readFile(sourceFile.path);
      const { data: frontmatter, content } = matter(rawContent);
      const file = await processor.process(content);
      let html = String(file);

      // Process directive-based components into HTML
      html = processDirectives(html);

      const headings = extractHeadings(html);
      const links = extractLinks(html);

      // Prepend TOC if enabled
      if (tocEnabled) {
        const toc = generateToc(headings, tocDepth);
        if (toc) {
          html = toc + "\n" + html;
        }
      }

      const stats = readingTime(content);

      const page: DocPage = {
        id: generatePageId(sourceFile.path, rootDir),
        title: (frontmatter["title"] as string) ?? extractTitleFromContent(content),
        description:
          (frontmatter["description"] as string) ?? extractDescriptionFromContent(content),
        slug: generateSlug(sourceFile.path, sourceDir),
        filePath: sourceFile.path,
        relativePath: relative(rootDir, sourceFile.path),
        category:
          (frontmatter["category"] as string) ??
          dirname(relative(sourceDir, sourceFile.path)).split("/")[0] ??
          "general",
        order: (frontmatter["order"] as number) ?? 0,
        content: html,
        frontmatter,
        headings,
        links,
        wordCount: stats.words,
        readingTimeMinutes: Math.max(1, Math.ceil(stats.minutes)),
        lastModified: sourceFile.lastModified,
      };

      pages.push(page);
    } catch (error) {
      ctx.errors.push({
        code: "MARKDOWN_PARSE_ERROR",
        message: `Failed to parse ${sourceFile.path}: ${error instanceof Error ? error.message : String(error)}`,
        filePath: sourceFile.path,
      });
    }
  }

  (ctx as { pages: DocPage[] }).pages = pages.sort(
    (a, b) => a.category.localeCompare(b.category) || a.order - b.order,
  );
}
