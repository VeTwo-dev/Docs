/**
 * Shared inline-link rewriting for documentation text.
 *
 * Authored Markdown links are canonicalized to content-root routes at
 * normalization time (`site/normalize.ts`) and mapped into each renderer's URL
 * space at render time (`renderers/output-plan.ts`). Both call the same
 * text-level and block-level helpers so behavior stays identical.
 */

import type { IRBlock } from "../documentation/compiler/ir.js";

/**
 * Rewrite inline Markdown links in `text` with `resolve`, leaving code spans
 * untouched. `resolve` returns the replacement URL, or undefined to keep the
 * link exactly as authored.
 */
export function rewriteMarkdownLinks(
  text: string,
  resolve: (url: string) => string | undefined,
): string {
  // Mask inline code spans first so links inside them are never rewritten.
  // Masking (rather than splitting) keeps a link whose *label* contains code,
  // e.g. [`docs plugin`](../cli/plugin.md), in one piece for the regex below.
  const code: string[] = [];
  const masked = text.replace(/`[^`]*`/g, (span) => {
    code.push(span);
    return `\uE000${code.length - 1}\uE001`;
  });
  const rewritten = masked.replace(
    /(?<![!\]])\[([^\]]*)\]\(([^)\s]+)(\s+"[^"]*")?\)/g,
    (match, label: string, url: string, title: string | undefined) => {
      const href = resolve(url);
      return href === undefined ? match : `[${label}](${href}${title ?? ""})`;
    },
  );
  return rewritten.replace(/\uE000(\d+)\uE001/g, (_, index: string) => code[Number(index)] ?? "");
}

/**
 * Apply `transform` to every inline-text field of a block list. Code, images,
 * and non-text blocks are preserved verbatim.
 */
export function mapBlockText(
  blocks: readonly IRBlock[],
  transform: (text: string) => string,
): readonly IRBlock[] {
  return blocks.map((block) => {
    switch (block.kind) {
      case "heading":
        return { ...block, text: transform(block.text) };
      case "paragraph":
        return { ...block, text: transform(block.text) };
      case "list":
        return { ...block, items: block.items.map(transform) };
      case "callout":
        return { ...block, text: transform(block.text) };
      case "table":
        return {
          ...block,
          headers: block.headers.map(transform),
          rows: block.rows.map((row) => row.map(transform)),
        };
      default:
        return block;
    }
  });
}
