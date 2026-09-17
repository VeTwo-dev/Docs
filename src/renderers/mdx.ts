/**
 * Documentation IR → Markdown/MDX serializer.
 *
 * Deterministically serializes IR blocks into portable Markdown/MDX.
 * Used by renderers for user-editable content output; the Next.js runtime
 * additionally consumes structured block data directly.
 */

import type { IRBlock, DocumentationIR } from "../documentation/compiler/ir.js";

/** Serialize a single IR block to Markdown. */
export function serializeBlock(block: IRBlock): string {
  switch (block.kind) {
    case "heading": {
      const level = "#".repeat(block.level);
      return `${level} ${block.text}`;
    }
    case "paragraph":
      // JSDoc {@link Target} is not valid MDX (braces open expressions);
      // render link targets as code spans (targets are preserved separately).
      return block.text.replace(/\{@link\s+([^}|]+)(?:\|[^}]*)?\}/g, "`$1`");
    case "code": {
      const title = block.title !== undefined ? ` title="${block.title}"` : "";
      return `\`\`\`${block.language}${title}\n${block.code}\n\`\`\``;
    }
    case "list": {
      const marker = block.ordered ? "1." : "-";
      return block.items.map((item) => `${marker} ${item}`).join("\n");
    }
    case "callout": {
      const label = calloutLabel(block.tone);
      return `> **${label}** ${block.text}`;
    }
    case "table": {
      const header = `| ${block.headers.join(" | ")} |`;
      const divider = `| ${block.headers.map(() => "---").join(" | ")} |`;
      const rows = block.rows.map((row) => `| ${row.join(" | ")} |`);
      return [header, divider, ...rows].join("\n");
    }
    case "image": {
      const title = block.title !== undefined ? ` "${block.title}"` : "";
      return `![${escapeMdxAttr(block.alt)}](${escapeMdxAttr(block.src)}${title})`;
    }
    case "horizontal-rule":
      return "---";
    case "custom": {
      const safeComponent = sanitizeComponentName(block.component);
      const props = Object.entries(block.props ?? {})
        .map(([key, value]) => {
          const safeKey = sanitizePropName(key);
          if (typeof value === "string") {
            return `${safeKey}="${escapeMdxAttr(value)}"`;
          }
          return `${safeKey}={${JSON.stringify(value)}}`;
        })
        .join(" ");
      const suffix = props.length > 0 ? ` ${props}` : "";
      return `<${safeComponent}${suffix} />`;
    }
  }
}

function calloutLabel(tone: "note" | "warning" | "deprecated" | "tip"): string {
  switch (tone) {
    case "warning":
      return "Warning:";
    case "deprecated":
      return "Deprecated:";
    case "tip":
      return "Tip:";
    default:
      return "Note:";
  }
}

/**
 * Sanitize a component name for safe MDX insertion.
 * Only allows alphanumeric characters, hyphens, and dots.
 */
function sanitizeComponentName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-]/g, "");
}

/**
 * Sanitize a prop name for safe MDX insertion.
 * Only allows alphanumeric characters, hyphens, and underscores.
 */
function sanitizePropName(name: string): string {
  return name.replace(/[^a-zA-Z0-9\-_]/g, "");
}

/**
 * Escape a string value for safe insertion into an MDX attribute.
 * Prevents attribute injection attacks.
 */
function escapeMdxAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Serialize a list of blocks separated by blank lines. */
export function serializeBlocks(blocks: readonly IRBlock[]): string {
  return blocks.map((block) => serializeBlock(block)).join("\n\n");
}

/** Frontmatter for a rendered page. */
export function serializeFrontmatter(
  fields: Readonly<Record<string, string | readonly string[] | boolean | number>>,
): string {
  const lines = Object.entries(fields).map(([key, value]) => {
    if (Array.isArray(value)) {
      return `${key}: [${value.map((v) => JSON.stringify(v)).join(", ")}]`;
    }
    if (typeof value === "string") {
      return `${key}: ${JSON.stringify(value)}`;
    }
    return `${key}: ${String(value)}`;
  });
  return ["---", ...lines, "---"].join("\n");
}

/** Serialize a complete IR page to MDX with frontmatter. */
export function serializePage(
  ir: DocumentationIR,
  slug: string,
  extra: { readonly section?: string } = {},
): string | undefined {
  const page = ir.pages.find((p) => p.slug === slug);
  if (page === undefined) return undefined;

  const frontmatter = serializeFrontmatter({
    title: page.title,
    description: page.description ?? "",
    section: extra.section ?? page.sectionId,
    slug: page.slug,
    generator: "@vetwo/docs",
  });

  return [frontmatter, "", serializeBlocks(page.blocks), ""].join("\n");
}
