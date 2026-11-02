/**
 * Canonical document normalization (Phase 3.3).
 *
 * Turns one user Markdown/MDX source file into a CanonicalDocument without
 * any source-code intelligence: no symbols, no graphs, no AI, no inference
 * beyond the file's own frontmatter and structure. `.md` files are parsed
 * with remark (+GFM); `.mdx` files additionally go through the safe MDX
 * parser (JSX preserved as data-only custom blocks, never executed).
 * User files are only read here — never written or moved.
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import type { Content as MdastContent, Root as MdastRoot } from "mdast";
import { toString as mdastToString } from "mdast-util-to-string";
import GithubSlugger from "github-slugger";
import readingTime from "reading-time";
import { dirname, basename } from "node:path";
import { parseFrontmatter } from "../content/parser/markdown.js";
import { parseMdx } from "../content/parser/mdx.js";
import type { IRBlock } from "../documentation/compiler/ir.js";
import type { Heading } from "../types/public.js";
import { DocsError } from "../errors/classes.js";
import { ErrorCode } from "../errors/codes.js";
import { mdastNodeToBlock } from "./blocks.js";
import { mapBlockText, rewriteMarkdownLinks } from "./links.js";
import type { CanonicalDocument, CanonicalLink, CanonicalPageKind, ContentAsset } from "./types.js";

export interface NormalizeDocumentInput {
  readonly absolutePath: string;
  /** Content-root-relative POSIX path including extension. */
  readonly relativePath: string;
  readonly raw: string;
  readonly gfm?: boolean;
  readonly blogDir?: string;
}

/** Normalize one source file into a canonical document (pure, no IO). */
export function normalizeDocument(input: NormalizeDocumentInput): CanonicalDocument {
  const { absolutePath, relativePath, raw } = input;
  const gfm = input.gfm ?? true;
  const blogDir = normalizeDirName(input.blogDir ?? "blog");
  const extension = relativePath.endsWith(".mdx") ? ".mdx" : ".md";

  const { data: frontmatter, body: rawBody } = parseFrontmatter(raw);
  const body = normalizeBody(rawBody);
  const tree = parseTree(absolutePath, body, extension, gfm);

  const slugger = new GithubSlugger();
  const headings: Heading[] = [];
  const links: CanonicalLink[] = [];
  const assets: ContentAsset[] = [];
  const docDir = dirname(relativePath);

  visitNodes(tree, (node) => {
    if (node.type === "heading") {
      const text = mdastToString(node).trim();
      if (text.length > 0) {
        const depth = Math.min(Math.max(node.depth, 1), 6) as 1 | 2 | 3 | 4 | 5 | 6;
        headings.push({ level: depth, text, id: slugger.slug(text) });
      }
      return;
    }
    if (node.type === "link" && typeof node.url === "string") {
      links.push(buildLink(node, docDir));
      return;
    }
    if (node.type === "image" && typeof node.url === "string") {
      assets.push(buildAsset(node.url, node.alt ?? undefined, node.title ?? undefined));
    }
  });

  const blocks = canonicalizeLinks(buildBlocks(absolutePath, body, extension, gfm), docDir);
  const slug = slugFor(relativePath);
  const kind = kindFor(slug, relativePath, blogDir, frontmatter.unknown);
  const title = titleFor(frontmatter.title, headings, relativePath);
  const description = descriptionFor(frontmatter.description, blocks);
  const stats = readingTime(body);
  // The author's literal `date:` scalar wins over gray-matter's cooked value:
  // YAML timestamp coercion overflows impossible dates (2026-13-99 becomes a
  // real Date), which would otherwise invent a publication date.
  const date = dateFor(frontmatter.unknown, dateLiteralFor(raw));

  return {
    id: slug,
    sourcePath: absolutePath,
    relativePath,
    route: slug === "index" ? "/" : `/${slug}`,
    kind,
    title,
    description,
    frontmatter: { ...frontmatter, ...frontmatter.unknown },
    body,
    blocks,
    headings,
    links,
    assets,
    order: orderFor(frontmatter),
    ...(authorFor(frontmatter.unknown) !== undefined
      ? { author: authorFor(frontmatter.unknown) }
      : {}),
    ...(date !== undefined ? { date } : {}),
    wordCount: stats.words,
    readingTimeMinutes: Math.max(1, Math.ceil(stats.minutes)),
  };
}

