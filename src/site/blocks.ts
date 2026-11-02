/**
 * Canonical mdast → IRBlock converter.
 *
 * Same structural mapping as the content parser's `mdastToBlock`, but with a
 * different fidelity contract: inline markup (emphasis, strong, code spans,
 * links, images) is preserved as Markdown instead of being stripped to
 * plain text. User documentation must survive the canonical pipeline
 * unchanged in meaning and formatting.
 */

import type { Content as MdastContent } from "mdast";
import { toString as mdastToString } from "mdast-util-to-string";
import type { IRBlock } from "../documentation/compiler/ir.js";

/**
 * Serialize inline mdast content back to Markdown, preserving emphasis,
 * strong, code spans, links, and images. Unknown leaves fall back to
 * plain-text extraction.
 */
export function inlineMarkdown(node: MdastContent): string {
  switch (node.type) {
    case "text":
      return node.value;
    case "emphasis":
      return `*${childrenMarkdown(node)}*`;
    case "strong":
      return `**${childrenMarkdown(node)}**`;
    case "inlineCode":
      return `\`${node.value}\``;
    case "link":
      return `[${childrenMarkdown(node)}](${node.url})`;
    case "image": {
      const title = node.title !== undefined ? ` "${node.title}"` : "";
      return `![${node.alt ?? ""}](${node.url}${title})`;
    }
    case "break":
      return "  \n";
    case "delete":
      return `~~${childrenMarkdown(node)}~~`;
    case "html":
      return node.value;
    case "mdxTextExpression":
      return `{${String(node.value ?? "").trim()}}`;
    default: {
      const children = (node as { children?: readonly MdastContent[] }).children;
      if (children !== undefined) {
        return children.map((child) => inlineMarkdown(child)).join("");
      }
      return mdastToString(node);
    }
  }
}

function childrenMarkdown(node: MdastContent & { children: readonly MdastContent[] }): string {
  return node.children.map((child) => inlineMarkdown(child)).join("");
}

function inferCalloutTone(text: string): "note" | "warning" | "deprecated" | "tip" {
  const lower = text.toLowerCase();
  if (lower.startsWith("warning")) return "warning";
  if (lower.startsWith("deprecated")) return "deprecated";
  if (lower.startsWith("tip")) return "tip";
  return "note";
}

/**
 * Convert one top-level mdast node to an IRBlock, preserving inline markup.
 * Returns undefined for empty or purely decorative nodes. JSX nodes are not
 * handled here (`.mdx` sources go through the MDX parser instead).
 */
export function mdastNodeToBlock(node: MdastContent): IRBlock | undefined {
  switch (node.type) {
    case "heading": {
      const text = node.children
        .map((child) => inlineMarkdown(child))
        .join("")
        .trim();
      if (text.length === 0) return undefined;
      const level = Math.min(Math.max(node.depth, 1), 3) as 1 | 2 | 3;
      return { kind: "heading", level, text };
    }
    case "paragraph": {
      if (
        node.children.length === 1 &&
        node.children[0] !== undefined &&
        node.children[0].type === "image"
      ) {
        const image = node.children[0];
        if (typeof image.url === "string") {
          return {
            kind: "image",
            src: image.url,
            alt: image.alt ?? "",
            ...(image.title !== undefined && image.title !== null ? { title: image.title } : {}),
          };
        }
      }
      const text = inlineMarkdown(node).trim();
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
          .map((c) => inlineMarkdown(c))
          .join(" ")
          .trim();
        return `${prefix}${text}`;
      });
      if (items.every((item) => item.length === 0)) return undefined;
      return { kind: "list", ordered: node.ordered === true, items };
    }
    case "blockquote": {
      const text = node.children
        .map((c) => inlineMarkdown(c))
        .join(" ")
        .trim();
      if (text.length === 0) return undefined;
      return { kind: "callout", tone: inferCalloutTone(text), text };
    }
    case "table": {
      const headers = node.children[0]?.children.map((cell) => inlineMarkdown(cell).trim()) ?? [];
      const rows = node.children
        .slice(1)
        .map((row) => row.children.map((cell) => inlineMarkdown(cell).trim()));
      if (headers.length === 0) return undefined;
      return { kind: "table", headers, rows };
    }
    case "thematicBreak":
      return { kind: "horizontal-rule" };
    case "html": {
      const text = node.value.trim();
      if (text.length === 0) return undefined;
      return { kind: "paragraph", text };
    }
    default:
      return undefined;
  }
}

/**
 * Plain searchable text for a block list: headings, paragraphs, lists,
 * tables, and callouts (inline markup stripped); code content included
 * (parity with the legacy search index, which keeps code text).
 */
export function blocksToSearchText(blocks: readonly IRBlock[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    switch (block.kind) {
      case "heading":
      case "paragraph":
        parts.push(stripMarkdown(block.text));
        break;
      case "code":
        parts.push(block.code);
        break;
      case "list":
        for (const item of block.items) parts.push(stripMarkdown(item));
        break;
      case "table":
        for (const cell of [...block.headers, ...block.rows.flat()]) {
          parts.push(stripMarkdown(cell));
        }
        break;
      case "callout":
        parts.push(stripMarkdown(block.text));
        break;
      default:
        break;
    }
  }
  return parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join("\n");
}

/** Strip Markdown markers for search text (deterministic, display-oriented). */
function stripMarkdown(text: string): string {
  return text
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/\{@link\s+([^}|]+)(?:\|[^}]*)?\}/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#123;/g, "{")
    .replace(/&#125;/g, "}");
}
