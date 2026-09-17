/**
 * Content Linter.
 *
 * Documentation-quality checks over authored documents:
 * headings, alt text, code languages, duplicates, terminology,
 * links, and frontmatter.
 */

import { diagnostic } from "../documentation/compiler/diagnostics.js";
import type { DocumentationDiagnostic } from "../documentation/compiler/diagnostics.js";
import type { AuthoredDocument } from "./types.js";
import type { IRBlock } from "../documentation/compiler/ir.js";
import type { LinkResolution } from "./links.js";

/** Languages considered valid for code fences (extensible). */
export const KNOWN_CODE_LANGUAGES: readonly string[] = [
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "json",
  "bash",
  "sh",
  "shell",
  "yaml",
  "yml",
  "toml",
  "css",
  "html",
  "md",
  "mdx",
  "python",
  "py",
  "go",
  "rust",
  "rs",
  "sql",
  "diff",
  "text",
];

/** Options accepted by {@link lintContent}. */
export interface LintOptions {
  readonly linkResolutions?: readonly LinkResolution[];
  readonly knownTerms?: readonly string[];
  readonly knownLanguages?: readonly string[];
  readonly maxHeadingDepth?: number;
}

/** Lint a set of authored documents. */
export function lintContent(
  documents: readonly AuthoredDocument[],
  options: LintOptions = {},
): DocumentationDiagnostic[] {
  const diagnostics: DocumentationDiagnostic[] = [];
  const titles = new Map<string, number>();

  // Duplicate titles across pages.
  for (const doc of documents) {
    const title = (doc.frontmatter.title ?? titleFromBlocks(doc) ?? "").toLowerCase();
    if (title.length === 0) continue;
    titles.set(title, (titles.get(title) ?? 0) + 1);
  }

  for (const doc of documents) {
    lintDocument(doc, options, titles, diagnostics);
  }

  for (const resolution of options.linkResolutions ?? []) {
    if (resolution.status === "missing-page") {
      diagnostics.push(
        diagnostic(
          "DOC_BROKEN_LINK",
          "error",
          `Broken internal link in "${resolution.link.sourceSlug}": ${resolution.link.target}`,
          resolution.link.sourceSlug,
        ),
      );
    }
  }

  return diagnostics;
}

function lintDocument(
  doc: AuthoredDocument,
  options: LintOptions,
  titles: Map<string, number>,
  diagnostics: DocumentationDiagnostic[],
): void {
  let previousLevel = 0;
  const headingIds = new Set<string>();
  const languages = new Set(options.knownLanguages ?? KNOWN_CODE_LANGUAGES);
  const maxDepth = options.maxHeadingDepth ?? 3;
  const hasDescription =
    doc.frontmatter.description !== undefined && doc.frontmatter.description.length > 0;

  for (const entry of doc.blocks) {
    const block = entry.block;

    if (block.kind === "heading") {
      const id = slugifyHeading(block.text);
      if (id.length > 0 && headingIds.has(id)) {
        diagnostics.push(
          diagnostic(
            "DOC_DUPLICATE_HEADING_ID",
            "warning",
            `Duplicate heading "${block.text}" produces a duplicate anchor.`,
            doc.slug,
          ),
        );
      }
      headingIds.add(id);

      if (previousLevel > 0 && block.level > previousLevel + 1) {
        diagnostics.push(
          diagnostic(
            "DOC_INVALID_HEADING_HIERARCHY",
            "info",
            `Heading "${block.text}" skips levels (h${previousLevel} → h${block.level}).`,
            doc.slug,
          ),
        );
      }
      if (block.level > maxDepth + 1) {
        diagnostics.push(
          diagnostic(
            "DOC_EXCESSIVE_HEADING_DEPTH",
            "info",
            `Heading depth h${block.level} exceeds the configured maximum (${maxDepth}).`,
            doc.slug,
          ),
        );
      }
      previousLevel = block.level;
    }

    if (block.kind === "code" && !languages.has(block.language.toLowerCase())) {
      diagnostics.push(
        diagnostic(
          "DOC_INVALID_CODE_LANGUAGE",
          "info",
          `Unknown code language "${block.language}".`,
          doc.slug,
        ),
      );
    }

    if (block.kind === "custom" && block.component === "Image") {
      const alt = block.props?.["alt"];
      if (typeof alt !== "string" || alt.trim().length === 0) {
        diagnostics.push(
          diagnostic(
            "DOC_MISSING_ALT_TEXT",
            "warning",
            "Image is missing alternative text.",
            doc.slug,
          ),
        );
      }
    }
  }

  // Missing description.
  if (!hasDescription) {
    diagnostics.push(
      diagnostic(
        "DOC_MISSING_DESCRIPTION",
        "info",
        `"${doc.slug}" has no description.`,
        doc.slug,
        "Add a description in frontmatter for better navigation and SEO.",
      ),
    );
  }

  // Duplicate title.
  const title = (doc.frontmatter.title ?? titleFromBlocks(doc) ?? "").toLowerCase();
  if (title.length > 0 && (titles.get(title) ?? 0) > 1) {
    diagnostics.push(
      diagnostic("DOC_DUPLICATE_TITLE", "warning", `Duplicate page title "${title}".`, doc.slug),
    );
  }

  // Terminology consistency.
  if (options.knownTerms !== undefined && options.knownTerms.length > 0) {
    diagnostics.push(...terminologyDiagnostics(doc, options.knownTerms));
  }
}

/** Simple terminology consistency check over text-bearing blocks. */
function terminologyDiagnostics(
  doc: AuthoredDocument,
  knownTerms: readonly string[],
): DocumentationDiagnostic[] {
  const diagnostics: DocumentationDiagnostic[] = [];
  const termSet = new Set(knownTerms.map((t) => t.toLowerCase()));

  for (const entry of doc.blocks) {
    const text = textOf(entry.block);
    for (const wordMatch of text.matchAll(/\b[a-z][a-zA-Z]{2,}\b/g)) {
      const word = wordMatch[0];
      if (word === undefined) continue;
      // Flag camelCase variants of known lowercase terms (e.g. getuser vs getUser).
      const lower = word.toLowerCase();
      if (termSet.has(lower) && word !== lower && !knownTerms.includes(word)) {
        diagnostics.push(
          diagnostic(
            "DOC_INCONSISTENT_TERMINOLOGY",
            "info",
            `"${word}" differs from canonical term "${knownTerms.find((t) => t.toLowerCase() === lower)}".`,
            doc.slug,
          ),
        );
        break;
      }
    }
  }
  return diagnostics;
}

function textOf(block: IRBlock): string {
  switch (block.kind) {
    case "heading":
    case "paragraph":
    case "callout":
      return block.text;
    case "list":
      return block.items.join(" ");
    default:
      return "";
  }
}

function titleFromBlocks(doc: AuthoredDocument): string | undefined {
  const h1 = doc.blocks.find((b) => b.block.kind === "heading" && b.block.level === 1);
  return h1 !== undefined && h1.block.kind === "heading" ? h1.block.text : undefined;
}

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}