/** Parse body to an mdast tree (throws DocsError on invalid MDX). */
function parseTree(
  absolutePath: string,
  body: string,
  extension: ".md" | ".mdx",
  gfm: boolean,
): MdastRoot {
  try {
    const processor = unified().use(remarkParse);
    if (extension === ".mdx") processor.use(remarkMdx);
    if (gfm) processor.use(remarkGfm);
    return processor.parse(body) as MdastRoot;
  } catch (error) {
    throw new DocsError({
      code: ErrorCode.VALIDATION_FAILED,
      message: `Invalid ${extension === ".mdx" ? "MDX" : "Markdown"} in ${absolutePath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
}

/** Build content blocks: faithful converter for `.md`, safe MDX parser for `.mdx`. */
function buildBlocks(
  absolutePath: string,
  body: string,
  extension: ".md" | ".mdx",
  gfm: boolean,
): readonly IRBlock[] {
  if (extension === ".mdx") {
    // parseMdx preserves JSX as data-only custom blocks (never executed).
    return parseMdx(absolutePath, absolutePath, body, { gfm }).document.blocks.map((b) => b.block);
  }
  const tree = parseTree(absolutePath, body, extension, gfm);
  const blocks: IRBlock[] = [];
  for (const child of tree.children) {
    const block = mdastNodeToBlock(child);
    if (block !== undefined) blocks.push(block);
  }
  return blocks;
}

/** Depth-first mdast walk (does not descend into JSX subtrees for metadata). */
function visitNodes(tree: MdastRoot, visit: (node: MdastContent) => void): void {
  const walk = (node: MdastContent): void => {
    if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") return;
    visit(node);
    const children = (node as { children?: readonly MdastContent[] }).children;
    if (children !== undefined) {
      for (const child of children) walk(child);
    }
  };
  for (const child of tree.children) walk(child);
}

const EXTERNAL_URL = /^(https?:|data:|mailto:)/;

function buildLink(node: Extract<MdastContent, { type: "link" }>, docDir: string): CanonicalLink {
  const url = normalizeHref(node.url);
  const text = mdastToString(node).trim();
  const isExternal = EXTERNAL_URL.test(url) || url.startsWith("#") || url.startsWith("mailto:");
  if (isExternal) return { text, url, isExternal };
  const path = url.split("#")[0] ?? url;
  if (path.endsWith(".md") || path.endsWith(".mdx")) {
    return { text, url, isExternal, target: resolveTarget(docDir, url) };
  }
  return { text, url, isExternal };
}

/**
 * Canonicalize authored relative `.md`/`.mdx` links in block text to
 * content-root routes (`exit-codes.md` → `/cli/exit-codes`, `../index.md` →
 * `/index`). Renderers map these routes into their own URL space; external,
 * anchor, and non-Markdown links are left untouched.
 */
function canonicalizeLinks(blocks: readonly IRBlock[], docDir: string): readonly IRBlock[] {
  return mapBlockText(blocks, (text) =>
    rewriteMarkdownLinks(text, (url) => {
      const path = url.split("#")[0] ?? url;
      if (!path.endsWith(".md") && !path.endsWith(".mdx")) return undefined;
      const slug = resolveTarget(docDir, url);
      if (slug.length === 0) return undefined;
      return `/${slug}${url.slice(path.length)}`;
    }),
  );
}

/** Resolve an internal `.md`/`.mdx` href to a content-root-relative slug. */
function resolveTarget(docDir: string, url: string): string {
  const withoutFragment = url.split("#")[0] ?? url;
  const parts = (docDir === "." ? [] : docDir.split("/")).concat(withoutFragment.split("/"));
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      resolved.pop();
      continue;
    }
    resolved.push(part);
  }
  return resolved
    .join("/")
    .replace(/\.(md|mdx)$/, "")
    .replace(/\/index$/, "");
}

function buildAsset(url: string, alt?: string, title?: string): ContentAsset {
  const source = normalizeHref(url);
  return {
    source,
    alt: alt ?? "",
    ...(title !== undefined ? { title } : {}),
    local: !EXTERNAL_URL.test(source) && !source.startsWith("mailto:"),
  };
}

/** Normalize an href: slashes, leading `./`, whitespace. Content otherwise untouched. */
function normalizeHref(href: string): string {
  return href.replace(/\\/g, "/").replace(/^\.\//, "").trim();
}

/** Normalize body text: line endings, blank-run collapse, single trailing newline. */
function normalizeBody(body: string): string {
  return `${body
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
}

/** Slug from a content-root-relative path (`guide/index.md` → `guide/index`). */
export function slugFor(relativePath: string): string {
  const withoutExt = relativePath.replace(/\.(md|mdx)$/, "");
  if (withoutExt === "index") return "index";
  return withoutExt.replace(/\/index$/, "");
}

function kindFor(
  slug: string,
  relativePath: string,
  blogDir: string,
  unknown: Readonly<Record<string, unknown>> | undefined,
): CanonicalPageKind {
  const isRoot = !relativePath.includes("/");
  const override = unknown?.["kind"];
  if (override === "documentation" || override === "blog") return override;
  // "home" is reserved for the root index document (exactly one home page).
  if (override === "home" && isRoot && slug === "index") return "home";
  if (slug === "index" && isRoot) return "home";
  const top = relativePath.split("/")[0];
  if (top === blogDir) return "blog";
  return "documentation";
}

function titleFor(
  frontmatterTitle: string | undefined,
  headings: readonly Heading[],
  relativePath: string,
): string {
  if (frontmatterTitle !== undefined && frontmatterTitle.length > 0) return frontmatterTitle;
  const h1 = headings.find((h) => h.level === 1);
  if (h1 !== undefined) return h1.text;
  const base = basename(relativePath).replace(/\.(md|mdx)$/, "");
  if (base === "index") {
    const dir = basename(dirname(relativePath));
    if (dir === "." || dir === "") return "Home";
    return titleCase(dir);
  }
  return titleCase(base);
}

function titleCase(name: string): string {
  return name
    .split(/[-_]+/)
    .filter((part) => part.length > 0)
    .map((part) => (/^[A-Z0-9]+$/.test(part) ? part : part[0]!.toUpperCase() + part.slice(1)))
    .join(" ");
}

function descriptionFor(
  frontmatterDescription: string | undefined,
  blocks: readonly IRBlock[],
): string {
  if (frontmatterDescription !== undefined && frontmatterDescription.length > 0) {
    return frontmatterDescription;
  }
  const paragraph = blocks.find((b) => b.kind === "paragraph");
  if (paragraph === undefined || paragraph.kind !== "paragraph") return "";
  const text = paragraph.text
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_~[\]()>]/g, "")
    .trim();
  if (text.length <= 160) return text;
  // Truncate at a word boundary so descriptions never end mid-word.
  const cut = text.slice(0, 160);
  const lastSpace = cut.lastIndexOf(" ");
  return lastSpace >= 80 ? cut.slice(0, lastSpace).trimEnd() : cut.trimEnd();
}

function orderFor(frontmatter: { sidebar?: unknown; unknown?: unknown }): number {
  const sidebar = frontmatter.sidebar as { order?: unknown } | undefined;
  const unknown = frontmatter.unknown as Record<string, unknown> | undefined;
  const raw =
    (frontmatter as Record<string, unknown>)["order"] ?? sidebar?.order ?? unknown?.["order"];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

function dateFor(
  unknown: Readonly<Record<string, unknown>> | undefined,
  literal?: string,
): string | undefined {
  // The author's literal is authoritative: YAML timestamp coercion overflows
  // impossible dates before we ever see them (2026-13-99 arrives as a real
  // Date), so a cooked Date alone can never prove a valid publication date.
  if (literal !== undefined) {
    const text = literal.trim().replace(/^(['"])(.*)\1$/, "$2");
    return isCalendarDate(text.slice(0, 10)) && /^\d{4}-\d{2}-\d{2}/.test(text)
      ? text.slice(0, 10)
      : undefined;
  }
  const raw = unknown?.["date"];
  let text: string | undefined;
  // gray-matter parses unquoted dates into Date instances.
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    text = raw.toISOString().slice(0, 10);
  } else if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
    text = raw.slice(0, 10);
  } else {
    return undefined;
  }
  // Reject impossible calendar dates deterministically (no invention).
  return isCalendarDate(text) ? text : undefined;
}

/** Strict `YYYY-MM-DD` plus real-calendar round-trip check. */
function isCalendarDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [year = NaN, month = NaN, day = NaN] = text.split("-").map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  const check = new Date(Date.UTC(year, month - 1, day));
  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
  );
}

/**
 * Extract the author's literal `date:` scalar from the leading frontmatter
 * fence. Returns undefined when there is no fence or no `date:` key, so
 * callers fall back to the cooked frontmatter value.
 */
function dateLiteralFor(raw: string): string | undefined {
  const fence = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(raw);
  if (fence === null) return undefined;
  const line = /^\s*date\s*:\s*(.+?)\s*$/.exec(fence[1] ?? "");
  const value = line?.[1];
  return value === undefined || value.length === 0 ? undefined : value;
}

/** Author passthrough: non-empty strings only, never invented or coerced. */
function authorFor(unknown: Readonly<Record<string, unknown>> | undefined): string | undefined {
  const raw = unknown?.["author"];
  if (typeof raw === "string" && raw.trim().length > 0) return raw.trim();
  return undefined;
}

function normalizeDirName(dir: string): string {
  return dir.replace(/\\/g, "/").replace(/\/+$/, "").replace(/^\.\//, "").replace(/^\//, "");
}
