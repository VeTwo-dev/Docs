/**
 * Markdown Parser.
 *
 * Parses user-authored Markdown (GFM where configured) into authored
 * documents with IR-compatible blocks, frontmatter, and lock regions.
 * Uses remark — no hand-rolled parsing.
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import matter from "gray-matter";
import { toString as mdastToString } from "mdast-util-to-string";
import type {
  AuthoredDocument,
  DocumentationContentOwnership,
  LockRegion,
  PageFrontmatter,
} from "../types.js";
import type { IRBlock } from "../../documentation/compiler/ir.js";

/** Parse frontmatter and body from a raw document. */
export function parseFrontmatter(raw: string): {
  data: PageFrontmatter;
  unknown: Readonly<Record<string, unknown>>;
  body: string;
} {
  const parsed = matter(raw);
  const {
    title,
    description,
    sidebar,
    protected: isProtected,
    aliases,
    locale,
    custom,
    ...unknown
  } = parsed.data as Record<string, unknown>;

  const frontmatter: PageFrontmatter = {
    ...(typeof title === "string" ? { title } : {}),
    ...(typeof description === "string" ? { description } : {}),
    ...(isSidebarConfig(sidebar) ? { sidebar } : {}),
    ...(isProtected === true ? { protected: true } : {}),
    ...(Array.isArray(aliases)
      ? { aliases: aliases.filter((a): a is string => typeof a === "string") }
      : {}),
    ...(typeof locale === "string" ? { locale } : {}),
    ...(isRecord(custom) ? { custom } : {}),
    ...(Object.keys(unknown).length > 0 ? { unknown } : {}),
  };

  return { data: frontmatter, unknown, body: parsed.content.trim() };
}

/** Extract `@vetwo:lock` regions from raw source. */
export function extractLocks(raw: string): readonly LockRegion[] {
  const locks: LockRegion[] = [];
  const open = "<!-- @vetwo:lock -->";
  const close = "<!-- /@vetwo:lock -->";

  let searchFrom = 0;
  while (true) {
    const start = raw.indexOf(open, searchFrom);
    if (start === -1) break;
    const endMarkerStart = raw.indexOf(close, start + open.length);
    if (endMarkerStart === -1) break; // unterminated lock — ignore
    locks.push({
      start,
      end: endMarkerStart + close.length,
      reason: "locked region",
    });
    searchFrom = endMarkerStart + close.length;
  }
  return locks;
}

/**
 * Parse a Markdown document into an {@link AuthoredDocument}.
 * Ownership of all authored blocks is `user-authored` unless the page
 * itself is generated (caller overrides).
 */
export function parseMarkdown(
  path: string,
  slug: string,
  raw: string,
  options: { gfm?: boolean; ownership?: DocumentationContentOwnership } = {},
): AuthoredDocument {
  const { data: frontmatter, body } = parseFrontmatter(raw);
  const locks = extractLocks(raw);

  const processor = unified().use(remarkParse);
  if (options.gfm !== false) processor.use(remarkGfm);
  const tree = processor.parse(body);

  const mutableBlocks: {
    index: number;
    block: IRBlock;
    ownership: DocumentationContentOwnership;
  }[] = [];
  let index = 0;
  for (const node of tree.children) {
    const block = mdastToBlock(node);
    if (block !== undefined) {
      mutableBlocks.push({
        index: index++,
        block,
        ownership: options.ownership ?? "user-authored",
      });
    }
  }
  const blocks = mutableBlocks;

  return {
    path,
    slug,
    frontmatter,
    blocks,
    locks,
    provenance: {
      source: "user",
      sourceReferences: [],
      fingerprint: fingerprintOf(mutableBlocks.map((b) => b.block)),
    },
    componentUsages: [],
  };
}

// ─── mdast → IRBlock ─────────────────────────────────────────────────────

import type { Content as MdastContent } from "mdast";

/** Convert one mdast node to an IRBlock (shared with the MDX parser). */
export function mdastToBlock(node: MdastContent): IRBlock | undefined {
  switch (node.type) {
    case "heading": {
      const text = mdastToString(node).trim();
      if (text.length === 0) return undefined; // empty heading dropped
      const level = Math.min(Math.max(node.depth, 1), 3) as 1 | 2 | 3;
      return { kind: "heading", level, text };
    }
    case "paragraph": {
      // A paragraph that is only an image becomes a custom image component.
      if (
        node.children.length === 1 &&
        node.children[0] !== undefined &&
        node.children[0].type === "image"
      ) {
        const image = node.children[0];
        if (image.url !== undefined && typeof image.url === "string") {
          return {
            kind: "custom",
            component: "Image",
            props: { src: image.url, alt: image.alt ?? "" },
          };
        }
      }
      const text = inlineText(node);
      if (text.length === 0) return undefined;
      return { kind: "paragraph", text };
    }
    case "code":
      return {
        kind: "code",
        language: node.lang ?? "text",
        code: node.value ?? "",
        ...(node.meta !== null && node.meta !== undefined && node.meta.length > 0
          ? { title: node.meta }
          : {}),
      };
    case "list": {
      const items = node.children.map((item) => {
        const prefix = item.checked === true ? "[x] " : item.checked === false ? "[ ] " : "";
        const text = item.children
          .map((c) => inlineText(c))
          .join(" ")
          .trim();
        return `${prefix}${text}`;
      });
      return { kind: "list", ordered: node.ordered === true, items };
    }
    case "blockquote": {
      const text = node.children
        .map((c) => inlineText(c))
        .join(" ")
        .trim();
      return { kind: "callout", tone: inferCalloutTone(text), text };
    }
    case "table": {
      const headers = node.children[0]?.children.map((cell) => mdastToString(cell).trim()) ?? [];
      const rows = node.children
        .slice(1)
        .map((row) => row.children.map((cell) => mdastToString(cell).trim()));
      return { kind: "table", headers, rows };
    }
    case "thematicBreak":
      return undefined; // decorative
    default:
      return undefined;
  }
}

function inlineText(node: MdastContent & { children?: readonly MdastContent[] }): string {
  if (node.children === undefined) return mdastToString(node);
  return node.children
    .map((child) => {
      switch (child.type) {
        case "link":
          return `[${mdastToString(child)}](${child.url})`;
        case "image":
          return `![${child.alt ?? ""}](${child.url})`;
        default:
          return mdastToString(child);
      }
    })
    .join("")
    .trim();
}

function inferCalloutTone(text: string): "note" | "warning" | "deprecated" | "tip" {
  const lower = text.toLowerCase();
  if (lower.startsWith("warning")) return "warning";
  if (lower.startsWith("deprecated")) return "deprecated";
  if (lower.startsWith("tip")) return "tip";
  return "note";
}

/** Stable content fingerprint for change detection. */
export function fingerprintOf(
  blocks: readonly AuthoredDocument["blocks"][number]["block"][],
): string {
  return Buffer.from(JSON.stringify(blocks)).toString("base64url").slice(0, 32);
}

// ─── Guards ──────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSidebarConfig(value: unknown): value is NonNullable<PageFrontmatter["sidebar"]> {
  return isRecord(value);
}
